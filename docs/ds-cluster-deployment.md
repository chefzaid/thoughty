# DS-Cluster Deployment

DS-Cluster is the former name of the [Bare-Metal Cluster repository](https://github.com/chefzaid/bm-cluster). Thoughty's `k8s/ds-cluster` overlay follows that cluster's current ownership model:

- applications run in the `application` namespace
- PostgreSQL and Redis are shared services in `infra`
- NGINX owns ingress
- Vault is exposed to workloads through External Secrets Operator
- Longhorn and the infrastructure lifecycle remain cluster-owned

The overlay deploys only Thoughty resources. It does not create or mutate shared infrastructure.

## Prerequisites

Verify the required cluster APIs and services:

```bash
kubectl get namespace application infra
kubectl get ingressclass nginx
kubectl get clustersecretstore vault-backend
kubectl get service postgres redis -n infra
kubectl get crd externalsecrets.external-secrets.io
```

The Jenkins Kubernetes credential must be able to manage Thoughty Deployments, Services, Ingresses, ConfigMaps, CronJobs, ExternalSecrets, and Secrets in `application`. It does not need permission to deploy infrastructure resources.

## Dedicated Database

Create a dedicated `thoughty` database and login role in the shared PostgreSQL instance. Use DBGate or an administrator `psql` session; do not reuse the infrastructure administrator as the application login.

```sql
CREATE ROLE thoughty LOGIN PASSWORD '<generated-password>';
CREATE DATABASE thoughty OWNER thoughty;
```

The resulting credentials are stored in Vault, not in Git or Jenkins.

## Vault and External Secrets

The `vault-backend` ClusterSecretStore authenticates with the cluster's `external-secrets-role`. Extend its policy without removing the existing `secret/infra/*` access:

```hcl
path "secret/data/application/thoughty/*" {
  capabilities = ["read"]
}

path "secret/metadata/application/thoughty/*" {
  capabilities = ["read", "list"]
}
```

Create these KV v2 records:

| Vault path | Required keys |
| --- | --- |
| `secret/application/thoughty/database` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `secret/application/thoughty/app` | `JWT_SECRET`, `REFRESH_SECRET`, `CONFIG_ENCRYPTION_SECRET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
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

Create a DNS record for `thoughty.swirlit.dev` pointing to the cluster ingress address. The overlay references `swirlit-dev-tls` in `application`; Kubernetes TLS secrets are namespace-scoped, so provision the certificate in that namespace even if a secret with the same name already exists in `infra`.

```bash
kubectl create secret tls swirlit-dev-tls \
  --cert=tls.crt \
  --key=tls.key \
  -n application \
  --dry-run=client -o yaml | kubectl apply -f -
```

Use the cluster's Cloudflare Origin or publicly trusted certificate workflow. Do not commit certificate material.

## Runtime Configuration

Review `k8s/ds-cluster/configmap-patch.yaml` before deployment. The overlay sets:

- `POSTGRES_HOST=postgres.infra.svc.cluster.local`
- `REDIS_HOST=redis.infra.svc.cluster.local`
- `FRONTEND_URL=https://thoughty.swirlit.dev`
- `CORS_ORIGIN=https://thoughty.swirlit.dev`

Replace the S3 attachment and backup endpoints, regions, and bucket names inherited from `deployments/configmap.yaml` with real values for the environment.

## Deployment Sequence

Render locally before applying:

```bash
kubectl kustomize k8s/ds-cluster > /dev/null
kubectl kustomize k8s/ds-cluster-worker > /dev/null
kubectl kustomize k8s/ds-cluster-canary > /dev/null
```

Stop an existing worker before changing the API schema, then deploy the core overlay and wait for secrets:

```bash
kubectl scale deployment/thoughty-cloud-sync-worker --replicas=0 -n application
kubectl rollout status deployment/thoughty-cloud-sync-worker -n application --timeout=120s

kubectl apply -k k8s/ds-cluster
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
kubectl kustomize k8s/ds-cluster-worker | \
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
kubectl apply -k k8s/ds-cluster-canary
kubectl set image deployment/thoughty-server-canary \
  thoughty-server=<registry>/thoughty-server:<candidate-tag> \
  -n application
kubectl set image deployment/thoughty-web-canary \
  thoughty-web=<registry>/thoughty-web:<candidate-tag> \
  -n application
```

Use the `X-Thoughty-Canary: always` header or NGINX canary weight annotations as described in the main deployment guide. Delete the canary overlay after promotion or rollback.

## Monitoring and Backups

DS-Cluster's Prometheus is cluster-owned and does not use the Prometheus Operator. Add a scrape job to the cluster repository's Prometheus configuration:

```yaml
- job_name: thoughty
  metrics_path: /api/metrics
  static_configs:
    - targets:
        - thoughty-server.application.svc.cluster.local:3001
```

Do not apply `deployments/monitoring-alerts.yaml` unless the cluster later installs the Prometheus Operator CRDs. Translate those rules into the cluster-owned Prometheus configuration instead.

The Thoughty CronJob creates logical backups of only the `thoughty` database. Point-in-time recovery and WAL retention for the shared PostgreSQL server are infrastructure responsibilities and must be configured in DS-Cluster independently.
