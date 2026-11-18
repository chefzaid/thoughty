#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"

phase="${1:-all}"
suite="${2:-all}"

usage() {
  printf 'Usage: %s [build|test [server|web|all]|coverage|all]\n' "$0" >&2
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
