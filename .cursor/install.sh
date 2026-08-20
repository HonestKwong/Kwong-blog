#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for Kwong-blog.
# Prepares the repo-pinned Node toolchain, installs dependencies, generates the
# Prisma client, and applies migrations to the local SQLite dev database.
set -euo pipefail

cd "$(dirname "$0")/.."

# Activate the repo-pinned Node version (.nvmrc) and put it ahead of any
# other node on PATH so pnpm/next/prisma run under the intended engine.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
NODE_VERSION="$(cat .nvmrc)"
nvm install "$NODE_VERSION" >/dev/null
nvm use "$NODE_VERSION" >/dev/null
export PATH="$(nvm which "$NODE_VERSION" | xargs dirname):$PATH"

corepack enable
corepack prepare pnpm@9.0.0 --activate

# Non-secret local dev defaults. Created once; never overwrites a real .env.
if [ ! -f .env ]; then
  cat > .env <<'EOF'
DATABASE_URL="file:./data/dev.db"
SESSION_SECRET="dev-session-secret-change-me-please"
ADMIN_EMAIL="admin@example.com"
EOF
fi

# SQLite database lives under prisma/data (git-ignored). Prisma resolves the
# relative file: URL against the schema directory.
mkdir -p prisma/data

pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
