# Deployment Guide

Thoughty runs on the shared K3s platform [`swirl-cloud`](https://github.com/chefzaid/swirl-cloud) at `https://thoughty.swirlit.dev`. The platform provides shared services (GitLab, Argo CD, Vault, Traefik, PostgreSQL, Redis, Keycloak, monitoring). This repository owns CI, Vault contracts, the Argo CD `Application`, manifests, and DNS. Day-2 work is in the [Operations Runbook](./operations.md); first-time setup is in [Repository Onboarding](./onboarding.md).

## Workloads and Profiles

| Workload | Notes |
|---|---|
| `thoughty-web` | NGINX serving the React build; 2 replicas |
| `thoughty-server` | NestJS API on port `3001`; 2 replicas |
| `thoughty-cloud-sync-worker` | same image as the API; runs cloud sync, memoir delivery, and the recycle-bin and account purges; always 1 replica |
| `postgres-backup` | daily `pg_dump` CronJob; suspended in production until configured |

| Profile | Use |
|---|---|
| `infra/k8s/overlays/swirl-cloud` | production in `apps`, deployed by Argo CD |
| `infra/k8s/overlays/swirl-cloud-canary` | canary, applied by hand on top of production |
| `infra/overlays/ha` | opt-in multi-node production |
| `infra/k8s/overlays/standalone` | independent install in `thoughty` |

Overlays build on `infra/k8s/base` and `infra/k8s/components`. Render one with `kubectl kustomize <dir>`.

## Production Desired State

Argo CD syncs `infra/k8s/overlays/swirl-cloud` from `main` of `swirlit/thoughty` into `apps`, with prune and self-heal. Sync order:

1. Wave `-2`: ConfigMap and External Secrets.
2. Wave `-1`: `thoughty-db-setup` hook creates the `thoughty` role and database if missing.
3. Wave `0`: `thoughty-db-migrate` hook runs `node dist/scripts/migrate.js` from the release image.
4. Wave `1`: API, web, and worker Deployments.
5. PostSync: `thoughty-kibana-bootstrap` imports the log dashboard.

The setup hook and the `postgres-backup` CronJob run the PostgreSQL client image set under `images:` in the overlay's `kustomization.yaml`: `docker.io/library/postgres:18.6-alpine3.24`, pinned by its multi-arch index digest (amd64 and arm64 among others), not a single-platform manifest. Its major version must be at least the platform server's (PostgreSQL 18), or `pg_dump` refuses to dump. To update it, take the tag's index digest (the `Docker-Content-Digest` of the tag's manifest, or `digest` from `https://hub.docker.com/v2/repositories/library/postgres/tags/<tag>`), scan it as in [Security](./security.md#container-images), and change `newTag` and `digest` together.

The UI and `/api` are public, so local accounts can register and sign in. Only `/api/auth/sso` (`overlays/swirl-cloud/sso-ingress.yaml`, and the matching canary routes) goes through the `thoughty-sso` ForwardAuth Middleware and the shared Keycloak OAuth2 Proxy; as the longer path it wins over `/api` (see [Security](./security.md#authentication-and-sessions)). Every route caps request bodies at 10 MiB (`thoughty-upload-limit`), except `POST /api/attachments/upload`: its own Ingress (`thoughty-upload-ingress`, exact path, patched by `overlays/swirl-cloud/upload-ingress-patch.yaml`; the canary IngressRoute has the matching routes) uses `thoughty-video-upload-limit`, 51 MiB, for videos of up to 50 MB with their multipart framing. Traefik's buffering middleware keeps the first 1 MiB of a body in memory and the rest on disk. The API writes each upload to `/tmp` (the pod's `tmp` emptyDir, as the root filesystem is read-only) and streams it to object storage, so a video never sits whole in the server's 512 Mi of memory; allow `/tmp` room for a few concurrent 50 MB uploads. Where the web image's NGINX proxies `/api` itself, it allows 51 MB bodies (`client_max_body_size`).

## Configuration and Secrets

Non-secret settings are in `infra/k8s/base/configmap.yaml`, overridden by `infra/k8s/overlays/swirl-cloud/configmap-patch.yaml` (hosts, `CORS_ORIGIN`, `FRONTEND_URL`, `KEYCLOAK_*`). The S3 and backup endpoints are AWS placeholders; set them before enabling attachments or backups.

| Vault KV path | Contents |
|---|---|
| `apps/thoughty/database` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `apps/thoughty/app` | signing, encryption, S3, AI, OAuth, and SMTP values |
| `apps/thoughty/backup` | backup bucket credentials |
| `apps/thoughty/registry` | read-only registry pull credential |
| `infra/postgres` | shared database admin, setup hook only |

Always set `CONFIG_ENCRYPTION_SECRET`: the API and worker do not start without it, and losing it makes stored provider tokens unreadable. Always set `JWT_SECRET` and `REFRESH_SECRET` (and `TWO_FACTOR_SECRET` and `UNSUBSCRIBE_SECRET`) to at least 32 random characters: in production the API and worker refuse to start when one is missing or an example value. `UNSUBSCRIBE_SECRET` signs the unsubscribe links in the "On this day" and monthly recap emails; until it is in Vault both processes derive one from `JWT_SECRET` (the standalone Vault Agent templates export it only when the key exists), so an existing deployment keeps working, and adding it later only voids the links in emails already sent. Onboarding and `infra/scripts/configure-gitlab.sh` generate these and the database password when missing, and never overwrite them; re-run onboarding on an existing deployment to add `UNSUBSCRIBE_SECRET`. Other values start empty. `TRUST_PROXY` must match the proxies in front of the API (swirl-cloud sets `2` in its ConfigMap patch; see [Security](./security.md#abuse-controls)). Google sign-in needs `GOOGLE_CLIENT_ID` on the server, equal to the web's build-time `VITE_GOOGLE_CLIENT_ID`; production signs in through Keycloak and sets neither. Never commit secrets. Full list: [Security](./security.md#secrets).

## Delivery Pipeline

| Stage | Jobs | Behavior |
|---|---|---|
| `build` | `01-build` → `02-test` → `03-package` | Build and package must pass. Tests and the 80% coverage rule only report. |
| `verify` | `01-e2e`, `02-quality`, `03-security` | Reports only. E2E is manual. SonarQube runs automatically on `main`. Trivy is manual. |
| `release` | `01-release` → `02-deploy` | Needs only build and package. |
| `version` | `set-major-version` | Manual; sets `<NEW_MAJOR_VERSION>.0.0`. |

Release is manual on `main`. It runs automatically from **Run pipeline** with `PIPELINE_MODE=full` (which also runs quality and security) and from onboarding pipelines. It never runs on other branches, merge requests, or `SONAR_SCAN_ONLY=true` pipelines, which the platform starts when analysis is older than 24 hours.

`01-release`:

1. Builds and pushes `registry.swirlit.dev/swirlit/thoughty/thoughty-{server,web}:<version>` with Kaniko.
2. Uploads both archives and `SHA256SUMS` to the Generic Package Registry.
3. Stops if `main` moved during the pipeline.
4. Commits `release: <version>` with the new image tags, tags `v<version>`, commits the next minor baseline, and pushes.
5. Creates a GitLab Release.

`02-deploy` applies the `Application`, hard-refreshes it, waits up to 15 minutes for the pushed commit to be `Synced` and `Healthy`, then smoke-checks the internal API and web URLs. Release jobs share the `thoughty-production` resource group. CI artifacts expire after 7 days.

**Versioning.** [`VERSION`](../VERSION) holds the baseline (for example `1.9.0`). Each later first-parent commit adds one to the patch. Releasing `1.9.3` prepares `1.10.0`. Only `set-major-version` changes the major number.

**Repository sync.** `.github/workflows/sync-gitlab.yml` mirrors every GitHub and GitLab push without force-pushing or rewriting tags.

**Admin helpers.** `infra/scripts/configure-gitlab.sh` (manual, on the control-plane host, with `GITLAB_ADMIN_TOKEN` and `GITHUB_ADMIN_TOKEN`) reconciles project settings, SonarQube, sync credentials, Vault values, and the `Application`. `ansible-playbook -i infra/ansible/inventory.ini infra/ansible/site.yaml` re-syncs committed `main` without a pipeline.

## Public DNS

This repository owns the app host record; the platform supplies the zone, TLS, and ingress. Use a proxied Cloudflare record:

| Mode | Record |
|---|---|
| Direct ingress | `A` to `kubectl get service traefik -n infra -o jsonpath='{.status.loadBalancer.ingress[0].ip}'` |
| HA Tunnel | `CNAME` to `<publishedTunnelID>.cfargotunnel.com`, only after HA activation succeeds |

Get the tunnel target (no output means not ready):

```sh
kubectl get configmap swirl-cloud-public-ingress -n infra -o json | \
  jq -er '.data | select(.mode == "tunnel" and .domain == "swirlit.dev" and
    .publishedTunnelID != null and .publishedTunnelID != "" and
    .publishedTunnelID == .tunnelID) | .publishedTunnelID + ".cfargotunnel.com"'
```

Remove conflicting A/AAAA/CNAME records for the host first, keep MX and TXT, then check the URL and API health.

## Other Profiles

### Canary (`infra/k8s/overlays/swirl-cloud-canary`)

Adds one-replica `thoughty-server-canary` and `thoughty-web-canary`, the `thoughty-canary-ingress` IngressRoute, and weighted TraefikServices. Config, secrets, and auth stay with the stable profile. Argo CD does not manage it.

- Replace the placeholder `canary` image tags with published versions.
- It has no migration hook. Only canary a version whose migrations are applied and safe for the stable version.
- It has no worker. The worker moves with the next release.

Steps: [canary runbook](./operations.md#canary-rollouts).

### Multi-node HA (`infra/overlays/ha`)

Spreads the API and web replicas across two nodes and adds a PodDisruptionBudget for each. The worker stays single: its lease recovers jobs, but sync is not exactly-once ([ADR 0006](./adr/0006-database-backed-cloud-sync-worker.md)). To enable, commit `spec.source.path: infra/overlays/ha` in `infra/argocd/application.yaml`. First confirm the shared services survive a host loss, and test login, attachments, throttling, and a node drain.

### Standalone (`infra/k8s/overlays/standalone`)

Bundles PostgreSQL 16 with WAL archiving, Redis, the worker, and an active backup CronJob. Secrets come from Vault Agent: see [Standalone Vault Setup](./standalone-vault.md). Before applying, set image references, the ingress host and TLS secret, `CORS_ORIGIN`, `FRONTEND_URL`, and the S3 and backup endpoints. It needs Traefik with Ingress and CRD providers. It has no migration hook: [run migrations](./operations.md#migrations) after each deploy. Never apply it to the production cluster.

## Rollback and Database Safety

Roll back in Git. Argo CD reverts `kubectl set image`.

1. Run `infra/scripts/set-image-tags.sh <previous version>`.
2. Commit and push `infra/k8s/overlays/swirl-cloud/kustomization.yaml` to `main`.
3. Let Argo CD sync.

Migrations only move forward and a rollback does not undo them, so the previous image must work with the current schema. Fix schema problems with a new migration, never by editing an applied one. Back up before a risky schema release.
