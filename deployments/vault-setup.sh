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
#   JWT_REFRESH_SECRET="<secure-refresh-secret>" \
#   GOOGLE_CLIENT_ID="" \
#   GOOGLE_CLIENT_SECRET="" \
#   SMTP_HOST="" \
#   SMTP_PORT="587" \
#   SMTP_USER="" \
#   SMTP_PASS=""
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
