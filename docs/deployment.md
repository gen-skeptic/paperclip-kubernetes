# Deployment contract

The examples deliberately omit Namespace creation, credentials and database
provisioning. They remain at zero replicas and must be adapted/reviewed by an
operator before activation. No live installation is performed by this project.

## Prerequisites

1. Choose and audit a digest-pinned application image. Do not activate the
   historical candidate solely because these fixture checks pass.
2. Provide namespace `paperclip` and a protected `paperclip-runtime` Secret with
   `DATABASE_URL`, `BETTER_AUTH_SECRET` and `PAPERCLIP_SECRETS_MASTER_KEY`.
   Never paste those values into Git, a public issue or build context.
3. Provide supported external PostgreSQL, an application role with no superuser
   rights, tested connectivity and enough migration permissions. The sample
   database egress selector assumes a CNPG `paperclip-db` cluster in the same
   namespace; adapt it narrowly if your database topology differs.
4. For a durable database, review three-instance placement/anti-affinity,
   synchronous durability, continuous archiving, an initial and scheduled backup,
   and an isolated read-only restore comparison. These are requirements, not
   resources silently created by the app example.
5. Review the `paperclip-files` PVC and storage class. The sample local-path RWO
   volume does not automatically fail over to another node. Set compatible node
   placement after binding; moving the Deployment is not a storage migration.
   Capture files, encrypted configuration and database as a coordinated recovery
   set; restore proof is needed before relying on it.
6. Bootstrap the first owner using upstream's reviewed workflow under separate
   authorization. Signup and heartbeat scheduling remain disabled in the example.
   No owner, organization, agent or API key is created by this repository.

## Activation acceptance

Record database, backup, PVC/PV, application and existing workload identities
before an exact-revision rollout. Bound the wait; check readiness stable through
liveness periods, image IDs, zero unexpected restarts, non-root identities,
tokenless ServiceAccount, restricted filesystem/capabilities and unchanged
protected resources. Preserve failed evidence, sanitized and mode 0600.

Prove authenticated loopback API and managed MCP transport using run-bound
credentials without printing request headers or private bodies. A fake HTTP
fixture or CLI config parser is not a production transport acceptance.

Codex's inner sandbox may require compatible scoped AppArmor/seccomp profiles
on some Kubernetes hosts. RuntimeDefault alone was not sufficient in the
original environment. No portable host profile is installed or promised here.
Review the exact kernel/runtime, use a credential-free canary proving read
success and denied write/network cases, and retain non-root/no-new-privileges,
capabilities dropped and restricted outer networking. Do not bypass the sandbox
to complete onboarding. Scoped profile examples are future work.

After acceptance, resume only explicitly approved agent work. Require a clear
task disposition to prevent unintended automatic corrective repeats.
