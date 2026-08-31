# BM Cluster Deployment

Thoughty targets the application-neutral platform managed by [`bm-cluster`](https://github.com/chefzaid/bm-cluster). The platform owns generic GitLab runner, Argo CD, Vault, External Secrets, registry, ingress, PostgreSQL, Redis, and monitoring services. This repository owns all Thoughty-specific GitLab, Vault, Argo CD, and Kubernetes configuration.

## Production Desired State

Argo CD reads `infra/k8s/overlays/bm-cluster` from `swirlit/thoughty` in the cluster's GitLab instance and deploys it to `apps`.

The aggregate overlay includes:

- API, web, and cloud-sync worker Deployments
- the public ingress for `thoughty.swirlit.dev` using `swirlit-dev-tls`
- External Secrets for runtime, backup, registry, and database-administrator contracts
- a database setup hook at sync wave `-1`
- a TypeORM migration hook at sync wave `0`
- runtime Deployments at sync wave `1`

The setup hook idempotently creates or updates the `thoughty` login and creates its database using the shared administrator. The migration hook runs from the same immutable server image as the release before the API and worker roll out.

Render and validate locally:

```bash
kubectl kustomize infra/k8s/overlays/bm-cluster >/dev/null
kubectl apply --dry-run=client --validate=false \
  -k infra/k8s/overlays/bm-cluster >/dev/null
kubectl apply --dry-run=client --validate=false \
  -f infra/argocd/application.yaml >/dev/null
```

## One-Time GitLab Bootstrap

Prerequisites:

- the generic instance runner is online with tag `bm-cluster`
- GitLab, Argo CD, Vault, External Secrets, and the registry are healthy
- `.gitlab-ci.yml` is present in the repository's current commit
- `kubectl`, `curl`, `git`, `jq`, `openssl`, `python3`, `libsodium`, and `sudo` are installed on the control-plane host
- `GITLAB_ADMIN_TOKEN` can manage `swirlit/thoughty`
- `GITHUB_ADMIN_TOKEN` can manage Actions secrets and dispatch workflows for `chefzaid/thoughty`

Run:

```bash
GITLAB_ADMIN_TOKEN=<gitlab-token> \
GITHUB_ADMIN_TOKEN=<github-token> \
  ./infra/scripts/configure-gitlab.sh
```

The script creates or updates the GitLab project, enables the instance runner and CI job-token pushes, configures bidirectional GitHub/GitLab push synchronization, creates a read-only registry deploy token, writes app-specific values under `apps/thoughty/*` in Vault, and applies `infra/argocd/application.yaml`. It does not add Thoughty configuration to `bm-cluster`.

Populate optional storage, provider, and SMTP secrets after bootstrap. The production backup CronJob is suspended by default; configure `apps/thoughty/backup` and the `POSTGRES_BACKUP_*` ConfigMap values before enabling its schedule.

## GitLab CI Delivery

The pipeline graph shows ordered build, test, package, E2E, quality, release, deploy, and version jobs. Tests are non-blocking and E2E is optional/manual. Standard mode leaves quality manual; `PIPELINE_MODE=full` runs independent non-blocking quality/security reporting automatically and automates release and deploy while E2E remains manual.

The release job:

1. consumes the successful server/web build artifacts;
2. publishes immutable server/web archives and checksums to the Generic Package Registry;
3. publishes immutable server and web images with daemonless Kaniko and 30-day registry-backed layer caches;
4. refuses to deploy if `main` advanced during the pipeline;
5. commits the semantic release version and two Kustomize image tags, then creates its annotated Git tag;
6. prepares and commits the next minor version with patch reset to zero;
7. creates a GitLab Release linked to both packages;
8. applies and refreshes the Thoughty Argo CD `Application`;
9. waits for that exact commit to become `Synced` and `Healthy`; and
10. checks the internal API and web endpoints.

Deployments are serialized through the `thoughty-production` resource group. Argo CD, not CI, creates, prunes, and self-heals workloads. `infra/scripts/configure-gitlab.sh` also reconciles the GitLab project controls, CI badges, and the repository's `swirlit:thoughty` SonarQube project.

## Post-Deployment Checks

```bash
kubectl get application thoughty -n infra
kubectl get deployment,pod,service,ingress,cronjob -n apps
kubectl get externalsecret -n apps | grep thoughty
kubectl rollout status deployment/thoughty-server -n apps
kubectl rollout status deployment/thoughty-cloud-sync-worker -n apps
kubectl rollout status deployment/thoughty-web -n apps
kubectl port-forward -n apps service/thoughty-server 13001:3001
```

With the port-forward active in another terminal:

```bash
curl --fail http://127.0.0.1:13001/api/health
curl --fail http://127.0.0.1:13001/api/metrics
```

Healthy means the expected Argo CD revision is `Synced` and `Healthy`, all three Deployments are available, External Secrets report `Ready=True`, and `/api/health` returns HTTP 200.

## Rollback And Database Safety

Revert or change the desired image tags in Git and let Argo CD reconcile. Do not patch live Deployments as a production rollback.

TypeORM records completed migrations. Add a new forward migration instead of changing an applied one. Test fresh-install and upgrade paths, and create a database backup before a risky schema release.
