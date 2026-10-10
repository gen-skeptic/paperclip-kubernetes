# Release and image gates

No supported release is published yet. Current examples and compatibility image
are experimental. Track upstream version/commit, source hash, base digest,
derived digest, bundled tool versions and exact test scope for every candidate.

Before promoting a public image:

1. Audit licenses/notices for the full bundled image, including any separate
   source-distribution requirements. Preserve upstream attribution.
2. Build from a pinned base in a credential-free context, with no production
   mounts or cache. Document any alternate build method honestly. Never include
   subscription login caches, MCP configuration or environment files.
3. Compare image layers/config and filesystem changes. Preserve expected tools,
   entrypoint and command; verify the actual loaded adapter artifact is patched.
4. Test multiple distinct fabricated managed gateways, quoted token handling,
   config permissions and real CLI parsing. Separately test authenticated MCP
   transport; fake HTTP fixtures are not enough.
5. Generate an SBOM, scan with a current database, distinguish inherited from new
   findings, and review applicability/remediation. Do not label inherited
   Critical/High findings as a clean scan or turn off scanning to pass CI.
6. Publish immutable digests with source association, build provenance and,
   when implemented, cryptographic attestations. Current documentation is not
   a signed supply-chain attestation. Verify anonymous access if Public, or
   separately reviewed read-only registry authentication if Private.
7. Prove live sandbox, owner SSO, API/MCP authorization, durable data identity
   and rollback in a separately approved environment before supported release.

The historical candidate used upstream Paperclip v2026.1001.0 / commit
`8f8a0ab7effbd6a0584107d8038736c134ee5047` and bundled Codex 0.159.2. Its patch
has an upstream equivalent at https://github.com/paperclipai/paperclip/pull/12287.
Remove the patch when a reviewed upstream image includes the correction; never
silently repatch an unknown hash. Future matrix rows need fresh evidence.

CI only runs credential-free static/rendering and synthetic patch checks. It
does not build/publish images, provision cloud resources or deploy workloads.
