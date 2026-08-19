#!/usr/bin/env bash
# Long-running Next.js dev server for the Cloud Agent "dev" terminal.
set -euo pipefail

cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
NODE_VERSION="$(cat .nvmrc)"
nvm use "$NODE_VERSION" >/dev/null
export PATH="$(nvm which "$NODE_VERSION" | xargs dirname):$PATH"

corepack enable >/dev/null 2>&1 || true

exec pnpm dev
