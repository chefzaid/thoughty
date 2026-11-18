#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"
# shellcheck source=infra/scripts/check-onboarding.sh
source "$repository_root/infra/scripts/check-onboarding.sh"

mode="${1:-verify}"
: "${APP_VERSION:?APP_VERSION is required}"
: "${REGISTRY_PUSH_HOST:?REGISTRY_PUSH_HOST is required}"
: "${KANIKO_EXECUTOR:?KANIKO_EXECUTOR is required}"

case "$mode" in
  verify)
    ;;
  publish)
    check_onboarding_source
    check_onboarding_head "${CI_COMMIT_SHA:-}"
    : "${CI_REGISTRY_USER:?CI_REGISTRY_USER is required}"
    : "${CI_REGISTRY_PASSWORD:?CI_REGISTRY_PASSWORD is required}"
    mkdir -p /kaniko/.docker
    jq -n --arg registry "$REGISTRY_PUSH_HOST" --arg username "$CI_REGISTRY_USER" \
      --arg password "$CI_REGISTRY_PASSWORD" \
      '{auths:{($registry):{username:$username,password:$password}}}' \
      > /kaniko/.docker/config.json
    export DOCKER_CONFIG=/kaniko/.docker
    ;;
  *)
    printf 'Usage: %s [verify|publish]\n' "$0" >&2
    exit 2
    ;;
esac

# Docker Hub base images come through the group's GitLab Dependency Proxy, which is not held to
# Docker Hub's anonymous pull limit. Kaniko still falls back to Docker Hub if the mirror fails.
mirror_options=()
if [[ -n "${CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX:-}" ]]; then
  : "${CI_DEPENDENCY_PROXY_SERVER:?CI_DEPENDENCY_PROXY_SERVER is required}"
  : "${CI_DEPENDENCY_PROXY_USER:?CI_DEPENDENCY_PROXY_USER is required}"
  : "${CI_DEPENDENCY_PROXY_PASSWORD:?CI_DEPENDENCY_PROXY_PASSWORD is required}"
  docker_config=/kaniko/.docker/config.json
  # The credentials are read from the environment, so they never appear in a command line.
  proxy_auth='($ENV.CI_DEPENDENCY_PROXY_USER + ":" + $ENV.CI_DEPENDENCY_PROXY_PASSWORD | @base64) as $auth
    | $ENV.CI_DEPENDENCY_PROXY_SERVER as $server
    | .auths += {($server): {auth: $auth}, ($server | sub(":443$"; "")): {auth: $auth}}'
  mkdir -p /kaniko/.docker
  if [[ -s "$docker_config" ]]; then
    jq "$proxy_auth" "$docker_config" > "$docker_config.next"
  else
    jq -n "$proxy_auth" > "$docker_config.next"
  fi
  mv "$docker_config.next" "$docker_config"
  export DOCKER_CONFIG=/kaniko/.docker
  mirror_options=(--registry-mirror "$CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX")
else
  printf 'The GitLab Dependency Proxy is not available; base images come from Docker Hub.\n' >&2
fi

build_image() {
  local name="$1" context="$2" dockerfile="$3"
  local repository="$REGISTRY_PUSH_HOST/$CI_PROJECT_PATH/$name"
  local options=(
    --context "dir://$context"
    --dockerfile "$dockerfile"
    --destination "$repository:$APP_VERSION"
    --insecure-registry "$REGISTRY_PUSH_HOST"
    "${mirror_options[@]}"
  )
  if [[ "$mode" == publish ]]; then
    options+=(--cache=true --cache-repo "$repository/cache" --cache-ttl=720h)
  else
    options+=(--no-push --cache=false)
  fi
  "$KANIKO_EXECUTOR" "${options[@]}"
}

build_image thoughty-server "$repository_root/thoughty-server" "$repository_root/thoughty-server/Dockerfile.runtime"
build_image thoughty-web "$repository_root/thoughty-web" "$repository_root/thoughty-web/Dockerfile.runtime"
