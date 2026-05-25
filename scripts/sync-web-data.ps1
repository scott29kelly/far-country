# Sync the canonical export from the pipeline into the web app's public dir,
# then rebuild the embedding index. See docs/specs/phase-2-browse-ui.md §3.6.
#
# Run after `far-country export --out-dir data/exports`. Idempotent: existing
# files under apps/web/public/data/ are replaced so stale entries cannot leak.
#
# Required env (for the embedding build): OPENAI_API_KEY. See ADR 0007.

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$SrcDir = Join-Path $RepoRoot 'data\exports'
$DestDir = Join-Path $RepoRoot 'apps\web\public\data'

if (-not (Test-Path (Join-Path $SrcDir 'canonical.json')) -or `
    -not (Test-Path (Join-Path $SrcDir 'manifest.json'))) {
    Write-Error "sync-web-data: missing exports under $SrcDir.`n  Run: uv --project pipeline run far-country export --out-dir data/exports"
    exit 1
}

Write-Host "sync-web-data: replacing $DestDir from $SrcDir"
if (Test-Path $DestDir) {
    Remove-Item -Recurse -Force $DestDir
}
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $SrcDir '*') $DestDir

Write-Host 'sync-web-data: rebuilding embedding index'
npm --prefix (Join-Path $RepoRoot 'apps\web') run build:index
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'sync-web-data: done'
