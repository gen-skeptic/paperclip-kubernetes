# Security policy

Experimental project; no supported production release yet. Do not send tokens,
cookies, private addresses, media metadata or full operational logs in issues.

Report sensitive vulnerabilities through GitHub's private vulnerability reporting
if enabled. Otherwise ask for a private reporting channel without disclosing
details publicly. Do not publish proof-of-exploit details before coordination.

No automatic deployment, agent execution, host profile installation or package
publication occurs in CI. Examples are staged at zero replicas. A successful
local test is not a security approval or live integration acceptance.

Inherited upstream image findings must be disclosed and reviewed, not suppressed
to obtain a green build. Read [release gates](docs/releases.md).
