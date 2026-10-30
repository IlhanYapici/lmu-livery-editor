#!/usr/bin/env bash
# Copies the Windows test build to the Desktop of a Windows PC over SSH.
# Usage: LMU_WIN_HOST=user@host npm run deploy:win
set -euo pipefail

: "${LMU_WIN_HOST:?Set LMU_WIN_HOST, e.g. LMU_WIN_HOST=user@192.168.1.10}"
APP_NAME='LMU Livery Editor'
ZIP_NAME='lmu-livery-editor-win.zip'

cd "$(dirname "$0")/.."
[ -d dist/win-unpacked ] || { echo "dist/win-unpacked is missing: run npm run dist:win first" >&2; exit 1; }

rm -f "dist/$ZIP_NAME"
(cd dist/win-unpacked && zip -qr "../$ZIP_NAME" .)

desktop=$(ssh -o BatchMode=yes "$LMU_WIN_HOST" 'powershell -NoProfile -Command "[Environment]::GetFolderPath(\"Desktop\")"' | tr -d '\r')
echo "Copying to $LMU_WIN_HOST:$desktop"
scp -q "dist/$ZIP_NAME" "$LMU_WIN_HOST:$desktop/$ZIP_NAME"

ssh -o BatchMode=yes "$LMU_WIN_HOST" 'powershell -NoProfile -NonInteractive -Command -' <<PS
\$ErrorActionPreference = 'Stop'
\$target = Join-Path '$desktop' '$APP_NAME'
\$zip = Join-Path '$desktop' '$ZIP_NAME'
if (Test-Path -LiteralPath \$target) { Remove-Item -LiteralPath \$target -Recurse -Force }
Expand-Archive -LiteralPath \$zip -DestinationPath \$target
Remove-Item -LiteralPath \$zip
Write-Output "Installed in \$target"
PS
