# Vault Policy & Role Setup
#
# Run these commands against your Vault instance to configure
# the Kubernetes auth method and create the necessary secrets.
#
# ─── 1. Enable Kubernetes Auth (once per cluster) ─────────────
# vault auth enable kubernetes
# vault write auth/kubernetes/config \
#   kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT"
#
# ─── 2. Store Secrets ────────────────────────────────────────
# vault kv put secret/thoughty/database \
#   POSTGRES_USER="thoughty" \
#   POSTGRES_PASSWORD="<secure-password>" \
#   POSTGRES_DB="journal"
#
# vault kv put secret/thoughty/app \
#   JWT_SECRET="<secure-jwt-secret>" \
#   REFRESH_SECRET="<secure-refresh-secret>" \
#   CONFIG_ENCRYPTION_SECRET="<secure-encryption-secret>" \
#   S3_ACCESS_KEY="<s3-access-key>" \
#   S3_SECRET_KEY="<s3-secret-key>" \
#   OPENROUTER_API_KEY="" \
#   GOOGLE_DRIVE_CLIENT_ID="" \
#   GOOGLE_DRIVE_CLIENT_SECRET="" \
#   ONEDRIVE_CLIENT_ID="" \
#   ONEDRIVE_CLIENT_SECRET="" \
#   DROPBOX_CLIENT_ID="" \
#   DROPBOX_CLIENT_SECRET="" \
#   SMTP_HOST="" \
#   SMTP_PORT="587" \
#   SMTP_USER="" \
#   SMTP_PASS="" \
#   SMTP_FROM=""
#
# Notes:
#   - JWT_SECRET and REFRESH_SECRET are required for auth to work in production.
#   - CONFIG_ENCRYPTION_SECRET protects encrypted user config and cloud-sync tokens.
#   - S3_ACCESS_KEY / S3_SECRET_KEY are required for attachments; the non-secret
#     S3_ENDPOINT / S3_BUCKET / S3_REGION live in the ConfigMap.
#   - OPENROUTER_API_KEY enables AI features; provider client IDs/secrets enable cloud sync.
#
# ─── 3. Create Policies ──────────────────────────────────────
# vault policy write thoughty-server - <<EOF
# path "secret/data/thoughty/database" {
#   capabilities = ["read"]
# }
# path "secret/data/thoughty/app" {
#   capabilities = ["read"]
# }
# EOF
#
# vault policy write thoughty-postgres - <<EOF
# path "secret/data/thoughty/database" {
#   capabilities = ["read"]
# }
# EOF
#
# ─── 4. Bind Kubernetes Service Accounts ──────────────────────
# vault write auth/kubernetes/role/thoughty-server \
#   bound_service_account_names=thoughty-server \
#   bound_service_account_namespaces=thoughty \
#   policies=thoughty-server \
#   ttl=1h
#
# vault write auth/kubernetes/role/thoughty-postgres \
#   bound_service_account_names=thoughty-postgres \
#   bound_service_account_namespaces=thoughty \
#   policies=thoughty-postgres \
#   ttl=1h
