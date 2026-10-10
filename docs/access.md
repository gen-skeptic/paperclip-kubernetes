# Browser, local-agent and remote-agent access

These are separate authentication paths; a browser SSO session is not an agent
credential.

- Browser: HTTPS reverse proxy, optional Pangolin Platform SSO with Authentik,
  then Paperclip's native session. Outer SSO does not automatically log an owner
  into the native application.
- In-pod agents: server-level `PAPERCLIP_API_URL=http://127.0.0.1:3100`, with
  run-bound Paperclip authentication. Public/authentication origins remain HTTPS
  in the public overlay. Loopback avoids the browser gateway; it does not remove
  native authorization.
- Remote agents: separately reviewed reachable machine transport and scoped
  authorization. `127.0.0.1` points to their own host, not the Paperclip pod.
  Do not disable human SSO or publish unauthenticated API exceptions to make
  remote callbacks work.

## Optional Pangolin overlay

Set your real domain and two actual Newt instance labels; `agents.example.invalid`,
`site-a` and `site-b` are placeholders. Existing connectors need their own
reviewed outbound policy. Create one frontend HTTPS resource and two HTTP targets
to `paperclip.paperclip.svc.cluster.local:3100`, with `/api/health` checks.
Preserve original Host, HTTPS forwarding headers and WebSockets. Do not enable
backend TLS, rewrite paths or sticky sessions unless separately needed/tested.
Enable the intended human SSO and owner authorization at the gateway.

Check host-header behavior in your pinned release: Kubernetes probes connect to
the pod IP but send `Host: localhost`; do not set their connection host to
localhost. Verify both target paths separately and unauthorized browser denial.
The overlay creates no DNS, Pangolin resource or Ingress.

## Adding connections

Register compatible MCP/connector connections centrally, bind credentials once,
and grant the intended company/agents access. Avoid hand-copying generated Codex
configuration. The compatibility patch applies to every managed gateway, not
specific agent names.

New destinations still require scoped egress review. Standard NetworkPolicy
IP rules are not automatic DNS-name allowlists; resolve/version/monitor approved
destinations or review a suitable FQDN-capable policy implementation. Do not add
unrestricted internet egress as a convenience workaround.

Company boundaries inside Paperclip do not automatically isolate external
memory or secret stores. Test cross-company denial, least-privilege tool grants,
expiry/revocation and callback authentication. Infrastructure administration
requires its own authority; a connection grant is not that authority.
