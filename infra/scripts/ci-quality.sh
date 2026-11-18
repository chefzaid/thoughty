#!/usr/bin/env bash
set -uo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root" || exit 1
quality_dir="$repository_root/quality-reports"
mkdir -p "$quality_dir"

security_status=passed
audit_labels=()
audit_pids=()
# The audits wait on the registry, the scanner on the CPU: they run side by side.
start_npm_audit() {
  local directory="$1" label="$2"
  (cd "$directory" && npm audit --audit-level=high --json) \
    > "$quality_dir/npm-audit-$label.json" &
  audit_labels+=("$label")
  audit_pids+=("$!")
}

finish_npm_audits() {
  local index
  for index in "${!audit_pids[@]}"; do
    if wait "${audit_pids[$index]}"; then
      printf 'npm security audit passed for %s.\n' "${audit_labels[$index]}"
    else
      security_status=failed
      printf 'npm security audit reported findings for %s; see the quality artifact.\n' \
        "${audit_labels[$index]}" >&2
    fi
  done
}

start_npm_audit thoughty-server thoughty-server
start_npm_audit thoughty-web thoughty-web

submit_sonar() {
  local sonar_version="$1" attempt
  for attempt in 1 2 3; do
    if sonar-scanner-npm \
      -Dsonar.host.url="$SONAR_HOST_URL" \
      -Dsonar.projectVersion="$sonar_version" \
      -Dsonar.qualitygate.wait=false; then
      return 0
    fi
    if [[ "$attempt" -lt 3 ]]; then
      printf 'Sonar submission attempt %s failed; retrying in %s seconds.\n' \
        "$attempt" "$((attempt * 10))" >&2
      sleep "$((attempt * 10))"
    fi
  done
  return 1
}

sonar_status=skipped
if [[ "${CI_COMMIT_BRANCH:-}" == "${CI_DEFAULT_BRANCH:-main}" ]]; then
  if [[ -z "${SONAR_TOKEN:-}" ]]; then
    sonar_status=failed
    printf 'SONAR_TOKEN is unavailable; Sonar analysis was not submitted.\n' >&2
  else
    sonar_version="$APP_VERSION"
    if submit_sonar "$sonar_version"; then
      sonar_status=submitted
      printf 'Sonar analysis submitted without waiting on or enforcing the quality gate.\n'
    else
      sonar_status=failed
      printf 'Sonar analysis failed to submit; release/deploy remains independent.\n' >&2
    fi
  fi
else
  printf 'SonarQube Community Build analyzes the default branch only; local quality reports were still generated for %s.\n' \
    "${CI_COMMIT_BRANCH:-detached}"
fi

finish_npm_audits

printf 'SONAR_REPORT_STATUS=%s\nSECURITY_REPORT_STATUS=%s\n' \
  "$sonar_status" "$security_status" > "$quality_dir/quality.env"
printf 'Quality reporting complete: sonar=%s security=%s.\n' "$sonar_status" "$security_status"

if [[ "$sonar_status" == submitted && -f .scannerwork/report-task.txt ]]; then
  cp .scannerwork/report-task.txt "$quality_dir/report-task.txt"
fi

# A submission failure must be visible even though quality does not gate delivery.
[[ "$sonar_status" != failed ]]
