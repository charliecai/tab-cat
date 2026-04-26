#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_DIR="$ROOT_DIR/extension"
DIST_DIR="$ROOT_DIR/dist"
PACKAGE_NAME="tab-cat-extension.zip"
PACKAGE_PATH="$DIST_DIR/$PACKAGE_NAME"

if [[ ! -f "$EXTENSION_DIR/manifest.json" ]]; then
  echo "Missing extension/manifest.json" >&2
  exit 1
fi

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

(
  cd "$EXTENSION_DIR"
  find . -type f \
    ! -path './dev/*' \
    ! -name '.DS_Store' \
    ! -name '*~' \
    ! -name '*.map' \
    ! -name 'spec-*' \
    ! -name '*test*' \
    ! -name '*tests*' \
    -print \
    | sort \
    | zip -q "$PACKAGE_PATH" -@
)

echo "Created $PACKAGE_PATH"
unzip -l "$PACKAGE_PATH"
