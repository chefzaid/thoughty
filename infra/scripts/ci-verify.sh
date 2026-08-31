#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"

phase="${1:-all}"

prepare_sources() {
  infra/scripts/set-project-version.sh "$APP_VERSION"
}

build_application() {
  kubectl kustomize infra/k8s/overlays/bm-cluster >/dev/null
  kubectl apply --dry-run=client --validate=false \
    -f infra/argocd/application.yaml >/dev/null

  pushd thoughty-server >/dev/null
  npm ci
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

test_application() {
  pushd thoughty-server >/dev/null
  npm ci
  npx eslint "{src,scripts,test}/**/*.ts"
  JEST_JUNIT_OUTPUT_FILE="$PWD/test-results.xml" npm run test:cov -- \
    --ci --maxWorkers=2 --reporters=default --reporters=jest-junit \
    --coverageReporters=text --coverageReporters=lcov --coverageReporters=cobertura
  popd >/dev/null

  pushd thoughty-web >/dev/null
  npm ci
  npm run lint
  COVERAGE_POLICY_REPORT_ONLY=true npm run test:coverage -- --maxWorkers=2 \
    --reporter=default --reporter=junit --outputFile.junit=test-results.xml \
    --coverage.reporter=text --coverage.reporter=lcov --coverage.reporter=cobertura
  popd >/dev/null

  python3 infra/scripts/ci-coverage-check.py \
    thoughty-server/coverage/cobertura-coverage.xml \
    thoughty-web/coverage/cobertura-coverage.xml
}

prepare_sources
case "$phase" in
  build)
    build_application
    ;;
  test)
    test_application
    ;;
  all)
    build_application
    test_application
    ;;
  *)
    printf 'Usage: %s [build|test|all]\n' "$0" >&2
    exit 2
    ;;
esac
