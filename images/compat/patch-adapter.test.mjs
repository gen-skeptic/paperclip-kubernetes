import test from 'node:test';
import assert from 'node:assert/strict';
import {rewrite, digest, oldLine, newLine} from './patch-adapter.mjs';

// Non-secret fixtures: exercise one shared generator with any number of
// gateways, not gateway-specific manual configuration.
const generator = `function generate(gateways) {
  const tomlString = JSON.stringify;
  return gateways.map(gateway => [
    '[mcp_servers.' + tomlString(gateway.name) + ']',
    'url = ' + tomlString(gateway.url),
    ${oldLine}
  ].join('\\n')).join('\\n\\n');
}`;

test('exact single-literal correction preserves all other bytes', () => {
  const fixed = rewrite(generator, digest(generator));
  assert.equal(fixed.replace(newLine, oldLine), generator);
});
test('multiple present and future gateways retain independent authentication', () => {
  const generate = new Function(rewrite(generator, digest(generator)) + '; return generate;')();
  const gateways = [
    {name:'paperclip-connections',url:'http://127.0.0.1:3100/mcp/runtime-tools',bearerToken:'fixture-connection'},
    {name:'paperclip-projects',url:'http://127.0.0.1:3100/api/mcp/project-tools',bearerToken:'fixture-project'},
    {name:'future-memory',url:'http://127.0.0.1:3100/fixture/future',bearerToken:'fixture-memory'}
  ];
  const output = generate(gateways);
  assert.equal(output.match(/http_headers =/g).length, 3);
  assert.equal(output.match(/^headers =/gm), null);
  for (const gateway of gateways) {
    assert.ok(output.includes(JSON.stringify(gateway.url)));
    assert.ok(output.includes(JSON.stringify('Bearer ' + gateway.bearerToken)));
  }
});
test('empty gateway inventory works without manufactured credentials', () => {
  const generate = new Function(rewrite(generator, digest(generator)) + '; return generate;')();
  assert.equal(generate([]), '');
});
test('unknown source, missing and ambiguous markers fail closed', () => {
  assert.throws(() => rewrite(generator, '0'.repeat(64)), /source-hash/);
  assert.throws(() => rewrite('unrelated', null), /patch-marker/);
  assert.throws(() => rewrite(generator + oldLine, null), /patch-marker/);
  assert.throws(() => rewrite(generator.replace(oldLine, newLine), null), /patch-marker/);
});
test('quoted token fixtures stay valid TOML strings', () => {
  const generate = new Function(rewrite(generator, digest(generator)) + '; return generate;')();
  const output = generate([{name:'fixture',url:'http://127.0.0.1:3100/mcp',bearerToken:'fixture-"-\\-token'}]);
  assert.ok(output.includes(JSON.stringify('Bearer fixture-"-\\-token')));
});
