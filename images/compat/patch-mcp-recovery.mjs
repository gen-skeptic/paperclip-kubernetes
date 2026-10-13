// MIT; build-time compatibility patch for public upstream application code.
// No credentials, runtime home, database, provider calls or write replay.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const artifactHashes = {
  'src/tool-gateway': '78921349d57f87725606f2ec5c332cc0135b8be1c8cc17208a3e5e061327dc51',
  'dist/tool-gateway': '9aeaafadd7d7d00cfdd65843fec798e667ff49cbfb3c66c3ce1101a9493b6997',
  'src/tool-access': '787648790ff695ac818f05ba906e1b9d176f65b2881606c29d1923251ce7356e',
  'dist/tool-access': '578acc0da1278c7cb1ec29f9336069e6feacdc15fc56997ea9dc0e38c6f43c4b',
  'src/connection-intents': 'cd9c41e7aebc1b4e2fbede1cdc02e4666f1fee6b5b37ea35633b04d16b9bf51f',
  'dist/connection-intents': '5903517f2146aade2760e4711c23354e3a3c4ab7e0aa2a384a0bccc0b398b41e',
};
export const digest = text => crypto.createHash('sha256').update(text).digest('hex');
export const transientMessages = ['Remote MCP tool call timed out.', 'Remote MCP tool call failed.'];
export const recoverableExpression = name =>
  `(${name}.transport === "mcp_remote" && ${name}.healthStatus === "degraded" && ${JSON.stringify(transientMessages)}.includes(${name}.healthMessage ?? ""))`;

function replaceExactly(text, before, after, count = 1) {
  if (text.split(before).length - 1 !== count) throw new Error('patch-marker-mismatch');
  return text.split(before).join(after);
}
function inSection(text, start, end, rewrite) {
  const at=text.indexOf(start), until=text.indexOf(end,at+start.length);
  if (at<0 || until<0 || text.indexOf(start,at+start.length)>=0) throw new Error('patch-section-mismatch');
  return text.slice(0,at)+rewrite(text.slice(at,until))+text.slice(until);
}

export function rewrite(kind, text, expectedHash, compiled = false) {
  if (!expectedHash || digest(text)!==expectedHash) throw new Error('source-hash-mismatch');
  if (kind==='tool-gateway') {
    text=inSection(text,'function timeoutMs(', 'function sessionTtlMs(', section=>{
      section=replaceExactly(section,compiled?'function timeoutMs(value)':'function timeoutMs(value: number | undefined)',
        compiled?'function timeoutMs(value, remoteMcp = false)':'function timeoutMs(value: number | undefined, remoteMcp = false)');
      return replaceExactly(section,'return DEFAULT_TOOL_TIMEOUT_MS;',
        'return remoteMcp ? 30_000 : DEFAULT_TOOL_TIMEOUT_MS;');
    });
    for (const [before,after] of [
      ['timeoutMs(args.timeoutMs)', 'timeoutMs(args.timeoutMs, args.tool.providerType === "mcp_remote_http")'],
      ['timeoutMs(input.timeoutMs)', 'timeoutMs(input.timeoutMs, tool.providerType === "mcp_remote_http")'],
    ]) text=replaceExactly(text,before,after);
    text=replaceExactly(text,'inArray(toolConnections.healthStatus, ["ok", "healthy"])',
      'or(inArray(toolConnections.healthStatus, ["ok", "healthy"]), and(eq(toolConnections.transport, "mcp_remote"), eq(toolConnections.healthStatus, "degraded"), inArray(toolConnections.healthMessage, '+JSON.stringify(transientMessages)+')))');
    text=inSection(text,'async function executeRemoteHttpTool(', 'async function executeLocalStdioTool(', section=>{
      for (const message of transientMessages) {
        const pattern=new RegExp('(await markRemoteConnectionHealth\\(\\s*connection,\\s*)"error"(,\\s*"'+message.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'")','g');
        const matches=[...section.matchAll(pattern)];
        if (matches.length!==1) throw new Error('patch-health-marker-mismatch');
        section=section.replace(pattern,'$1"degraded"$2');
      }
      return section;
    });
    // Plugin inference and the runtime catalog both recognize these mutations.
    // Keep explicit catalog write/destructive risk; never downgrade it.
    text=inSection(text,'function inferToolRisk(', 'function riskFromCatalogEntry(', section=>{
      section=replaceExactly(section,'const lower = toolName.toLowerCase();',
        'const lower = toolName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();');
      return replaceExactly(section,'create|update|write|edit|patch|post|send|publish|merge|commit|apply',
        'create|update|write|edit|patch|post|send|publish|merge|commit|apply|capture|index',2);
    });
    text=inSection(text,'function riskFromCatalogEntry(', 'function slugSegment(', section=>{
      if (!compiled) section=replaceExactly(section,'  >,','  > & { toolName?: string; annotations?: Record<string, unknown> },');
      const body=section.indexOf('{\n');
      // The TypeScript optional-field type above contains a brace on one line,
      // not a function-body opening followed by a newline.
      if (body<0) throw new Error('patch-risk-body-mismatch');
      section=section.slice(0,body+2)+'  const inferred = inferToolRisk(entry.toolName ?? "");\n'+section.slice(body+2);
      section=replaceExactly(section,'entry.riskLevel === "destructive"','(inferred === "destructive" || entry.annotations?.destructiveHint === true || entry.annotations?.destructive === true || entry.riskLevel === "destructive")');
      return replaceExactly(section,'entry.riskLevel === "write"','(inferred === "write" || entry.annotations?.readOnlyHint === false || entry.annotations?.writeHint === true || entry.riskLevel === "write")');
    });
    text=inSection(text,'async function connectedMcpToolsForCompany(', 'async function connectedMcpToolsForConnection(', section=>{
      const declarations=/(const annotations = catalogEntry\.annotations \?\? \{\};)(\s*)(const risk = riskFromCatalogEntry\(catalogEntry\);)/g;
      if ([...section.matchAll(declarations)].length!==1) throw new Error('patch-annotation-marker-mismatch');
      section=section.replace(declarations,'$3$2const annotations = { ...catalogEntry.annotations, readOnlyHint: risk === "read", destructiveHint: risk === "destructive" };');
      for (const [before,after] of [
        ['level: catalogEntry.riskLevel','level: risk'],
        ['isReadOnly: catalogEntry.isReadOnly','isReadOnly: risk === "read"'],
        ['isWrite: catalogEntry.isWrite','isWrite: risk === "write"'],
        ['isDestructive: catalogEntry.isDestructive','isDestructive: risk === "destructive"'],
      ]) section=replaceExactly(section,before,after);
      return section;
    });
  } else if (kind==='tool-access') {
    text=inSection(text,'function classifyRisk(', 'function isGmailToolPermanentlyBlocked(', section=>
      replaceExactly(section,'create|update|write|set|send|publish|post|mutate|mark|archive',
        'create|update|write|set|send|publish|post|mutate|mark|archive|capture|index'));
  } else if (kind==='connection-intents') {
    // Only transport-degraded states bearing our exact failure messages are
    // recoverable. Expiring credentials and other degraded states still need
    // human attention. All installed/profile/status/actor gates remain intact.
    for (const [name,count] of [['connection',2],['selectedConnection',1]]) {
      const call=`isToolConnectionAttentionHealth(${name}.healthStatus)`;
      text=replaceExactly(text,call,`(${call} && !${recoverableExpression(name)})`,count);
    }
  } else throw new Error('unknown-artifact');
  return text;
}

export function prepareArtifacts(root='/app/server', io=fs) {
  return Object.entries(artifactHashes).map(([key,hash])=>{
    const [dir,kind]=key.split('/');
    const path=`${root}/${dir}/services/${kind}.${dir==='src'?'ts':'js'}`;
    const st=io.lstatSync(path);
    if (!st.isFile() || st.isSymbolicLink()) throw new Error('artifact-type-mismatch');
    return {path,text:rewrite(kind,io.readFileSync(path,'utf8'),hash,dir==='dist')};
  });
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length!==3 || !['--check','--apply'].includes(process.argv[2])) throw new Error('explicit-mode-required');
    const artifacts=prepareArtifacts(); // Validate all six before any write.
    if (process.argv[2]==='--apply') for (const artifact of artifacts) fs.writeFileSync(artifact.path,artifact.text);
    console.log('mcp_recovery_artifacts_'+(process.argv[2]==='--apply'?'patched':'checked')+'='+artifacts.length);
  } catch(error) {
    console.error('STOP: pinned MCP recovery patch rejected: '+error.message);
    process.exitCode=1;
  }
}
