#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <immutable-image-tag>" >&2
  exit 2
fi

tag="$1"
case "$tag" in
  ''|*[!A-Za-z0-9_.-]*)
    echo "Invalid image tag: $tag" >&2
    exit 2
    ;;
esac

script_dir="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
kustomization="$script_dir/../k8s/overlays/bm-cluster/kustomization.yaml"
temporary="$(mktemp "$kustomization.XXXXXX")"
trap 'rm -f -- "$temporary"' EXIT HUP INT TERM
awk -v tag="$tag" '
  /^  - name:/ { application = ($0 == "  - name: thoughty-server" || $0 == "  - name: thoughty-web") }
  application && /^    newTag:/ { $0 = "    newTag: " tag; count++ }
  { print }
  END { if (count != 2) exit 1 }
' "$kustomization" > "$temporary" || {
  echo 'Expected one server and one web image tag in the Kustomization' >&2
  exit 1
}
cat "$temporary" > "$kustomization"
