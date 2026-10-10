// Build-time only: never reads CODEX_HOME, auth caches or generated credentials.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const upstreamSha256 = 'd013f3334e7a7822dcf0aa4c5753c68be9d79fe4b49d964a4d3f8d57bd72a353';
export const oldLine = '`headers = { Authorization = ${tomlString(`Bearer ${gateway.bearerToken}`)} }`';
export const newLine = '`http_headers = { Authorization = ${tomlString(`Bearer ${gateway.bearerToken}`)} }`';
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');

export function rewrite(text, expectedHash) {
  if (expectedHash && digest(text) !== expectedHash) throw new Error('source-hash-mismatch');
  if (text.split(oldLine).length !== 2 || text.includes(newLine)) throw new Error('patch-marker-mismatch');
  // One literal field name changes; token generation, scope, expiry, gateway
  // iteration, names, destinations and protected-file handling remain intact.
  return text.replace(oldLine, newLine);
}

export function patchImage() {
  const source = '/app/packages/adapters/codex-local/src/server/codex-home.ts';
  const compiled = '/app/packages/adapters/codex-local/dist/server/codex-home.js';
  const paths = [source];
  if (fs.existsSync(compiled)) paths.push(compiled);
  // Validate every artifact before any write. No recursive search/patch.
  const prepared = paths.map(path => {
    if (!fs.lstatSync(path).isFile() || fs.lstatSync(path).isSymbolicLink()) throw new Error('artifact-type-mismatch');
    const text = fs.readFileSync(path, 'utf8');
    return [path, rewrite(text, path === source ? upstreamSha256 : null)];
  });
  for (const [path, text] of prepared) fs.writeFileSync(path, text);
  return prepared.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log('shared_adapter_artifacts_patched=' + patchImage()); }
  catch { console.error('STOP: pinned adapter compatibility patch rejected'); process.exitCode = 1; }
}
