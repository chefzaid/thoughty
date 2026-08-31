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
sed -i "/newName: registry.swirlit.dev\/swirlit\/thoughty\/thoughty-server/{n;s/newTag: .*/newTag: $tag/;}" "$kustomization"
sed -i "/newName: registry.swirlit.dev\/swirlit\/thoughty\/thoughty-web/{n;s/newTag: .*/newTag: $tag/;}" "$kustomization"
