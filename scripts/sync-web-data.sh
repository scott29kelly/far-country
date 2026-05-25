#!/usr/bin/env bash
# Sync the canonical export from the pipeline into the web app's public dir,
# then rebuild the embedding index. See docs/specs/phase-2-browse-ui.md §3.6.
#
# Run after `far-country export --out-dir data/exports`. Idempotent: existing
# files under apps/web/public/data/ are replaced so stale entries cannot leak.
#
# Required env (for the embedding build): OPENAI_API_KEY. See ADR 0007.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${REPO_ROOT}/data/exports"
DEST_DIR="${REPO_ROOT}/apps/web/public/data"

if [[ ! -f "${SRC_DIR}/canonical.json" || ! -f "${SRC_DIR}/manifest.json" ]]; then
  echo "sync-web-data: missing exports under ${SRC_DIR}." >&2
  echo "  Run: uv --project pipeline run far-country export --out-dir data/exports" >&2
  exit 1
fi

echo "sync-web-data: replacing ${DEST_DIR} from ${SRC_DIR}"
rm -rf "${DEST_DIR}"
mkdir -p "${DEST_DIR}"
cp -R "${SRC_DIR}/." "${DEST_DIR}/"

echo "sync-web-data: rebuilding embedding index"
npm --prefix "${REPO_ROOT}/apps/web" run build:index

echo "sync-web-data: done"
