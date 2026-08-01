# Server Deployment

Thoughty's server profile targets the current `main` branch of the [BM Cluster (Bare Metal Cluster) repository](https://github.com/chefzaid/bm-cluster). The `k8s/server` overlay follows that server's ownership model:

- applications run in the `application` namespace
- PostgreSQL and Redis are shared services in `infra`
- NGINX owns ingress and the public address
- Vault is exposed to workloads through External Secrets Operator
- Jenkins, Nexus, Prometheus, Longhorn, and the infrastructure lifecycle remain server-owned

The overlay deploys only Thoughty resources. It does not create or mutate shared infrastructure.

## Prerequisites

Verify the required server APIs and services:

```bash
kubectl get namespace infra
kubectl get ingressclass nginx
kubectl get clustersecretstore vault-backend
kubectl get service postgres redis vault prometheus jenkins nexus -n infra
kubectl get crd externalsecrets.external-secrets.io
```

The server documentation reserves `application` for application workloads, but its current installer does not declare that Namespace. Create it once before the first deployment; the Jenkins pipeline performs the same command idempotently:

```bash
kubectl create namespace application --dry-run=client -o yaml | kubectl apply -f -
```

The server deploys Jenkins in `infra` with the `jenkins-agent` service account. A Thoughty build agent needs Node.js, Docker, and `kubectl`, plus access to the Docker registry from both the builder and the K3s nodes that pull the resulting images. Configure the Jenkins credentials referenced by the pipeline:

| Credential ID | Kind | Purpose |
| --- | --- | --- |
| `docker-registry-url` | Secret text | Registry host used in image names |
| `docker-registry-creds` | Username/password | Login for pushing Thoughty images |
| `kubeconfig` | Kubernetes CLI credential | Access to the server API |

The server's Nexus deployment exposes a Docker connector on port `5000`, but its repository must first be created as described in the server README. Use a registry address that the K3s node runtime can resolve and trust; a Kubernetes service DNS name is not automatically available while the node is pulling an image.

## Dedicated Database

Create a dedicated `thoughty` database and login role in the shared PostgreSQL instance. Use DBGate or an administrator `psql` session; do not reuse the infrastructure administrator as the application login.

```sql
CREATE ROLE thoughty LOGIN PASSWORD '<generated-password>';
CREATE DATABASE thoughty OWNER thoughty;
```

The resulting credentials are stored in Vault, not in Git or Jenkins.

## Vault and External Secrets

The `vault-backend` ClusterSecretStore authenticates as the `external-secrets` service account in `infra` through the `external-secrets-role`. The server's `scripts/configure-vault.sh` rewrites `external-secrets-policy` whenever it runs, so persist the following additions in that script's policy block rather than applying a one-off live policy:

```hcl
path "secret/data/application/thoughty/*" {
  capabilities = ["read"]
}

path "secret/metadata/application/thoughty/*" {
  capabilities = ["read", "list"]
}
```

Keep the existing `secret/data/infra/*` and `secret/metadata/infra/*` rules. Re-run the server's Vault configuration script after updating the policy, then confirm the store remains ready:

```bash
./scripts/configure-vault.sh infra
kubectl get clustersecretstore vault-backend
```

Create these KV v2 records:

| Vault path | Required keys |
| --- | --- |
| `secret/application/thoughty/database` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `secret/application/thoughty/app` | `JWT_SECRET`, `REFRESH_SECRET`, `TWO_FACTOR_SECRET`, `CONFIG_ENCRYPTION_SECRET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| `secret/application/thoughty/backup` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |

The app record can also contain `OPENROUTER_API_KEY`, OAuth provider credentials, and SMTP settings described in the main deployment guide. External Secrets copies each record into a namespace-scoped Secret with the same environment variable names.

After applying the overlay, verify synchronization without printing values:

```bash
kubectl wait --for=condition=Ready \
  externalsecret/thoughty-database \
  externalsecret/thoughty-app \
  externalsecret/thoughty-backup \
  -n application \
  --timeout=120s

kubectl get secret thoughty-database thoughty-app thoughty-backup -n application
```

## DNS and TLS

Create a DNS record for `thoughty.swirlit.dev` pointing to the server's NGINX ingress address. The server installer creates `swirlit-dev-tls` in `infra`, but Kubernetes TLS secrets are namespace-scoped. Provision the certificate separately in `application` for Thoughty's ingress:

```bash
kubectl create secret tls swirlit-dev-tls \
  --cert=tls.crt \
  --key=tls.key \
  -n application \
  --dry-run=client -o yaml | kubectl apply -f -
```

Use the server's Cloudflare Origin or publicly trusted certificate workflow. Do not commit certificate material.

## Runtime Configuration

Review `k8s/server/configmap-patch.yaml` before deployment. The overlay sets:

- `POSTGRES_HOST=postgres.infra.svc.cluster.local`
- `REDIS_HOST=redis.infra.svc.cluster.local`
- `FRONTEND_URL=https://thoughty.swirlit.dev`
- `CORS_ORIGIN=https://thoughty.swirlit.dev`

Replace the S3 attachment and backup endpoints, regions, and bucket names inherited from `deployments/configmap.yaml` with real values for the environment.

## Deployment Sequence

Render locally before applying:

```bash
kubectl kustomize k8s/server > /dev/null
kubectl kustomize k8s/server-worker > /dev/null
kubectl kustomize k8s/server-canary > /dev/null
```

Stop an existing worker before changing the API schema, then deploy the core overlay and wait for secrets:

```bash
kubectl scale deployment/thoughty-cloud-sync-worker --replicas=0 -n application
kubectl rollout status deployment/thoughty-cloud-sync-worker -n application --timeout=120s

kubectl apply -k k8s/server
kubectl wait --for=condition=Ready \
  externalsecret/thoughty-database \
  externalsecret/thoughty-app \
  externalsecret/thoughty-backup \
  -n application \
  --timeout=120s
```

On an initial deployment the worker does not exist yet, so omit the first two commands.

Set the API image, wait for readiness, then apply migrations:

```bash
kubectl set image deployment/thoughty-server \
  thoughty-server=<registry>/thoughty-server:<tag> \
  -n application
kubectl rollout status deployment/thoughty-server -n application --timeout=120s
kubectl exec deployment/thoughty-server -n application -- npm run db:migrate:dist
```

Apply the separate worker overlay only after migrations succeed, then roll out the web image:

```bash
kubectl kustomize k8s/server-worker | \
  kubectl set image -f - \
    thoughty-cloud-sync-worker=<registry>/thoughty-server:<tag> \
    --local -o yaml | \
  kubectl apply -f -

kubectl set image deployment/thoughty-web \
  thoughty-web=<registry>/thoughty-web:<tag> \
  -n application

kubectl rollout status deployment/thoughty-cloud-sync-worker -n application --timeout=120s
kubectl rollout status deployment/thoughty-web -n application --timeout=120s
```

The Jenkins pipeline performs this sequence automatically on `main`.

## Canary Releases

The optional canary overlay transforms `deployments/canary/` for the shared namespace, ExternalSecrets, ingress host, and TLS secret. It is not part of a normal rollout. To activate a candidate:

```bash
kubectl apply -k k8s/server-canary
kubectl set image deployment/thoughty-server-canary \
  thoughty-server=<registry>/thoughty-server:<candidate-tag> \
  -n application
kubectl set image deployment/thoughty-web-canary \
  thoughty-web=<registry>/thoughty-web:<candidate-tag> \
  -n application
```

Use the `X-Thoughty-Canary: always` header or NGINX canary weight annotations as described in the main deployment guide. Delete the canary overlay after promotion or rollback.

## Monitoring and Backups

The server runs Prometheus as a plain Deployment backed by the `prometheus-config` ConfigMap in `deployments/monitoring.yaml`; it does not install the Prometheus Operator. Add this scrape job to that file in the server repository:

```yaml
- job_name: thoughty
  metrics_path: /api/metrics
  static_configs:
    - targets:
        - thoughty-server.application.svc.cluster.local:3001
```

After deploying the updated server monitoring manifest, restart Prometheus because the current Deployment has no config-reload sidecar:

```bash
kubectl rollout restart deployment/prometheus -n infra
kubectl rollout status deployment/prometheus -n infra --timeout=120s
```

Do not apply `deployments/monitoring-alerts.yaml` unless the server later installs the Prometheus Operator CRDs. Translate those rules into the server-owned Prometheus configuration instead.

The Thoughty CronJob creates logical backups of only the `thoughty` database. Point-in-time recovery and WAL retention for shared PostgreSQL are server responsibilities and must be configured independently.
