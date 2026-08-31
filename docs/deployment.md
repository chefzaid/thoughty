# Deployment Guide

Thoughty provides a production profile for the shared bare-metal cluster and a standalone profile for independent installations. The production profile is described in [Server Deployment](./server-deployment.md) and is the only profile changed automatically by `.gitlab-ci.yml`.

## Infrastructure Layout

Thoughty follows the shared application-repository convention used by DevApp and Indezy:

| Directory | Responsibility |
|---|---|
| `infra/ansible/` | optional manual reconciliation of committed GitOps state |
| `infra/argocd/` | the single Argo CD `Application` bootstrap at `application.yaml` |
| `infra/compose/` | local Compose configuration |
| `infra/k8s/base/` | reusable workload resources; never deployed directly as an environment |
| `infra/k8s/components/` | reusable Kustomize components such as worker, canary, and monitoring |
| `infra/k8s/overlays/` | complete environment-specific desired state |
| `infra/scripts/` | idempotent configuration and repository helpers |

Names use lowercase kebab-case and YAML files use `.yaml`. Workload files use the logical component name because each may contain more than one Kubernetes resource kind. Patch files end in `-patch.yaml`; hook jobs end in `-job.yaml`; each deployable directory has `kustomization.yaml`.

Production entry points:

- Ansible: `infra/ansible/site.yaml` with `infra/ansible/inventory.ini`
- Argo CD: `infra/argocd/application.yaml`
- Kubernetes: `infra/k8s/overlays/bm-cluster/kustomization.yaml`
- GitLab bootstrap: `infra/scripts/configure-gitlab.sh`
- immutable image-tag update: `infra/scripts/set-image-tags.sh`

Other profiles:

- standalone: `infra/k8s/overlays/standalone/`
- BM Cluster canary: `infra/k8s/overlays/bm-cluster-canary/`

Only overlays are deployable environment profiles. Shared platform resources remain in `bm-cluster`. [Standalone Vault setup](./standalone-vault.md) documents the independent Vault Agent profile; BM Cluster production secrets are reconciled through `infra/scripts/configure-gitlab.sh` and External Secrets.

## Components

- `thoughty-web`: React/Vite frontend served by NGINX
- `thoughty-server`: NestJS API on port `3001`
- `thoughty-cloud-sync-worker`: background worker using the server image
- `postgres-backup`: optional logical-backup CronJob

The API exposes `/api/health` and Prometheus-format metrics at `/api/metrics`. The public production endpoint is `https://thoughty.swirlit.dev`. The production Ingress also publishes Thoughty in the cluster Homepage `Applications` group and protects both UI and API routes with the shared Keycloak OAuth2 Proxy. `KEYCLOAK_ISSUER`, `KEYCLOAK_JWKS_URI`, and `KEYCLOAK_AUDIENCE` are non-secret overlay settings; client and cookie secrets remain owned by the cluster identity deployment.

## Configuration And Secrets

Non-secret runtime values are defined in `infra/k8s/base/configmap.yaml` and adjusted for the shared cluster by `infra/k8s/overlays/bm-cluster/configmap-patch.yaml`.

The production overlay obtains secrets through External Secrets:

| Vault KV path | Purpose |
|---|---|
| `apps/thoughty/database` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `apps/thoughty/app` | signing, encryption, storage, AI, OAuth, and mail settings |
| `apps/thoughty/backup` | object-store backup credentials |
| `apps/thoughty/registry` | private GitLab registry pull credential |
| `infra/postgres` | shared database administrator used only by the setup hook |

`infra/scripts/configure-gitlab.sh` creates strong required database/application values when those app paths do not yet exist. Optional integration and backup values are initialized empty and must be populated before those features are enabled. Never commit those values or create plaintext Kubernetes Secrets in Git.

## Delivery Pipeline, Images, and Artifacts

The repository exposes explicit delivery jobs:

- `01-build → 02-test (optional) → 03-package` is the automatic build path.
- `01-e2e` is optional/manual; `02-quality` consumes test reports independently, manually in standard mode and automatically in full mode. Neither gates release.
- `01-release → 02-deploy` requires the successful build path and a successful release.
- `set-major-version` independently prepares `<major>.0.0` from the `NEW_MAJOR_VERSION` pipeline variable.

Select `PIPELINE_MODE=full` from **Run pipeline** on `main` to run non-blocking quality reporting, release, and deploy automatically. E2E remains an optional manual branch and cannot block it.

For a repeatable operator-triggered refresh, Ansible applies the repository-owned Argo CD `Application`, requests a hard source refresh, waits for a new `Synced`/`Healthy` reconciliation, and verifies all three Deployment rollouts. It deploys committed and pushed `main`, never uncommitted local overlay changes:

```bash
ansible-playbook -i infra/ansible/inventory.ini infra/ansible/site.yaml
```

The release job publishes immutable images:

```text
registry.swirlit.dev/swirlit/thoughty/thoughty-server:<semantic-version>
registry.swirlit.dev/swirlit/thoughty/thoughty-web:<semantic-version>
```

The worker and migration hook reuse the server image. Daemonless Kaniko builds and pushes images with 30-day registry-backed layer caching on unprivileged Kubernetes runners. Test, coverage, browser, and build reports remain downloadable as GitLab job artifacts for seven days; versioned server and web archives plus `SHA256SUMS` are also published immutably to the project's Generic Package Registry. SonarQube retains the long-lived code-quality report and quality-gate history.

`VERSION` starts at `1.0.0`. Each new first-parent commit advances the patch used by builds and releases. A release tags and deploys that exact version and then prepares the next minor baseline with patch reset to zero; for example, releasing `1.0.3` prepares `1.1.0`. The manual major-version job is the only supported way to change the first component, and all npm manifests are synchronized with each prepared baseline.

Run `infra/scripts/configure-gitlab.sh` with both `GITLAB_ADMIN_TOKEN` and `GITHUB_ADMIN_TOKEN` to reconcile project settings, the linked SonarQube project, and repository synchronization. The repository-owned bootstrap configures project metadata, labels, merge safeguards, `main` protection, cleanup, badges, a masked `SONAR_TOKEN`, encrypted GitHub Actions sync credentials, and a GitLab push/tag webhook without committing credentials.

Every GitHub push starts `.github/workflows/sync-gitlab.yml` directly. Every GitLab branch or tag push calls GitHub's repository-dispatch endpoint and starts the same reconciler, including commits marked `[skip ci]`. It fast-forwards the lagging side, merges divergent branches without force pushing, and refuses to rewrite conflicting tags. Its monthly schedule self-rotates the managed GitLab token into the encrypted GitHub secret before expiry.

## Standalone Profile

The standalone profile retains its own namespace, PostgreSQL, Redis, Vault Agent templates, ingress placeholder, worker, and backup resources. Reusable canary and monitoring components can be composed when that environment supports them. Before using the profile, set its host/TLS, object-storage values, image references, Vault roles, and `secret/data/thoughty/*` values for that independent environment.

Render it without changing a cluster:

```bash
kubectl kustomize infra/k8s/overlays/standalone >/dev/null
```

For production, use the aggregate `bm-cluster` overlay and do not apply standalone resources individually.

## Rollback

Production rollback is a revert or a new image-tag change in Git. Argo CD self-healing makes live `kubectl set image` changes temporary. Database changes should normally be corrected with a forward migration; never edit an already-applied migration.

## Related Guides

- [Server Deployment](./server-deployment.md)
- [Development Guide](./development.md)
- [Features](./features.md)
