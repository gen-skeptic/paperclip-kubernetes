# Paperclip Kubernetes companion

Unofficial, experimental deployment examples and compatibility tooling for
[Paperclip](https://github.com/paperclipai/paperclip). This is not a fork of the
application or an official Paperclip release. Keep application fixes upstream
where possible; retire compatibility patches once a reviewed upstream release
contains them.

## What is here

- A staged, non-root Kubernetes application example with persistent files,
  private ClusterIP exposure, restricted networking and host-aware probes.
- An optional Pangolin/Newt ingress overlay and human-versus-machine access guide.
- A hash-guarded shared Codex MCP header-generator compatibility patch and tests.
- A separately staged, hash-guarded MCP timeout-recovery and mutation-risk patch.
- Database, backup, sandbox, release and license-review acceptance checklists.

**Nothing is installed automatically.** Both examples have **zero replicas**.
They require an existing database, protected runtime Secret, storage review and
explicit operator activation. No credentials, account records, production
configuration or real operational evidence are included.

## Status and limitations

This first release is a starter, not a turnkey production distribution. Local
rendering, invariants and patch fixtures are tested; deployment of these generic
examples, full authenticated MCP transport, disaster recovery and browser SSO
are not accepted here. The original environment's tests do not certify yours.

The example references the historical compatibility image
`ghcr.io/gen-skeptic/paperclip-codex-mcp-compat@sha256:30577d8e9c171294338aca4adb3862011d2a5dd699d7224f8c3d2da54df47573`.
It was published privately and must not be assumed anonymously pullable. Its
2026-10-10 scan reported 11 Critical and 196 High package finding occurrences,
all inherited from the pinned upstream base. This is **not a clean security
PASS** or an exploitability assessment. Review or remediate the findings before
activating. Do not describe the candidate as hardened.

The image recipe here additionally includes explicit license notices and source
labels. It is a **future build recipe**, not byte-identical provenance for the
historical image. No image is built or published by this repository's CI.

## Validate locally

Requires Python 3, Node.js 22+, kubectl with Kustomize, and PyYAML 6.0.3.
Use a project virtual environment; do not change system Python:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-validation.txt
.venv/bin/python tests/check_examples.py
node --test images/compat/patch-adapter.test.mjs
node --experimental-vm-modules --test images/compat/patch-mcp-recovery.test.mjs
kubectl kustomize examples/base
kubectl kustomize examples/pangolin
```

These are local rendering commands, **not** `kubectl apply`. Before installation,
follow [deployment acceptance](docs/deployment.md), [access design](docs/access.md)
and [release/security policy](docs/releases.md).

## Staged MCP recovery patch

See the [experimental candidate qualification](docs/candidates/mcp-recovery1.md)
for the exact tested digest, alternate local build method, inherited findings
and limits. Publishing a candidate does not activate these zero-replica examples.

`images/compat/patch-mcp-recovery.mjs` targets exactly six source/compiled
artifacts from upstream commit `467125fafb47a8520856504fecc48d6e32055db1` in the
qualified image pinned by `images/compat/Dockerfile.mcp-recovery`. All hashes and
markers are validated before any build-time write. Unknown versions, symlinks
and previously patched files are rejected. The older recipe is unchanged.

The patch gives remote MCP tool calls a 30-second default deadline, retaining
the 60-second maximum and explicit caller deadlines. Other tool defaults stay
at 10 seconds. A timeout or transport exception marks health degraded rather
than hiding the last active, unquarantined catalog. Only the exact two transport
failure messages qualify for this recovery path; missing credentials, HTTP
authentication failures, malformed protocol responses and unrelated degraded
states retain their existing attention/error behavior. A successful explicit
call restores health. No timed-out call, especially a write, is replayed.

Company, active/enabled connection, catalog, install, grant, profile, policy,
actor, credential and endpoint guards remain mandatory. The gateway audit still
records the timeout/fetch failure. Cached tools do not confer new permissions.

The `capture` and `index` mutation verbs are recognized in namespaced and
camelCase tool names. Catalog refresh labels these as writes, and runtime risk
is conservatively escalated even for old cached entries. Explicit higher risk
is never downgraded. Gateway risk metadata/annotations use the effective risk.
After a separately approved rollout, refresh the existing catalog once to fix
stored UI labels; do not recreate a connection, replace keys, replay uncertain
writes or broaden its audience just to recover from a timeout.

The default test command runs synthetic fixtures. Setting
`PAPERCLIP_MCP_SOURCE_ROOT` to an inert copy's server directory adds pinned
upstream dispatcher tests with fake transports and credentials. When that copy
also contains the image's compiled modules and compiler, tests check all six
artifacts and transpile the patched TypeScript. These tests never run a model,
call a provider or access a real database. They are not a substitute for the
upstream full typecheck/build/Vitest suite or an approved deployment canary.
Neither this future recipe nor any live rollout is automatically executed.

## Future development

Contribute portable deployment improvements here. For application changes,
search upstream issues/PRs first, then use a contribution fork if needed. The
header fix already has [an upstream PR](https://github.com/paperclipai/paperclip/pull/12287).
Keep personal GitOps configuration in its own consumer repository.

Planned work: reproducible published releases with attestations/SBOMs; additional
Kubernetes/runtime compatibility tests; CNPG and backup examples; scoped sandbox
canaries; storage migration; and remote-agent/MCP authorization acceptance.
These are planned features, not current guarantees.

## License

Original companion code is MIT licensed. Preserve the upstream MIT notice in
`third_party/PAPERCLIP-LICENSE` for adapted or redistributed Paperclip code.
Bundled image components have their own terms; this repository does not claim a
completed full-image redistribution/license audit. See [NOTICE](NOTICE.md).
