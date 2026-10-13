# Experimental MCP recovery candidate

This is an unofficial compatibility candidate, not a supported upstream release
or a vulnerability-free image. Generic examples remain staged at zero replicas.

## Exact artifacts

- Upstream application commit: `467125fafb47a8520856504fecc48d6e32055db1`.
- Accepted base: `ghcr.io/gen-skeptic/paperclip-codex-mcp-compat@sha256:87868afb2c8becff04ba996e1dc9582ffee8b671f2e7b89c33c970151da9153e`.
- Candidate tag: `ghcr.io/gen-skeptic/paperclip-codex-mcp-compat:2026.1005.0-mcp-recovery1`.
- Candidate OCI manifest: `sha256:dbbd5d83f689bbb7eb86e756fb351ecf20a920bbe01935c980cd662e953ee4c1`.
- Candidate OCI config: `sha256:77db5578dc577c3d1677bbe9d810cdefbd6d653f2c8d6ab788fd025041cd6b82`.
- Patch SHA-256: `d23663eabeb74df5fbd67ce5839bea28721f24829ef65663bc1e1157337ed0aa`.
- Recipe SHA-256: `f6a0f9b2eb440b92710d5e54169bc5ddf70ac2ec5fdfba0b9b5fcb8b4979ba2b`.

The image's source label associates it with this companion repository. This
record is manual qualification/provenance, not a cryptographic attestation.
No image rebuild or config mutation is permitted between acceptance and push.

## Build and verification scope

The local Dockerfile engine could not build on its backing filesystem. An
isolated rootless VFS create/copy/apply/commit workflow replayed the reviewed
recipe with no network, no credentials, no production mounts and dropped
capabilities. The complete inherited runtime config was restored, with only the
recipe's explicit non-root user and four source/license/compatibility labels.
Do not claim that the published bytes were produced by the Dockerfile engine.

All 15 inherited filesystem layers were retained. Only six guarded public
application source/compiled service files, the patch script, and three license
notices changed. Package manifests, dependencies, UI, tools and credentials did
not change. Source and compiled artifacts were hash-checked; compiled modules
parsed and TypeScript transpiled. The dedicated candidate passed 25 regression
tests, including actual dispatcher functions with synthetic transports and
credentials. Existing adapter and Kubernetes contract fixtures also passed.

OCI conversion changed config/manifest serialization identifiers. Exact runtime
config, platform, creation metadata, history and all 16 uncompressed layer
hashes were verified across conversion. Do not equate a Docker config ID with
the converted OCI config ID.

A separately authorized, credential-free Kubernetes canary passed those same
25 regressions using the exact OCI manifest, UID/GID 1000, no capabilities,
no-new-privileges, a read-only root filesystem, disabled ServiceAccount token,
deny-all network policy, and existing scoped enforcing seccomp/AppArmor
profiles. It also proved inner Codex read success, write denial and network
denial. Temporary resources were removed; production remained unchanged.
This is version/profile-specific evidence, not a portable cluster guarantee.

## Security and release limits

Base and candidate were scanned with Trivy 0.74.0 and the same database updated
2026-10-12. Both contained 9 Critical, 187 High, 273 Medium, 174 Low and 30
Unknown vulnerability occurrences: zero added or removed findings and zero
secret findings. A CycloneDX SBOM with 2,202 components was generated. These
inherited findings remain; this is not a clean security pass, a finding
suppression, or a full exploitability/redistribution-license assessment.

Upstream MIT attribution and companion MIT notices are included. Dependencies
retain their own licenses; full-image redistribution review remains incomplete.
Do not promote this experimental candidate as a supported release on the
strength of this patch alone.

The full upstream typecheck/build/Vitest suite, live authenticated agent MCP
recovery, owner SSO, browser behavior and production rollout were not exercised
by this candidate's isolated checks. No model/provider or real memory tool call
was made. A call that timed out is never automatically replayed, especially a
write. After a separately approved deployment, refresh the existing catalog
once and verify effective read/write classification and live authorized access.

## Upstream tracking

[Upstream PR #11910](https://github.com/paperclipai/paperclip/pull/11910) is open
and addresses the timeout catalog latch, but is not present in this pinned base.
Its treatment of JSON-RPC and fetch failures differs from this narrow
transport-degraded compatibility path. This candidate also adds a bounded
30-second remote default and conservative `capture`/`index` risk escalation.
Retire overlapping compatibility code only after reviewing and testing an
upstream image that actually includes the applicable fixes.
