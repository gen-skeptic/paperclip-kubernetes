import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as nodeModule from 'node:module';
const {createRequire}=nodeModule;
import vm from 'node:vm';
import {rewrite,digest,recoverableExpression,transientMessages,prepareArtifacts,artifactHashes} from './patch-mcp-recovery.mjs';

// Synthetic snippets retain upstream markers. The optional source root adds
// tests of the exact pinned application files, with stubbed transport/auth and
// no database, network, credentials or model invocation.
const gatewayFixture=String.raw`
const DEFAULT_TOOL_TIMEOUT_MS = 10_000;
function timeoutMs(value) {
  if (!Number.isFinite(value)) return DEFAULT_TOOL_TIMEOUT_MS;
  return Math.max(1, Math.min(60_000, Math.floor(value ?? DEFAULT_TOOL_TIMEOUT_MS)));
}
function sessionTtlMs(value) { return value; }
function inferToolRisk(toolName) {
  const lower = toolName.toLowerCase();
  if (/\b(delete|destroy|remove|drop|truncate|wipe|purge)\b|(^|[:._-])(delete|destroy|remove|drop|truncate|wipe|purge)([:._-]|$)/.test(lower)) return "destructive";
  if (/\b(create|update|write|edit|patch|post|send|publish|merge|commit|apply)\b|(^|[:._-])(create|update|write|edit|patch|post|send|publish|merge|commit|apply)([:._-]|$)/.test(lower)) return "write";
  return "read";
}
function riskFromCatalogEntry(entry) {
  if (entry.riskLevel === "destructive" || entry.isDestructive || entry.riskLevel === "critical" || entry.riskLevel === "high") return "destructive";
  if (entry.riskLevel === "write" || entry.isWrite || entry.riskLevel === "medium") return "write";
  return "read";
}
function slugSegment(v) { return v; }
async function connectedMcpToolsForCompany(companyId) {
  const health = inArray(toolConnections.healthStatus, ["ok", "healthy"]);
  const annotations = catalogEntry.annotations ?? {};
  const risk = riskFromCatalogEntry(catalogEntry);
  return {annotations,risk:{level: catalogEntry.riskLevel,isReadOnly: catalogEntry.isReadOnly,isWrite: catalogEntry.isWrite,isDestructive: catalogEntry.isDestructive}};
}
async function connectedMcpToolsForConnection() {}
async function executeRemoteHttpTool() {
  await markRemoteConnectionHealth(connection, "error", "Remote MCP tool call timed out.");
  await markRemoteConnectionHealth(connection, "error", "Remote MCP tool call failed.");
}
async function executeLocalStdioTool() {}
function testCall(args) {return timeoutMs(args.timeoutMs);}
function agentCall(input) {return timeoutMs(input.timeoutMs);}
`;
const accessFixture=String.raw`
function verbMatches(toolName,verbs) {
  const normalized=toolName.replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase();
  return new RegExp("\\b("+verbs+")\\b|(^|[:._-])("+verbs+")([:._-]|$)").test(normalized);
}
function classifyRisk(tool) {
  if (tool.annotations?.destructiveHint===true) return "destructive";
  if (verbMatches(tool.name,"delete|remove|destroy|unpublish")) return "destructive";
  if (verbMatches(tool.name,"create|update|write|set|send|publish|post|mutate|mark|archive")) return "write";
  return "read";
}
function isGmailToolPermanentlyBlocked() {}
`;
const intentFixture=String.raw`
function usable(connection) {return connection && connection.status==="active" && connection.enabled && installedIds.has(connection.id) && permittedIds.has(connection.id) && !isToolConnectionAttentionHealth(connection.healthStatus) ? connection : null;}
function needsAttention(matching) {return matching.some(connection=>isToolConnectionAttentionHealth(connection.healthStatus));}
function selectedRequiresAttention(selectedConnection) {return isToolConnectionAttentionHealth(selectedConnection.healthStatus);}
`;
function evaluate(code,names,globals={}) {
  const context={Error,TypeError,...globals};vm.createContext(context);
  vm.runInContext(code+'\nObject.assign(globalThis,{'+names.join(',')+'});',context);
  return context;
}
const fixedGateway=rewrite('tool-gateway',gatewayFixture,digest(gatewayFixture),true);
const fixedAccess=rewrite('tool-access',accessFixture,digest(accessFixture),true);
const fixedIntents=rewrite('connection-intents',intentFixture,digest(intentFixture),true);
const risk=evaluate(fixedGateway,['inferToolRisk','riskFromCatalogEntry','timeoutMs']);
const classify=evaluate(fixedAccess,['classifyRisk']).classifyRisk;

for (const name of ['capture_thought','index_document_text','memory.captureThought','mcp.openbrain:indexDocumentText']) {
  test(name+' is a write in discovery and cached runtime catalog',()=>{
    assert.equal(classify({name,annotations:{readOnlyHint:true}}),'write');
    assert.equal(risk.inferToolRisk(name),'write');
    assert.equal(risk.riskFromCatalogEntry({toolName:name,riskLevel:'read',isReadOnly:true}),'write');
  });
}
for (const name of ['search_thoughts','search_documents','list_recent_thoughts','thought_statistics']) {
  test(name+' remains read-only',()=>{
    assert.equal(classify({name}),'read');assert.equal(risk.inferToolRisk(name),'read');
  });
}
test('risk escalation never downgrades explicit destructive/write risk',()=>{
  for(const level of ['destructive','high','critical']) assert.equal(risk.riskFromCatalogEntry({riskLevel:level,toolName:'capture_thought'}),'destructive');
  assert.equal(risk.riskFromCatalogEntry({riskLevel:'write',toolName:'search_thoughts'}),'write');
  assert.equal(classify({name:'capture_thought',annotations:{destructiveHint:true}}),'destructive');
  assert.equal(risk.inferToolRisk('deleteCaptureThought'),'destructive');
  assert.equal(risk.riskFromCatalogEntry({toolName:'search_thoughts',riskLevel:'read',annotations:{destructiveHint:true}}),'destructive');
  assert.equal(risk.riskFromCatalogEntry({toolName:'search_thoughts',riskLevel:'read',annotations:{readOnlyHint:false}}),'write');
  assert.equal(risk.riskFromCatalogEntry({toolName:'delete_thought',riskLevel:'read',annotations:{writeHint:true}}),'destructive');
});
test('only remote MCP default grows; explicit budgets stay bounded',()=>{
  assert.equal(risk.timeoutMs(undefined,true),30000);
  assert.equal(risk.timeoutMs(undefined,false),10000);
  assert.equal(risk.timeoutMs(70000,true),60000);
  assert.equal(risk.timeoutMs(-1,true),1);
  assert.equal(risk.timeoutMs(1000,true),1000);
  assert.match(fixedGateway,/timeoutMs\(args.timeoutMs, args.tool.providerType === "mcp_remote_http"\)/);
  assert.match(fixedGateway,/timeoutMs\(input.timeoutMs, tool.providerType === "mcp_remote_http"\)/);
});
test('only the exact transport-degraded states are recoverable',()=>{
  const check=new Function('c','return '+recoverableExpression('c'));
  for(const healthMessage of transientMessages) assert(check({transport:'mcp_remote',healthStatus:'degraded',healthMessage}));
  for(const healthStatus of ['missing_secret','error','failed','unchecked']) assert(!check({transport:'mcp_remote',healthStatus,healthMessage:transientMessages[0]}));
  assert(!check({transport:'local_stdio',healthStatus:'degraded',healthMessage:transientMessages[0]}));
  assert(!check({transport:'mcp_remote',healthStatus:'degraded',healthMessage:'Credential expires soon.'}));
  assert(!check({transport:'mcp_remote',healthStatus:'degraded',healthMessage:'Insufficient OAuth scope.'}));
});
test('recoverable health does not bypass installed, permitted, enabled or active gates',()=>{
  const context=evaluate(fixedIntents,['usable'],{
    installedIds:new Set(['fixture-connection']),permittedIds:new Set(['fixture-connection']),
    isToolConnectionAttentionHealth:s=>['degraded','error','failed','missing_secret'].includes(s),
  });
  const c={id:'fixture-connection',transport:'mcp_remote',healthStatus:'degraded',healthMessage:transientMessages[0],status:'active',enabled:true};
  assert(context.usable(c));
  for(const override of [{id:'other-company-connection'},{enabled:false},{status:'archived'},{healthStatus:'missing_secret'},{healthMessage:'Credential expires soon.'}]) assert.equal(context.usable({...c,...override}),null);
  context.permittedIds.clear();assert.equal(context.usable(c),null);
});
test('unknown hash, missing markers and already-patched source are rejected',()=>{
  assert.throws(()=>rewrite('tool-gateway',gatewayFixture,'0'.repeat(64),true),/hash/);
  assert.throws(()=>rewrite('tool-gateway','unrelated',digest('unrelated'),true),/section/);
  assert.throws(()=>rewrite('tool-gateway',fixedGateway,digest(fixedGateway),true),/marker/);
  assert.throws(()=>rewrite('unknown',gatewayFixture,digest(gatewayFixture),true),/unknown/);
  assert.throws(()=>prepareArtifacts('/fixture',{lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>true})}),/type/);
});

const root=process.env.PAPERCLIP_MCP_SOURCE_ROOT;
const patchedManifest=process.env.PAPERCLIP_MCP_PATCHED_MANIFEST
  ? JSON.parse(fs.readFileSync(process.env.PAPERCLIP_MCP_PATCHED_MANIFEST,'utf8')) : null;
function source(kind,dir='src') {return fs.readFileSync(`${root}/${dir}/services/${kind}.${dir==='src'?'ts':'js'}`,'utf8');}
function actual(kind,dir='src') {
  const text=source(kind,dir);
  if (patchedManifest) {
    assert.equal(digest(text),patchedManifest[dir+'/'+kind],'built-artifact-hash-mismatch');
    return text;
  }
  return rewrite(kind,text,artifactHashes[dir+'/'+kind],dir==='dist');
}
function functionText(text,name) {
  // Locate the body after the complete parameter list, so an inline parameter
  // type cannot be mistaken for the body. Targeted functions have balanced
  // template substitutions and contain no unmatched brace-bearing literals.
  const start=text.indexOf('function '+name+'(');
  assert(start>=0,name+' missing');let depth=0,parameters=0,close;
  for(let i=text.indexOf('(',start);i<text.length;i++) {
    if(text[i]==='(')parameters++;
    if(text[i]===')' && --parameters===0){close=i;break;}
  }
  for(let i=text.indexOf('{',close);i<text.length;i++) {
    if(text[i]==='{')depth++;
    if(text[i]==='}' && --depth===0)return nodeModule.stripTypeScriptTypes((text.slice(start-6,start)==='async '?'async ':'')+text.slice(start,i+1),{mode:'strip'});
  }
  throw new Error('unterminated function');
}
function stripped(kind) {return actual(kind);}
test('exact pinned source rewrites and edited TypeScript functions parse', {skip:!root},()=>{
  for(const name of ['timeoutMs','inferToolRisk','riskFromCatalogEntry','executeRemoteHttpTool']) assert.doesNotThrow(()=>functionText(actual('tool-gateway'),name));
  assert.doesNotThrow(()=>functionText(actual('tool-access'),'classifyRisk'));
  assert.doesNotThrow(()=>actual('connection-intents'));
});
test('actual upstream catalog classifier recognizes the write verbs', {skip:!root},()=>{
  const text=stripped('tool-access');
  const c=evaluate(functionText(text,'verbMatches')+functionText(text,'normalizedProviderToolName')+functionText(text,'classifyRisk'),['classifyRisk'],{
    isMemoryConnectorId:()=>false,AGGREGATOR_READ_TOOLS:new Map(),BROWSER_USE_TOOLS:[],
    NOTION_READ_TOOLS:new Set(),NOTION_WRITE_TOOLS:new Set(),SHOPIFY_DESTRUCTIVE_TOOLS:new Set(),
  }).classifyRisk;
  for(const name of ['capture_thought','index_document_text']) assert.equal(c({name,annotations:{readOnlyHint:true}}),'write');
  assert.equal(c({name:'search_thoughts'}),'read');
});
test('actual upstream cached runtime risk is escalated without a catalog refresh', {skip:!root},()=>{
  const text=stripped('tool-gateway');
  const c=evaluate(functionText(text,'inferToolRisk')+functionText(text,'riskFromCatalogEntry'),['riskFromCatalogEntry']).riskFromCatalogEntry;
  assert.equal(c({toolName:'capture_thought',riskLevel:'read',isReadOnly:true}),'write');
  assert.equal(c({toolName:'index_document_text',riskLevel:'critical'}),'destructive');
});
test('all six actual image artifacts validate and compiled modules parse', {skip:!root || !fs.existsSync(`${root}/dist/services/tool-gateway.js`)},()=>{
  const artifacts=patchedManifest ? Object.keys(artifactHashes).map(key=>{
    const [dir,kind]=key.split('/');return {path:dir==='dist'?kind+'.js':kind+'.ts',text:actual(kind,dir)};
  }) : prepareArtifacts(root);assert.equal(artifacts.length,6);
  for(const artifact of artifacts.filter(a=>a.path.endsWith('.js'))) new vm.SourceTextModule(artifact.text);
});
test('all patched TypeScript modules transpile using the image compiler', {skip:!root || !fs.existsSync(`${root}/node_modules/tsx/package.json`)},()=>{
  const esbuild=createRequire(`${root}/node_modules/tsx/package.json`)('esbuild');
  for(const kind of ['tool-gateway','tool-access','connection-intents']) {
    const compiled=esbuild.transformSync(actual(kind),{loader:'ts',format:'esm',target:'es2023'}).code;
    new vm.SourceTextModule(compiled);
  }
});

// Execute the patched upstream dispatcher against in-memory auth/transport
// doubles, not a fixture reimplementation of its catch path.
function dispatcher(error,override={}) {
  const text=stripped('tool-gateway');
  const connection={id:'fixture-connection',config:{url:'https://memory.example.invalid/mcp'},authKind:'api_key',credentialSource:'paperclip_vault'};
  const trace={dispatches:0,health:[],grants:0,credentials:0};
  class GatewayError extends Error {constructor(status,message,reasonCode,details={}){super(message);Object.assign(this,{status,reasonCode,details});}}
  class McpError extends Error {constructor(reason){super('synthetic-protocol-failure');this.reason=reason;}}
  const context={
    ToolGatewayHttpError:GatewayError,McpHttpResponseError:McpError,RailwayError:class extends Error{},
    resolveConnectedRemoteTool:async()=>({connection,entry:{id:'fixture-tool',toolName:'capture_thought'}}),
    assertGoogleChatToolArgumentsSupported:()=>{},isRailwayConnection:()=>false,isBrowserUseConnection:()=>false,isRailwayEndpoint:()=>false,
    resolveConnectionGrant:async()=>{trace.grants++;return {id:'fixture-grant'};},
    resolvedRemoteEndpoint:async()=>connection.config.url,projectedConnectionHeaders:()=>({}),
    resolveCredentialHeaders:async()=>{trace.credentials++;return {};},
    buildRemoteHeaders:()=>({headers:{},summary:{}}),randomUUID:()=> 'synthetic-id',auditSafeEndpoint:x=>x,
    options:{remoteHttpRequest:async()=>{trace.dispatches++;if(error)throw error;return new Response('{}',{status:200});}},
    AbortController,setTimeout,clearTimeout,Buffer,Headers,
    isInsufficientConnectionScope:()=>false,asRecord:x=>x&&typeof x==='object'?x:{},
    mcpHttpRequestHeaders:x=>x,MAX_REMOTE_MCP_RESPONSE_BYTES:1048576,
    readBoundedRemoteResponse:r=>r.text(),
    readMcpHttpResponse:async()=>({result:{content:[{type:'text',text:'synthetic-success'}]}}),
    extractRemoteMcpPending:()=>null,extractMcpElicitationRequest:()=>null,
    normalizeMcpToolResult:x=>x,markRemoteConnectionHealth:async(_c,status,message)=>trace.health.push({status,message}),
    ...override,
  };
  const fn=evaluate(functionText(text,'executeRemoteHttpTool'),['executeRemoteHttpTool'],context).executeRemoteHttpTool;
  return {trace,call:()=>fn({agentId:'fixture-agent'},{}, {},100,'fixture-invocation'),McpError,GatewayError};
}
for(const [name,error,code] of [
  ['timeout',Object.assign(new Error('synthetic-timeout'),{name:'AbortError'}),'tool_timeout'],
  ['transport failure',new TypeError('synthetic-network-failure'),'mcp_remote_fetch_failed'],
]) test('actual '+name+' dispatches once, retains audit error and marks degraded', {skip:!root},async()=>{
  const d=dispatcher(error);
  await assert.rejects(d.call(),e=>e.reasonCode===code);
  assert.equal(d.trace.dispatches,1);assert.equal(d.trace.grants,1);assert.equal(d.trace.credentials,1);
  assert.equal(d.trace.health.at(-1).status,'degraded');
  assert(transientMessages.includes(d.trace.health.at(-1).message));
});
test('actual successful call restores ok health', {skip:!root},async()=>{
  const d=dispatcher();await d.call();assert.equal(d.trace.dispatches,1);assert.equal(d.trace.health.at(-1).status,'ok');
});
test('actual invalid key remains an error and is not retried', {skip:!root},async()=>{
  let sends=0;
  const d=dispatcher(null,{options:{remoteHttpRequest:async()=>{sends++;return new Response('{}',{status:401});}}});
  await assert.rejects(d.call(),e=>e.reasonCode==='mcp_remote_status');assert.equal(sends,1);assert.equal(d.trace.health.at(-1).status,'error');
});
test('actual invalid protocol response remains an error and is not retried', {skip:!root},async()=>{
  let d;
  d=dispatcher(null,{readMcpHttpResponse:async()=>{throw new d.McpError('invalid_json');}});
  await assert.rejects(d.call(),e=>e.reasonCode==='mcp_remote_invalid_json');
  assert.equal(d.trace.dispatches,1);assert.equal(d.trace.health.at(-1).status,'error');
});
test('actual missing credential blocks dispatch', {skip:!root},async()=>{
  const d=dispatcher(null,{resolveCredentialHeaders:async()=>{throw new Error('synthetic-missing-secret');}});
  await assert.rejects(d.call(),/synthetic-missing-secret/);assert.equal(d.trace.dispatches,0);
});
test('actual grant denial blocks dispatch', {skip:!root},async()=>{
  const d=dispatcher(null,{resolveConnectionGrant:async()=>{throw new Error('synthetic-grant-denied');}});
  await assert.rejects(d.call(),/synthetic-grant-denied/);assert.equal(d.trace.dispatches,0);
});
