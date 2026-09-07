# Standalone Vault Setup

These commands configure the independent Vault Agent profile. BM Cluster production uses the `apps/thoughty/*` External Secrets contracts created by `infra/scripts/configure-gitlab.sh`; do not apply this standalone setup there.

## Enable Kubernetes Authentication

Run once per independent cluster:

```bash
vault auth enable kubernetes
vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT"
```

## Store Standalone Secrets

Replace every placeholder before running these commands:

```bash
vault kv put secret/thoughty/database \
  POSTGRES_USER="thoughty" \
  POSTGRES_PASSWORD="<secure-password>" \
  POSTGRES_DB="journal"

vault kv put secret/thoughty/app \
  JWT_SECRET="<secure-jwt-secret>" \
  REFRESH_SECRET="<secure-refresh-secret>" \
  TWO_FACTOR_SECRET="<secure-two-factor-secret>" \
  CONFIG_ENCRYPTION_SECRET="<secure-encryption-secret>" \
  S3_ACCESS_KEY="<s3-access-key>" \
  S3_SECRET_KEY="<s3-secret-key>" \
  OPENROUTER_API_KEY="" \
  GOOGLE_DRIVE_CLIENT_ID="" \
  GOOGLE_DRIVE_CLIENT_SECRET="" \
  ONEDRIVE_CLIENT_ID="" \
  ONEDRIVE_CLIENT_SECRET="" \
  DROPBOX_CLIENT_ID="" \
  DROPBOX_CLIENT_SECRET="" \
  SMTP_HOST="" \
  SMTP_PORT="587" \
  SMTP_USER="" \
  SMTP_PASS="" \
  SMTP_FROM=""

vault kv put secret/thoughty/backup \
  POSTGRES_BACKUP_ACCESS_KEY="<backup-bucket-access-key>" \
  POSTGRES_BACKUP_SECRET_KEY="<backup-bucket-secret-key>"
```

`JWT_SECRET`, `REFRESH_SECRET`, and `TWO_FACTOR_SECRET` are required for production authentication. `CONFIG_ENCRYPTION_SECRET` protects encrypted user configuration and cloud-sync tokens. Attachment and backup credentials should be scoped only to their required buckets or prefixes.

## Create Policies

```bash
vault policy write thoughty-server - <<'EOF'
path "secret/data/thoughty/database" {
  capabilities = ["read"]
}
path "secret/data/thoughty/app" {
  capabilities = ["read"]
}
EOF

vault policy write thoughty-postgres - <<'EOF'
path "secret/data/thoughty/database" {
  capabilities = ["read"]
}
path "secret/data/thoughty/backup" {
  capabilities = ["read"]
}
EOF
```

## Bind Service Accounts

```bash
vault write auth/kubernetes/role/thoughty-server \
  bound_service_account_names=thoughty-server \
  bound_service_account_namespaces=thoughty \
  policies=thoughty-server \
  ttl=1h

vault write auth/kubernetes/role/thoughty-postgres \
  bound_service_account_names=thoughty-postgres \
  bound_service_account_namespaces=thoughty \
  policies=thoughty-postgres \
  ttl=1h
```
