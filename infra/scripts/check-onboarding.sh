#!/bin/sh
# Sourced by delivery jobs; ordinary pipelines retain their existing behavior.
check_onboarding_source() {
  [ "${APP_ONBOARDING:-false}" = true ] || return 0
  [ "${CI_PIPELINE_SOURCE:-}" = api ] &&
    [ -n "${CI_DEFAULT_BRANCH:-}" ] &&
    [ "${CI_COMMIT_BRANCH:-}" = "$CI_DEFAULT_BRANCH" ] || {
    echo 'Onboarding requires an API pipeline on the default branch' >&2
    return 1
  }
  case "${ONBOARDING_EXPECTED_SHA:-}" in
    ''|*[!0-9a-f]*) echo 'Invalid onboarding revision' >&2; return 1 ;;
  esac
  [ "${#ONBOARDING_EXPECTED_SHA}" -eq 40 ] &&
    [ "${CI_COMMIT_SHA:-}" = "$ONBOARDING_EXPECTED_SHA" ] &&
    [ "$(git rev-parse HEAD)" = "$ONBOARDING_EXPECTED_SHA" ] || {
    echo 'The pipeline checkout differs from the approved onboarding revision' >&2
    return 1
  }
}

check_onboarding_head() {
  [ "${APP_ONBOARDING:-false}" = true ] || return 0
  git fetch --quiet origin "$CI_DEFAULT_BRANCH" || return 1
  [ "$(git rev-parse "origin/$CI_DEFAULT_BRANCH")" = "$1" ] || {
    echo 'The default branch advanced; rerun repository onboarding' >&2
    return 1
  }
}
