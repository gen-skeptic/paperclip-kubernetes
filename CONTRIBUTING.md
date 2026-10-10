# Contributing

Prefer small, portable changes with tests. Search upstream Paperclip issues/PRs
before introducing an application patch; avoid maintaining redundant fixes.

Use placeholder domains and identities. Never commit runtime credentials,
encrypted production Secrets, authentication caches, personal accounts, real
cluster identifiers or raw evidence. Synthetic tokens in test fixtures must be
obviously fabricated and must never authenticate to a real service.

Changes must preserve staged defaults, human SSO, native machine authorization,
non-root execution, disabled ServiceAccount tokens and restricted networking.
Document any new trust boundary and prove negative cases as well as success.
Do not resolve sandbox failures by enabling privileged containers or globally
relaxing host sysctls. Any scoped profile needs a credential-free canary and
runtime/version-specific acceptance before use.

Run both validation commands in the README. Describe what was actually tested
and what remains unverified. Keep copyright notices for adapted upstream work.
