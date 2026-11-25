#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"

phase="${1:-all}"
suite="${2:-all}"

usage() {
  printf 'Usage: %s [build|test [server|web|all]|postgres|coverage|all]\n' "$0" >&2
  exit 2
}

prepare_sources() {
  infra/scripts/set-project-version.sh "$APP_VERSION"
}

# Jest, Vitest and ESLint would size their pools from the node's threads, not the job's CPUs.
test_workers() {
  local workers
  workers="$(infra/scripts/ci-workers.sh test)"
  printf '%s suite: %s workers on %s CPUs\n' "$1" "$workers" "$(infra/scripts/ci-workers.sh cpus)" >&2
  printf '%s\n' "$workers"
}

build_application() {
  python3 infra/scripts/test-onboarding.py
  kubectl kustomize infra/k8s/overlays/swirl-cloud >/dev/null
  kubectl kustomize infra/overlays/ha >/dev/null
  kubectl apply --dry-run=client --validate=false \
    -f infra/argocd/application.yaml >/dev/null

  pushd thoughty-server >/dev/null
  npm ci
  npx tsc --noEmit -p tsconfig.json
  npm run build
  tar -czf "thoughty-server-${APP_VERSION}.tar.gz" dist package.json package-lock.json
  popd >/dev/null

  pushd thoughty-web >/dev/null
  npm ci
  npm run typecheck
  npm run build
  tar -czf "thoughty-web-${APP_VERSION}.tar.gz" -C dist .
  popd >/dev/null
}

test_server() {
  local workers
  workers="$(test_workers server)"
  pushd thoughty-server >/dev/null
  npm ci
  npx eslint --concurrency="$workers" "{src,scripts,test}/**/*.ts"
  JEST_JUNIT_OUTPUT_FILE="$PWD/test-results.xml" npm run test:cov -- \
    --ci --maxWorkers="$workers" --reporters=default --reporters=jest-junit \
    --coverageReporters=text --coverageReporters=lcov --coverageReporters=cobertura
  popd >/dev/null
}

test_web() {
  local workers
  workers="$(test_workers web)"
  pushd thoughty-web >/dev/null
  npm ci
  npm run lint -- --concurrency="$workers"
  COVERAGE_POLICY_REPORT_ONLY=true npm run test:coverage -- --maxWorkers="$workers" \
    --reporter=default --reporter=junit --outputFile.junit=test-results.xml \
    --coverage.reporter=text --coverage.reporter=lcov --coverage.reporter=cobertura
  popd >/dev/null
}

# The job's PostgreSQL service can still be starting: wait for it to answer, then log what it runs.
wait_for_postgres() {
  local _
  for _ in $(seq 1 60); do
    # shellcheck disable=SC2016 # JavaScript, not shell: the template literal is for node.
    if node -e '
      const { Client } = require("pg");
      const client = new Client({ connectionString: process.env.THOUGHTY_PG_TEST_URL });
      client.connect()
        .then(() => client.query("SELECT version() AS version, pg_encoding_to_char(encoding) AS encoding, datctype FROM pg_database WHERE datname = current_database()"))
        .then(({ rows: [server] }) => console.log(`${server.version}; ${server.encoding}, LC_CTYPE ${server.datctype}`))
        .then(() => client.end())
        .catch(() => process.exit(1));
    ' 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  printf 'PostgreSQL did not answer at THOUGHTY_PG_TEST_URL within 60 seconds\n' >&2
  return 1
}

# The specs that need a database: every suite wrapped in describePostgres (the *.integration.spec.ts
# files and the migration specs), then the real-API contract specs. Both run even if the first fails.
test_postgres() {
  local workers status=0
  local -a specs
  : "${THOUGHTY_PG_TEST_URL:?Set THOUGHTY_PG_TEST_URL to the thoughty_ha_test database}"
  workers="$(test_workers postgres)"
  pushd thoughty-server >/dev/null
  npm ci
  wait_for_postgres
  mapfile -t specs < <(grep -rl --include='*.spec.ts' 'describePostgres' src | sort)
  if ((${#specs[@]} == 0)); then
    printf 'No spec uses describePostgres under thoughty-server/src\n' >&2
    return 1
  fi
  printf 'PostgreSQL specs: %s files\n' "${#specs[@]}" >&2
  JEST_JUNIT_OUTPUT_FILE="$PWD/postgres-test-results.xml" npx jest --ci --maxWorkers="$workers" \
    --reporters=default --reporters=jest-junit --runTestsByPath "${specs[@]}" || status=1
  JEST_JUNIT_OUTPUT_FILE="$PWD/api-contract-test-results.xml" npm run test:e2e -- --ci \
    --maxWorkers="$workers" --reporters=default --reporters=jest-junit || status=1
  popd >/dev/null
  return "$status"
}

check_coverage() {
  python3 infra/scripts/ci-coverage-check.py \
    thoughty-server/coverage/cobertura-coverage.xml \
    thoughty-web/coverage/cobertura-coverage.xml
}

case "$phase" in
  build)
    prepare_sources
    build_application
    ;;
  test)
    prepare_sources
    case "$suite" in
      server) test_server ;;
      web) test_web ;;
      all)
        test_server
        test_web
        check_coverage
        ;;
      *) usage ;;
    esac
    ;;
  postgres)
    prepare_sources
    test_postgres
    ;;
  coverage)
    check_coverage
    ;;
  all)
    prepare_sources
    build_application
    test_server
    test_web
    check_coverage
    ;;
  *)
    usage
    ;;
esac
