# 部署集成（Phase 2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让推送到 `main` 后自动构建镜像、推送到 GHCR，并通过 SSH 仅更新 VPS 上的 `kwong-web` 容器；同时交付 nginx/Compose 一次性接入片段、持久化、备份恢复与健康检查增强。

**Architecture:** 应用仓库提供 `deploy/` 下的 Compose 片段、部署脚本与备份脚本。GitHub Actions 在 CI 通过后推送 `ghcr.io/<owner>/kwong-web:<sha>`，再 SSH 到 VPS 执行 `deploy/deploy.sh`。该脚本只 `pull` + `up -d --no-deps kwong-web`，健康检查失败则回滚到上一 SHA。nginx 与 Xray 的改动以仓库内片段形式交付，由人工一次性接入 `xray-deploy`，日常发布不碰它们。

**Tech Stack:** GitHub Actions、GHCR、Docker Compose、SSH、Prisma/SQLite、现有 Next.js `/api/health`。

## Global Constraints

- 部署不得重启 Xray，不得 `docker compose down` 整个项目。
- 日常发布不得修改或 reload nginx；nginx 改动仅一次性接入。
- `/trgrpc`、`/vlgrpc`、`/vmgrpc`、`/ssgrpc`、`/vlxh/` 五个路径必须保留。
- `h1.sock` 与 `h2c.sock` 的网页 `location /` 必须同时反代到网站。
- 镜像标签使用不可变 Git SHA；部署与回滚只用 SHA。
- 密钥、`.env`、SQLite 数据文件、备份密文不进 Git。
- 健康检查不返回敏感信息。
- Node 20、pnpm、Prisma SQLite 约束沿用 Phase 1。

---

### Task 1: 健康检查增加数据库可用性

**Files:**
- Modify: `src/core/observability/health.ts`
- Modify: `src/core/observability/health.test.ts`
- Modify: `src/app/api/health/route.ts`

**Interfaces:**
- Consumes: `prisma` from `src/core/db/client.ts`
- Produces: `getHealth(): Promise<{ status: "ok" | "degraded"; time: string; db: "up" | "down" }>`
- Produces: HTTP 200 when `db === "up"`，503 when `db === "down"`（部署脚本据此判定）

- [ ] **Step 1: 改写失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/core/db/client", () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

describe("getHealth", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("reports ok when database responds", async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    const { getHealth } = await import("./health");
    const result = await getHealth();
    expect(result).toMatchObject({ status: "ok", db: "up" });
    expect(() => new Date(result.time).toISOString()).not.toThrow();
  });

  it("reports degraded when database fails", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    const { getHealth } = await import("./health");
    const result = await getHealth();
    expect(result).toMatchObject({ status: "degraded", db: "down" });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/core/observability/health.test.ts`
Expected: FAIL（当前 `getHealth` 仍是同步且无 `db` 字段）。

- [ ] **Step 3: 实现异步健康检查**

`src/core/observability/health.ts`:

```ts
import { prisma } from "@/core/db/client";

export interface HealthStatus {
  status: "ok" | "degraded";
  time: string;
  db: "up" | "down";
}

export async function getHealth(): Promise<HealthStatus> {
  const time = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
    return { status: "ok", time, db: "up" };
  } catch {
    return { status: "degraded", time, db: "down" };
  }
}
```

`src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getHealth } from "@/core/observability/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealth();
  const status = health.db === "up" ? 200 : 503;
  return NextResponse.json(health, { status });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/core/observability/health.test.ts && pnpm typecheck`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/observability/health.ts src/core/observability/health.test.ts src/app/api/health/route.ts
git commit -m "feat: include database readiness in health check"
```

---

### Task 2: 部署 Compose 片段与环境模板

**Files:**
- Create: `deploy/docker-compose.kwong.yml`
- Create: `deploy/.env.example`
- Create: `deploy/README.md`
- Test: `deploy/compose.test.ts`

**Interfaces:**
- Produces: Compose 服务名固定为 `kwong-web`，镜像变量 `KWONG_WEB_IMAGE`，网络名变量 `KWONG_DOCKER_NETWORK`（默认 `mynetwork`），数据卷 `kwong_data`。
- Produces: 容器只 `expose: ["3000"]`，不映射宿主机端口。

- [ ] **Step 1: 写 Compose 校验测试**

`deploy/compose.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deploy compose fragment", () => {
  const yaml = readFileSync("deploy/docker-compose.kwong.yml", "utf8");

  it("defines kwong-web without publishing host ports", () => {
    expect(yaml).toContain("container_name: kwong-web");
    expect(yaml).toContain("expose:");
    expect(yaml).toContain('"3000"');
    expect(yaml).not.toMatch(/^\s*ports:/m);
  });

  it("uses a named volume and external network", () => {
    expect(yaml).toContain("kwong_data:");
    expect(yaml).toContain("external: true");
    expect(yaml).toContain("${KWONG_DOCKER_NETWORK:-mynetwork}");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test deploy/compose.test.ts`
Expected: FAIL，文件不存在。

- [ ] **Step 3: 写 Compose 与环境模板**

`deploy/docker-compose.kwong.yml`:

```yaml
services:
  kwong-web:
    image: ${KWONG_WEB_IMAGE}
    container_name: kwong-web
    restart: unless-stopped
    expose:
      - "3000"
    env_file:
      - .env.kwong
    volumes:
      - kwong_data:/app/data
    networks:
      - kwong_net
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 20s

volumes:
  kwong_data:

networks:
  kwong_net:
    name: ${KWONG_DOCKER_NETWORK:-mynetwork}
    external: true
```

`deploy/.env.example`:

```dotenv
KWONG_WEB_IMAGE=ghcr.io/honestkwong/kwong-blog:REPLACE_SHA
KWONG_DOCKER_NETWORK=mynetwork
DATABASE_URL=file:/app/data/prod.db
SESSION_SECRET=replace-with-long-random-secret
ADMIN_EMAIL=you@example.com
```

`deploy/README.md` 简要说明：将此 Compose 与 `xray-deploy` 共用 `mynetwork`，或把 `kwong-web` 服务追加进现有 Compose；敏感值写入服务器上的 `.env.kwong`。

- [ ] **Step 4: 更新 vitest include 并跑通测试**

在 `vitest.config.ts` 的 `include` 增加 `"deploy/**/*.test.ts"`。

Run: `pnpm test deploy/compose.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add deploy vitest.config.ts
git commit -m "feat: add kwong-web compose fragment and env template"
```

---

### Task 3: nginx 一次性接入片段（保留 Xray 路径）

**Files:**
- Create: `deploy/nginx/kwong-proxy.conf.snippet`
- Create: `deploy/nginx/README.md`
- Test: `deploy/nginx/snippet.test.ts`

**Interfaces:**
- Produces: 可粘贴到 `h1.sock`/`h2c.sock` server 块中替换原 `location /` 的片段；显式不包含五个 Xray location。

- [ ] **Step 1: 写片段测试**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nginx kwong proxy snippet", () => {
  const snippet = readFileSync("deploy/nginx/kwong-proxy.conf.snippet", "utf8");

  it("proxies to kwong-web:3000 with forwarded headers", () => {
    expect(snippet).toContain("proxy_pass http://kwong-web:3000;");
    expect(snippet).toContain("X-Forwarded-Proto https");
    expect(snippet).toContain("X-Real-IP");
  });

  it("does not redefine Xray gRPC locations", () => {
    for (const path of ["/trgrpc", "/vlgrpc", "/vmgrpc", "/ssgrpc", "/vlxh/"]) {
      expect(snippet).not.toContain(path);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test deploy/nginx/snippet.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写片段与说明**

`deploy/nginx/kwong-proxy.conf.snippet`:

```nginx
# Replace ONLY the existing `location /` blocks in both
# unix:/dev/shm/h1.sock and unix:/dev/shm/h2c.sock servers.
# Keep /trgrpc /vlgrpc /vmgrpc /ssgrpc /vlxh/ unchanged.
location / {
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_pass http://kwong-web:3000;
}
```

`deploy/nginx/README.md`：说明一次性步骤——语法检查 `nginx -t`，然后 `docker exec nginx nginx -s reload`，绝不重启 xray。

- [ ] **Step 4: 跑通测试并提交**

```bash
pnpm test deploy/nginx/snippet.test.ts
git add deploy/nginx
git commit -m "docs: add nginx reverse-proxy snippet preserving xray paths"
```

---

### Task 4: 部署脚本（仅更新 kwong-web + 健康检查回滚）

**Files:**
- Create: `deploy/deploy.sh`
- Test: `deploy/deploy.test.ts`

**Interfaces:**
- Consumes: 环境变量 `KWONG_WEB_IMAGE`（完整镜像引用，含 SHA）、`HEALTH_URL`（默认 `http://127.0.0.1:3000/api/health`，在容器网络内用 `http://kwong-web:3000/api/health`）、`COMPOSE_FILE`（默认 `deploy/docker-compose.kwong.yml`）。
- Produces: 退出码 0 表示部署成功；失败时回滚上一镜像并退出非 0。
- 禁止：`compose down`、重启名为 `xray`/`nginx` 的容器。

- [ ] **Step 1: 写脚本契约测试**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deploy.sh", () => {
  const script = readFileSync("deploy/deploy.sh", "utf8");

  it("pulls and recreates only kwong-web", () => {
    expect(script).toContain("docker compose");
    expect(script).toContain("up -d --no-deps --force-recreate kwong-web");
    expect(script).not.toContain("compose down");
    expect(script).not.toMatch(/restart\s+xray/);
    expect(script).not.toMatch(/restart\s+nginx/);
  });

  it("health-checks and rolls back previous image on failure", () => {
    expect(script).toContain("/api/health");
    expect(script).toContain("PREVIOUS_IMAGE");
    expect(script).toContain("rollback");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test deploy/deploy.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 deploy.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.kwong.yml}"
HEALTH_URL="${HEALTH_URL:-http://kwong-web:3000/api/health}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-90}"

if [[ -z "${KWONG_WEB_IMAGE:-}" ]]; then
  echo "KWONG_WEB_IMAGE is required" >&2
  exit 1
fi

PREVIOUS_IMAGE="$(docker inspect -f '{{.Config.Image}}' kwong-web 2>/dev/null || true)"
echo "Deploying ${KWONG_WEB_IMAGE}"
echo "Previous image: ${PREVIOUS_IMAGE:-<none>}"

export KWONG_WEB_IMAGE
docker compose -f "$COMPOSE_FILE" pull kwong-web
docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate kwong-web

deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
until curl -fsS "$HEALTH_URL" >/tmp/kwong-health.json; do
  if (( SECONDS >= deadline )); then
    echo "Health check failed; starting rollback" >&2
    if [[ -n "${PREVIOUS_IMAGE}" ]]; then
      KWONG_WEB_IMAGE="$PREVIOUS_IMAGE" docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate kwong-web
      echo "Rolled back to ${PREVIOUS_IMAGE}" >&2
    fi
    exit 1
  fi
  sleep 3
done

echo "Deploy healthy: $(cat /tmp/kwong-health.json)"
docker image prune -f >/dev/null || true
```

赋予可执行权限：`chmod +x deploy/deploy.sh`。

- [ ] **Step 4: 跑通测试并提交**

```bash
pnpm test deploy/deploy.test.ts
git add deploy/deploy.sh deploy/deploy.test.ts
git commit -m "feat: add kwong-web deploy script with healthcheck rollback"
```

---

### Task 5: SQLite 备份与恢复脚本

**Files:**
- Create: `deploy/backup.sh`
- Create: `deploy/restore.sh`
- Test: `deploy/backup.test.ts`

**Interfaces:**
- `backup.sh` 使用 `sqlite3 .backup` 生成一致性副本到 `BACKUP_DIR`，保留 `RETENTION_DAYS`（默认 7）。
- `restore.sh` 从指定备份文件恢复到 `DATA_DIR/prod.db`（先停写：要求调用方已停止 `kwong-web` 或接受短暂锁定）。

- [ ] **Step 1: 写契约测试**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("backup/restore scripts", () => {
  const backup = readFileSync("deploy/backup.sh", "utf8");
  const restore = readFileSync("deploy/restore.sh", "utf8");

  it("uses sqlite online backup API, not raw file copy of a live db", () => {
    expect(backup).toContain(".backup");
    expect(backup).not.toMatch(/cp\s+"?\$\{?DB_PATH/);
  });

  it("restore writes to DATA_DIR and verifies file exists", () => {
    expect(restore).toContain("DATA_DIR");
    expect(restore).toContain("prod.db");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test deploy/backup.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现脚本**

`deploy/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DB_PATH="${DB_PATH:-/app/data/prod.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kwong}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/prod-$stamp.db"
sqlite3 "$DB_PATH" ".backup '$target'"
find "$BACKUP_DIR" -type f -name 'prod-*.db' -mtime +"$RETENTION_DAYS" -delete
echo "$target"
```

`deploy/restore.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DATA_DIR="${DATA_DIR:-/app/data}"
SOURCE="${1:-}"
if [[ -z "$SOURCE" || ! -f "$SOURCE" ]]; then
  echo "Usage: $0 <backup-file>" >&2
  exit 1
fi
mkdir -p "$DATA_DIR"
cp "$SOURCE" "$DATA_DIR/prod.db"
echo "Restored $SOURCE -> $DATA_DIR/prod.db"
```

`chmod +x deploy/backup.sh deploy/restore.sh`

- [ ] **Step 4: 跑通测试并提交**

```bash
pnpm test deploy/backup.test.ts
git add deploy/backup.sh deploy/restore.sh deploy/backup.test.ts
git commit -m "feat: add sqlite backup and restore scripts"
```

---

### Task 6: GHCR 发布工作流

**Files:**
- Modify: `.github/workflows/ci.yml`（或新建 `.github/workflows/publish.yml`）
- Create: `.github/workflows/publish.yml`（推荐独立，避免 PR 推镜像）

**Interfaces:**
- 仅在 `main` push 且 `verify` 通过后推送镜像。
- 标签：`ghcr.io/<lowercase-owner>/<repo>:<sha>` 与 `:main`。
- 权限：`packages: write`、`contents: read`。

- [ ] **Step 1: 写 publish 工作流**

`.github/workflows/publish.yml`:

```yaml
name: Publish

on:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: "file:./data/ci.db"
      SESSION_SECRET: "ci-secret-that-is-long-enough-000000"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

  publish:
    needs: verify
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image: ${{ steps.meta.outputs.image }}
    steps:
      - uses: actions/checkout@v4
      - name: Image name
        id: meta
        run: |
          OWNER=$(echo "${{ github.repository_owner }}" | tr '[:upper:]' '[:lower:]')
          REPO=$(echo "${{ github.event.repository.name }}" | tr '[:upper:]' '[:lower:]')
          SHA="${{ github.sha }}"
          echo "image=ghcr.io/${OWNER}/${REPO}:${SHA}" >> "$GITHUB_OUTPUT"
          echo "main=ghcr.io/${OWNER}/${REPO}:main" >> "$GITHUB_OUTPUT"
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ${{ steps.meta.outputs.image }}
            ${{ steps.meta.outputs.main }}

  deploy:
    needs: publish
    runs-on: ubuntu-latest
    if: ${{ vars.ENABLE_DEPLOY == 'true' }}
    steps:
      - uses: actions/checkout@v4
      - name: Copy deploy assets
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          source: "deploy/*"
          target: "/opt/kwong"
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            set -euo pipefail
            cd /opt/kwong
            echo "${{ secrets.GHCR_PULL_TOKEN }}" | docker login ghcr.io -u "${{ secrets.GHCR_PULL_USER }}" --password-stdin
            export KWONG_WEB_IMAGE="${{ needs.publish.outputs.image }}"
            export COMPOSE_FILE="/opt/kwong/docker-compose.kwong.yml"
            export HEALTH_URL="http://kwong-web:3000/api/health"
            ./deploy.sh
```

- [ ] **Step 2: 本地校验 YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/publish.yml')); print('OK')"`
Expected: `OK`。

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: publish image to ghcr and optionally deploy over ssh"
```

说明：`ENABLE_DEPLOY` repository variable 默认可不设；用户配好 Secrets 后设为 `true` 才真正部署，避免未就绪时失败。

---

### Task 7: 管理员种子脚本与部署文档

**Files:**
- Create: `scripts/seed-admin.ts`
- Create: `docs/DEPLOY.md`
- Modify: `package.json`（`db:seed` 脚本）
- Test: `scripts/seed-admin.test.ts`

**Interfaces:**
- `seedAdmin({ email, password })`：若用户不存在则创建；若存在则更新密码哈希。
- `docs/DEPLOY.md`：一次性接入步骤 + GitHub Secrets 清单 + 启用 `ENABLE_DEPLOY`。

- [ ] **Step 1: 写种子函数测试（内存 mock）**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock("@/core/db/client", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => create(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

vi.mock("@/core/auth/password", () => ({
  hashPassword: vi.fn(async () => "hashed"),
}));

describe("seedAdmin", () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    update.mockReset();
  });

  it("creates a user when missing", async () => {
    findUnique.mockResolvedValue(null);
    const { seedAdmin } = await import("./seed-admin");
    await seedAdmin({ email: "a@b.c", password: "pw" });
    expect(create).toHaveBeenCalled();
  });

  it("updates password when user exists", async () => {
    findUnique.mockResolvedValue({ id: "u1", email: "a@b.c" });
    const { seedAdmin } = await import("./seed-admin");
    await seedAdmin({ email: "a@b.c", password: "pw" });
    expect(update).toHaveBeenCalledWith({
      where: { email: "a@b.c" },
      data: { passwordHash: "hashed" },
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test scripts/seed-admin.test.ts`
Expected: FAIL。把 `scripts/**/*.test.ts` 加入 vitest include。

- [ ] **Step 3: 实现种子脚本与文档**

`scripts/seed-admin.ts`:

```ts
import { prisma } from "../src/core/db/client";
import { hashPassword } from "../src/core/auth/password";

export async function seedAdmin(input: {
  email: string;
  password: string;
}): Promise<void> {
  const passwordHash = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (!existing) {
    await prisma.user.create({
      data: { email: input.email, passwordHash },
    });
    return;
  }
  await prisma.user.update({
    where: { email: input.email },
    data: { passwordHash },
  });
}

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }
  await seedAdmin({ email, password });
  console.log(`Admin ready: ${email}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // no-op for ts runners that don't set import.meta main; use explicit CLI below
}

if (require.main === module) {
  main().finally(async () => prisma.$disconnect());
}
```

为避免 CJS/ESM 麻烦，改为导出函数 + 使用 `tsx` CLI：

`package.json` 增加：

```json
{
  "scripts": {
    "db:seed": "tsx scripts/seed-admin-cli.ts"
  }
}
```

`scripts/seed-admin-cli.ts`:

```ts
import { prisma } from "../src/core/db/client";
import { seedAdmin } from "./seed-admin";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }
  await seedAdmin({ email, password });
  console.log(`Admin ready: ${email}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
```

安装：`pnpm add -D tsx`

`docs/DEPLOY.md` 必须包含：

1. 在 VPS 上创建 `/opt/kwong`，放入 compose、`.env.kwong`、脚本；
2. 确认 Docker 网络名与 `xray-deploy` 的 `mynetwork` 一致；
3. 一次性替换 nginx `location /`（h1 + h2c），`nginx -t` 后 reload；
4. 配置 GitHub Secrets：`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`GHCR_PULL_USER`、`GHCR_PULL_TOKEN`；
5. 设置 repository variable `ENABLE_DEPLOY=true`；
6. 首次部署后用 `ADMIN_EMAIL`/`ADMIN_PASSWORD` 运行种子创建管理员。

- [ ] **Step 4: 跑通测试并提交**

```bash
pnpm test scripts/seed-admin.test.ts
git add scripts package.json pnpm-lock.yaml docs/DEPLOY.md vitest.config.ts
git commit -m "feat: add admin seed script and deployment guide"
```

---

## Self-Review

**1. Spec coverage**

- GHCR 发布：Task 6
- SSH 自动部署与回滚：Task 4 + Task 6
- 持久化卷：Task 2
- 备份恢复：Task 5
- nginx/Compose 一次性接入：Task 2 + Task 3 + Task 7 文档
- 健康检查含数据库：Task 1
- 不重启 Xray / 不 down 整个 compose：Task 4 契约测试强制
- 五个 Xray 路径保留：Task 3 契约测试强制

**2. Placeholder scan：** 步骤含完整文件内容；服务器侧 Secrets 通过 `ENABLE_DEPLOY` 开关与 `docs/DEPLOY.md` 明确为人工配置，不是代码占位。

**3. Type consistency：** `getHealth` 改为 async 后，route 与测试同步更新；Compose 服务名 `kwong-web` 与脚本、nginx snippet、workflow 一致。

## 执行时依赖用户提供的 Secrets（代码无法代替）

- `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY`
- `GHCR_PULL_USER` / `GHCR_PULL_TOKEN`（可用 PAT 或 deploy 机器登录 GHCR）
- repository variable `ENABLE_DEPLOY=true`
- 服务器上一次性接入 nginx 片段并确认网络名

在这些未配置前，仓库内工件与 `publish` 的镜像推送仍可落地；真正的 VPS 部署步骤保持关闭。
