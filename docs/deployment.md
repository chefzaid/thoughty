# Deployment Guide

Thoughty runs in production on the shared bare-metal K3s platform managed by [`swirl-cloud`](https://github.com/chefzaid/swirl-cloud), at `https://thoughty.swirlit.dev`. The platform owns the generic services (GitLab runner, Argo CD, Vault, External Secrets, registry, Traefik ingress, PostgreSQL, Redis, Keycloak, monitoring). This repository owns everything Thoughty-specific: its GitLab project settings, Vault contracts, Argo CD `Application`, Kubernetes manifests, and public DNS.

This guide is the single reference for the delivery pipeline, versioning, deployment profiles, secrets, and rollback. Day-2 checks and troubleshooting live in the [Operations Runbook](./operations.md); first-time registration with the platform is covered by [Repository Onboarding](./onboarding.md).

## Components

| Workload | Image | Notes |
|---|---|---|
| `thoughty-web` | `thoughty-web` | React build served by unprivileged NGINX |
| `thoughty-server` | `thoughty-server` | NestJS API on port `3001`; `/api/health` and Prometheus `/api/metrics` |
| `thoughty-cloud-sync-worker` | `thoughty-server` | Scheduled cloud sync; always a single replica |
| `postgres-backup` | public PostgreSQL 18.6 (digest-pinned) | Daily logical backup CronJob; suspended until configured |

The database setup and migration hooks also reuse these images.

## Infrastructure Layout

| Directory | Responsibility |
|---|---|
| `infra/argocd/` | the Argo CD `Application` (`application.yaml`) |
| `infra/k8s/base/` | reusable workload resources; never deployed directly |
| `infra/k8s/components/` | reusable Kustomize components (worker, canary, monitoring) |
| `infra/k8s/overlays/` | complete deployable profiles: `swirl-cloud`, `swirl-cloud-canary`, `standalone` |
| `infra/overlays/ha` | opt-in multi-node profile composed from `swirl-cloud` |
| `infra/ansible/` | optional operator refresh of committed GitOps state |
| `infra/compose/` | local development services |
| `infra/scripts/` | idempotent configuration and repository helpers |

Names use lowercase kebab-case and `.yaml`. Patch files end in `-patch.yaml`, hook jobs in `-job.yaml`, and every deployable directory has a `kustomization.yaml`.

Render the profiles locally without touching a cluster:

```bash
kubectl kustomize infra/k8s/overlays/swirl-cloud >/dev/null
kubectl kustomize infra/overlays/ha >/dev/null
kubectl kustomize infra/k8s/overlays/standalone >/dev/null
```

## Production Desired State

Argo CD reads `infra/k8s/overlays/swirl-cloud` from `swirlit/thoughty` in the cluster GitLab and deploys it to the `apps` namespace. The overlay contains:

- the API, web, and worker Deployments;
- the Ingress for `thoughty.swirlit.dev` with the `swirlit-dev-tls` certificate;
- External Secrets for runtime, backup, registry, and database-administrator values;
- a database setup hook (sync wave `-1`) that idempotently creates the `thoughty` login and database;
- a TypeORM migration hook (sync wave `0`) that runs `node dist/scripts/migrate.js` from the release image;
- the runtime Deployments (sync wave `1`).

Argo CD, not CI, creates, prunes, and self-heals workloads.

### Ingress and authentication

The UI is public. API routes pass through an app-owned Traefik ForwardAuth Middleware backed by the platform's shared Keycloak OAuth2 Proxy, which preserves login return URLs and forwards the signed access token to the API (see [Security](./security.md#authentication-and-sessions)). Both routes have a 10 MiB request limit. The base `ingress.yaml` owns routing and the request-limit Middleware; the `swirl-cloud` overlay adds `ingress-middleware.yaml`. `KEYCLOAK_ISSUER`, `KEYCLOAK_JWKS_URI`, and `KEYCLOAK_AUDIENCE` are non-secret overlay settings. Thoughty also appears in the cluster Homepage `Applications` group.

## Configuration and Secrets

Non-secret runtime values live in `infra/k8s/base/configmap.yaml`, adjusted for production by `infra/k8s/overlays/swirl-cloud/configmap-patch.yaml`. Production secrets come from Vault through External Secrets:

| Vault KV path | Contents |
|---|---|
| `apps/thoughty/database` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `apps/thoughty/app` | signing, encryption, storage, AI, OAuth, and mail settings |
| `apps/thoughty/backup` | object-store credentials for database backups |
| `apps/thoughty/registry` | read-only registry pull credential |
| `infra/postgres` | shared database administrator, used only by the setup hook |

Onboarding (or `infra/scripts/configure-gitlab.sh`) creates strong required database, signing, and encryption values when they are missing and never overwrites existing ones. Optional storage, AI, cloud-provider, SMTP, and backup values start empty; populate them before enabling the matching feature. Never commit secret values or create plaintext Kubernetes Secrets in Git. The full secret list is in [Security](./security.md#secrets).

## Delivery Pipeline

GitLab CI (`.gitlab-ci.yml`) exposes four stages with explicitly ordered jobs:

| Stage | Jobs | Behavior |
|---|---|---|
| `build` | `01-build` → `02-test` → `03-package` | Build and package are required. Tests are non-blocking; the 80% coverage rule reports but does not gate. |
| `verify` | `01-e2e`, `02-quality`, `03-security` | Independent reports that never gate a release. E2E is always manual. Quality (SonarQube) runs automatically on the default branch. Security (Trivy dependency, IaC, and secret scans) is manual in standard mode. |
| `release` | `01-release` → `02-deploy` | Release needs only the required build path; deploy starts after release publishes successfully. |
| `version` | `set-major-version` | Manual; prepares `<major>.0.0` from the `NEW_MAJOR_VERSION` variable. |

**When release runs.** On `main`, release is manual for push-triggered pipelines. Starting a pipeline from **Run pipeline** with `PIPELINE_MODE=full` also runs quality and security automatically and releases and deploys without a manual step. `SONAR_SCAN_ONLY=true` pipelines (requested automatically by the platform when analysis is missing or older than 24 hours) run only build, tests, and quality, and can never release.

**What release does.**

1. Consumes the successful server and web build artifacts.
2. Publishes immutable server and web archives plus `SHA256SUMS` to the Generic Package Registry.
3. Builds and pushes immutable images with daemonless Kaniko (30-day registry layer cache, unprivileged runners):
   `registry.swirlit.dev/swirlit/thoughty/thoughty-server:<version>` and `.../thoughty-web:<version>`.
4. Refuses to continue if `main` advanced during the pipeline.
5. Commits the release version and both Kustomize image tags, then creates the annotated Git tag.
6. Commits the next minor version baseline.
7. Creates a GitLab Release linked to both packages.

**What deploy does.** It applies and hard-refreshes the Argo CD `Application`, waits for that exact commit to be `Synced` and `Healthy`, then checks the internal API and web endpoints. Deployments are serialized through the `thoughty-production` resource group.

CI reports and build outputs are kept for seven days; release archives are immutable in the package registry, and SonarQube keeps long-term quality history.

### Versioning

[`VERSION`](../VERSION) owns the application version and starts at `1.0.0`. Each new first-parent commit advances the patch number used by builds (`1.0.1`, `1.0.2`, ...). A release tags and deploys that exact version, then prepares the next minor baseline with the patch reset (releasing `1.0.3` prepares `1.1.0`). `set-major-version` is the only supported way to change the major number, and every npm manifest is synchronized with each prepared baseline.

### Repository synchronization and bootstrap

Every GitHub push runs `.github/workflows/sync-gitlab.yml`, and every GitLab branch or tag push dispatches the same workflow (including `[skip ci]` commits). It fast-forwards the lagging side, merges divergent branches without force-pushing, refuses to rewrite conflicting tags, and rotates its managed GitLab token monthly.

`infra/scripts/configure-gitlab.sh` is a manual administration helper, separate from onboarding. Run it with `GITLAB_ADMIN_TOKEN` and `GITHUB_ADMIN_TOKEN` to reconcile project metadata, labels, `main` protection, merge safeguards, cleanup policies, badges, the linked SonarQube project and masked `SONAR_TOKEN`, encrypted GitHub sync credentials, the push/tag webhook, Vault values under `apps/thoughty/*`, and the Argo CD `Application`. It needs `kubectl`, `curl`, `git`, `jq`, `openssl`, `python3`, `libsodium`, and `sudo` on the control-plane host.

### Operator refresh

To re-reconcile committed `main` without a pipeline (it never deploys uncommitted changes):

```bash
ansible-playbook -i infra/ansible/inventory.ini infra/ansible/site.yaml
```

It applies the Argo CD `Application`, requests a hard refresh, waits for a new `Synced`/`Healthy` reconciliation, and verifies all three Deployment rollouts.

## Public DNS

This repository owns the `thoughty.swirlit.dev` record; the platform supplies the zone, TLS, ingress, and the optional HA Tunnel. Onboarding asks the platform to reconcile exactly this host. For a customized installation, use the host and zone saved by onboarding.

- **Direct ingress:** a proxied Cloudflare `A` record pointing at the public ingress IPv4:
  ```sh
  kubectl get service traefik -n infra -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
  ```
- **HA Tunnel:** after the platform's HA activation succeeds, switch to a proxied `CNAME` targeting `<publishedTunnelID>.cfargotunnel.com`. Confirm the published checkpoint first; no output means it is not ready:
  ```sh
  kubectl get configmap swirl-cloud-public-ingress -n infra -o json | \
    jq -er '.data | select(.mode == "tunnel" and .domain == "swirlit.dev" and
      .publishedTunnelID != null and .publishedTunnelID != "" and
      .publishedTunnelID == .tunnelID) | .publishedTunnelID + ".cfargotunnel.com"'
  ```

Before changing a record, review conflicting A/AAAA/CNAME records for the exact hostname and preserve unrelated records such as MX and TXT. Verify the public URL and API health afterwards.

## Other Profiles

### Canary (`infra/k8s/overlays/swirl-cloud-canary`)

Adds `thoughty-server-canary`, `thoughty-web-canary`, the `thoughty-canary-ingress` IngressRoute, and two weighted TraefikServices on top of the stable profile, which keeps ownership of shared configuration, credentials, authentication, request limits, and NetworkPolicy. Set both image references to published candidate versions first (the `canary` tags are placeholders). The worker is promoted only after the API and web candidates are accepted. Traffic shifting and rollback steps are in the [canary runbook](./operations.md#canary-rollouts).

### Multi-node HA (`infra/overlays/ha`)

Composes `swirl-cloud` with two API and two web replicas, hostname spreading across two eligible nodes, and per-Deployment disruption budgets. The worker stays at one replica: its database lease makes interrupted jobs recoverable, but a cancelled request cannot undo an upload a provider already accepted, so sync is not exactly-once (see [ADR 0006](./adr/0006-database-backed-cloud-sync-worker.md)).

To opt in, commit `spec.source.path: infra/overlays/ha` in `infra/argocd/application.yaml` and reconcile; a live-only override is lost on the next release. Image updates still go to the `swirl-cloud` overlay and are inherited. PostgreSQL, Redis, object storage, Keycloak, and ingress must each survive losing a host, and the trusted proxy/client-IP path must be validated before relying on shared throttle counters. Before enabling, exercise login and refresh across API replicas, journal writes, attachment upload/download, shared throttling, and an eligible-node drain.

### Standalone (`infra/k8s/overlays/standalone`)

An independent installation with its own namespace (`thoughty`), PostgreSQL (with WAL archiving), Redis, Vault Agent secret templates, placeholder ingress, worker, and backups. It requires Traefik with the Kubernetes Ingress and CRD providers, strict prefix matching, and HTTP-to-HTTPS redirection. Set host/TLS, object storage, image references, and Vault roles and values first; see [Standalone Vault Setup](./standalone-vault.md). Never apply standalone resources to the production cluster.

## Rollback and Database Safety

Roll back by reverting the release commit or changing the image tags in Git and letting Argo CD reconcile. Live `kubectl set image` changes are reverted by self-healing and are not a rollback.

TypeORM records applied migrations. Fix schema problems with a new forward migration, never by editing an applied one; test fresh-install and upgrade paths, and take a database backup before a risky schema release.
