# Standalone Vault Setup

Vault setup for the [standalone profile](deployment.md#standalone-infrak8soverlaysstandalone) in namespace `thoughty`. Production uses External Secrets; do not apply this there.

## 1. Enable Kubernetes authentication

Once per cluster:

```bash
vault auth enable kubernetes
vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT"
```

## 2. Store secrets

Replace every placeholder.

```bash
vault kv put secret/thoughty/database \
  POSTGRES_USER="thoughty" \
  POSTGRES_PASSWORD="<secure-password>" \
  POSTGRES_DB="journal"

vault kv put secret/thoughty/app \
  JWT_SECRET="<secure-jwt-secret>" \
  REFRESH_SECRET="<secure-refresh-secret>" \
  TWO_FACTOR_SECRET="<secure-two-factor-secret>" \
  UNSUBSCRIBE_SECRET="<secure-unsubscribe-secret>" \
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

The API and worker do not start without `CONFIG_ENCRYPTION_SECRET`. The JWT, refresh, and 2FA secrets fall back to insecure defaults, so always set them. Scope S3 and backup credentials to their own buckets.

## 3. Create policies

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

## 4. Bind service accounts

`thoughty-server` serves the API and worker; `thoughty-postgres` serves PostgreSQL and backups.

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
