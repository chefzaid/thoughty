# Deployment Guide

Thoughty has two Kubernetes profiles:

- `infra/k8s/overlays/bm-cluster` is the production profile delivered by GitLab CI and Argo CD to the shared bare-metal cluster.
- `infra/k8s/base` is a standalone profile for a dedicated `thoughty` namespace with its own PostgreSQL and Redis services.

The production profile is described in [Server Deployment](./server-deployment.md). It is the only profile changed automatically by `.gitlab-ci.yml`.

## Components

- `thoughty-web`: React/Vite frontend served by NGINX
- `thoughty-server`: NestJS API on port `3001`
- `thoughty-cloud-sync-worker`: background worker using the server image
- `postgres-backup`: optional logical-backup CronJob

The API exposes `/api/health` and Prometheus-format metrics at `/api/metrics`. The public production endpoint is `https://thoughty.swirlit.dev`.

## Configuration And Secrets

Non-secret runtime values are defined in `infra/k8s/base/configmap.yaml` and adjusted for the shared cluster by `infra/k8s/overlays/server/configmap-patch.yaml`.

The production overlay obtains secrets through External Secrets:

| Vault KV path | Purpose |
|---|---|
| `apps/thoughty/database` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `apps/thoughty/app` | signing, encryption, storage, AI, OAuth, and mail settings |
| `apps/thoughty/backup` | object-store backup credentials |
| `apps/thoughty/registry` | private GitLab registry pull credential |
| `infra/postgres` | shared database administrator used only by the setup hook |

`infra/scripts/configure-gitlab.sh` creates strong required database/application values when those app paths do not yet exist. Optional integration and backup values are initialized empty and must be populated before those features are enabled. Never commit those values or create plaintext Kubernetes Secrets in Git.

## Images

The default-branch pipeline publishes immutable images:

```text
registry.swirlit.dev/root/thoughty/thoughty-server:<pipeline>-<commit>
registry.swirlit.dev/root/thoughty/thoughty-web:<pipeline>-<commit>
```

The worker and migration hook reuse the server image. Kaniko builds and pushes images without a privileged Docker daemon.

## Standalone Profile

The standalone profile retains its own namespace, PostgreSQL, Redis, Vault Agent templates, ingress placeholder, canary resources, and backup resources. Before using it, set its host/TLS, object-storage values, image references, Vault roles, and `secret/data/thoughty/*` values for that independent environment.

Render it without changing a cluster:

```bash
kubectl kustomize infra/k8s/base >/dev/null
kubectl kustomize infra/k8s/base/canary >/dev/null
```

For production, use the aggregate `bm-cluster` overlay and do not apply standalone resources individually.

## Rollback

Production rollback is a revert or a new image-tag change in Git. Argo CD self-healing makes live `kubectl set image` changes temporary. Database changes should normally be corrected with a forward migration; never edit an already-applied migration.

## Related Guides

- [Server Deployment](./server-deployment.md)
- [Development Guide](./development.md)
- [Features](./features.md)
