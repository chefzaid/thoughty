#!/usr/bin/env bash
# Run lease-race tests only against a disposable local PostgreSQL fixture.
set -euo pipefail
set +x
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/../../thoughty-server"
fixture_dir="$(mktemp -d)"
container=""
trap '[[ -z "$container" ]] || docker rm -f "$container" >/dev/null; rm -rf -- "$fixture_dir"' EXIT
python3 - "$fixture_dir" <<'PY'
import pathlib, secrets, sys
directory = pathlib.Path(sys.argv[1])
password = secrets.token_hex(32)
(directory/'password').write_text(password)
(directory/'env').write_text('POSTGRES_PASSWORD='+password+'\nPOSTGRES_DB=thoughty_ha_test\n')
PY
container="$(docker run -d --rm --env-file "$fixture_dir/env" --tmpfs /var/lib/postgresql:rw,size=256m -p 127.0.0.1::5432 "${POSTGRES_TEST_IMAGE:-docker.io/library/postgres:18.6-bookworm}")"
for attempt in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres -d thoughty_ha_test >/dev/null 2>&1; then break; fi
  sleep 1
done
fixture_port="$(docker port "$container" 5432/tcp | cut -d: -f2)"
THOUGHTY_PG_TEST_URL="postgresql://postgres:$(cat "$fixture_dir/password")@127.0.0.1:$fixture_port/thoughty_ha_test" \
  npx jest --runInBand --testPathPattern=cloud-sync-queue.integration.spec
