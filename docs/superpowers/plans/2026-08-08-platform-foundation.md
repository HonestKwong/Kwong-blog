# 平台地基（Phase 1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建一个可本地运行、带单用户登录、默认私有路由授权和模块化目录约定的 Next.js 单体应用地基，具备类型检查、lint 边界约束、测试、生产 Docker 镜像和 CI。

**Architecture:** Next.js（App Router）单体，前后端同仓库。业务逻辑按 `src/modules/*` 隔离，共享能力沉到 `src/core/*`。Prisma + SQLite 提供持久化并保留迁移到 PostgreSQL/MySQL 的能力。认证使用 `bcryptjs` 哈希密码与 `jose` 签名的 HttpOnly 会话 cookie；路由默认私有，只有显式白名单可匿名访问。

**Tech Stack:** Next.js 15（App Router）、TypeScript、pnpm、Node 20 LTS、Prisma（SQLite）、jose、bcryptjs、Vitest、ESLint + eslint-plugin-boundaries、Docker。

## Global Constraints

- Node 版本固定为 20 LTS（`.nvmrc` 与 `package.json` 的 `engines` 都写 `20`）。
- 包管理器固定为 pnpm；提交 `pnpm-lock.yaml`。
- 语言统一 TypeScript，`strict: true`。
- 所有数据库访问通过 Prisma，业务代码不写裸 SQL。
- 业务模块（`src/modules/*`）之间禁止互相 import；共享能力必须放在 `src/core/*`。
- 路由默认私有：只有显式声明公开的路径可匿名访问。
- 生产镜像多阶段构建，以非 root 用户运行。
- 密钥、SQLite 数据库文件、个人数据不进入 Git。
- 时间统一以 UTC 存储。

---

### Task 1: 初始化 Next.js + TypeScript + pnpm 项目与健康检查

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/api/health/route.ts`
- Create: `vitest.config.ts`
- Create: `src/core/observability/health.ts`
- Test: `src/core/observability/health.test.ts`

**Interfaces:**
- Produces: `getHealth(): { status: "ok"; time: string }` from `src/core/observability/health.ts` — 后续 `/api/health` 与部署健康检查依赖它。

- [ ] **Step 1: 初始化项目骨架与依赖**

```bash
corepack enable
pnpm init
pnpm add next@15 react@18 react-dom@18
pnpm add -D typescript @types/node @types/react @types/react-dom vitest
printf '20\n' > .nvmrc
```

在 `package.json` 中设置脚本与 engines：

```json
{
  "engines": { "node": "20" },
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: 写基础配置文件**

`.gitignore`:

```gitignore
node_modules
.next
out
*.log
.env
.env.*
!.env.example
prisma/*.db
prisma/*.db-journal
data/
coverage
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "jsx": "preserve",
    "incremental": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};
export default nextConfig;
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

- [ ] **Step 3: 写失败测试**

`src/core/observability/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getHealth } from "./health";

describe("getHealth", () => {
  it("returns ok status with an ISO timestamp", () => {
    const result = getHealth();
    expect(result.status).toBe("ok");
    expect(() => new Date(result.time).toISOString()).not.toThrow();
    expect(new Date(result.time).toISOString()).toBe(result.time);
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `pnpm test`
Expected: FAIL，报 `Cannot find module './health'`。

- [ ] **Step 5: 实现健康检查与页面**

`src/core/observability/health.ts`:

```ts
export interface HealthStatus {
  status: "ok";
  time: string;
}

export function getHealth(): HealthStatus {
  return { status: "ok", time: new Date().toISOString() };
}
```

`src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getHealth } from "@/core/observability/health";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getHealth());
}
```

`src/app/layout.tsx`:

```tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "Kwong",
  description: "Personal site",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function HomePage() {
  return <main>Kwong</main>;
}
```

- [ ] **Step 6: 运行测试与类型检查确认通过**

Run: `pnpm test && pnpm typecheck`
Expected: 测试 PASS，类型检查无错误。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: scaffold next.js app with health check"
```

---

### Task 2: ESLint、Prettier 与模块边界约束

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.prettierrc.json`
- Modify: `package.json`（新增 `lint`、`format` 脚本与依赖）
- Create: `src/modules/.gitkeep`
- Test: `src/core/__tests__/boundaries.test.ts`

**Interfaces:**
- Produces: 一条可执行的 lint 规则，禁止 `src/modules/<a>` import `src/modules/<b>`；后续所有模块任务依赖它。

- [ ] **Step 1: 安装依赖**

```bash
pnpm add -D eslint eslint-config-next eslint-plugin-boundaries prettier
```

在 `package.json` 脚本中追加：

```json
{
  "scripts": {
    "lint": "next lint --max-warnings=0",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 2: 写边界校验测试（先失败）**

`src/core/__tests__/boundaries.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("eslint boundaries config", () => {
  it("declares module element types and forbids cross-module imports", () => {
    const config = readFileSync(".eslintrc.cjs", "utf8");
    expect(config).toContain("eslint-plugin-boundaries");
    expect(config).toContain("boundaries/element-types");
    expect(config).toContain("modules");
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm test src/core/__tests__/boundaries.test.ts`
Expected: FAIL，`.eslintrc.cjs` 不存在。

- [ ] **Step 4: 写配置**

`.eslintrc.cjs`:

```js
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "plugin:boundaries/recommended"],
  plugins: ["boundaries"],
  settings: {
    "boundaries/elements": [
      { type: "app", pattern: "src/app/*" },
      { type: "core", pattern: "src/core/*" },
      { type: "modules", pattern: "src/modules/*", capture: ["moduleName"] },
    ],
  },
  rules: {
    "boundaries/element-types": [
      2,
      {
        default: "disallow",
        rules: [
          { from: "app", allow: ["core", "modules"] },
          { from: "core", allow: ["core"] },
          {
            from: "modules",
            allow: ["core", ["modules", { moduleName: "${from.moduleName}" }]],
          },
        ],
      },
    ],
  },
};
```

`.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all"
}
```

`src/modules/.gitkeep`: 空文件。

- [ ] **Step 5: 运行测试、lint 与类型检查确认通过**

Run: `pnpm test src/core/__tests__/boundaries.test.ts && pnpm lint`
Expected: 测试 PASS；lint 无错误（首次运行若提示初始化 Next.js ESLint，选择严格配置）。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "chore: add eslint boundaries and prettier"
```

---

### Task 3: Prisma + SQLite 数据层

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/core/db/client.ts`
- Create: `.env.example`
- Modify: `package.json`（新增 db 脚本与依赖）
- Test: `src/core/db/client.test.ts`

**Interfaces:**
- Produces: `prisma` 单例 from `src/core/db/client.ts`（类型 `PrismaClient`）；后续认证与模块任务依赖它。
- Produces: `User` 模型（字段：`id: String`、`email: String @unique`、`passwordHash: String`、`createdAt: DateTime`）；Task 4 依赖。

- [ ] **Step 1: 安装依赖并初始化**

```bash
pnpm add @prisma/client
pnpm add -D prisma
```

在 `package.json` 脚本中追加：

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy"
  }
}
```

- [ ] **Step 2: 写 schema 与环境示例**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}
```

`.env.example`:

```dotenv
DATABASE_URL="file:./data/dev.db"
SESSION_SECRET="change-me-to-a-long-random-string"
ADMIN_EMAIL="you@example.com"
```

- [ ] **Step 3: 写数据库客户端与失败测试**

`src/core/db/client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "./client";

describe("prisma client", () => {
  it("exposes the user delegate", () => {
    expect(prisma.user).toBeDefined();
    expect(typeof prisma.user.findUnique).toBe("function");
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `pnpm test src/core/db/client.test.ts`
Expected: FAIL，`./client` 或 `@prisma/client` 未生成。

- [ ] **Step 5: 生成 client 与实现单例**

```bash
cp .env.example .env
pnpm db:generate
pnpm db:migrate --name init
```

`src/core/db/client.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm test src/core/db/client.test.ts && pnpm typecheck`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: add prisma sqlite data layer with user model"
```

---

### Task 4: 认证核心（密码哈希 + 会话签名 + 登录/登出接口）

**Files:**
- Create: `src/core/auth/password.ts`
- Create: `src/core/auth/session.ts`
- Create: `src/core/auth/service.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Modify: `package.json`（新增依赖）
- Test: `src/core/auth/password.test.ts`
- Test: `src/core/auth/session.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/core/db/client.ts`；`User` 模型。
- Produces: `hashPassword(plain: string): Promise<string>`、`verifyPassword(plain: string, hash: string): Promise<boolean>` from `password.ts`。
- Produces: `createSessionToken(payload: { userId: string }): Promise<string>`、`verifySessionToken(token: string): Promise<{ userId: string } | null>` from `session.ts`。
- Produces: 常量 `SESSION_COOKIE = "kwong_session"` from `session.ts`；Task 5 依赖。

- [ ] **Step 1: 安装依赖**

```bash
pnpm add bcryptjs jose
pnpm add -D @types/bcryptjs
```

- [ ] **Step 2: 写密码模块失败测试**

`src/core/auth/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("s3cret-pw");
    expect(hash).not.toBe("s3cret-pw");
    expect(await verifyPassword("s3cret-pw", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 3: 写会话模块失败测试**

`src/core/auth/session.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken, SESSION_COOKIE } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-that-is-long-enough-000000";
});

describe("session token", () => {
  it("round-trips a valid token", async () => {
    const token = await createSessionToken({ userId: "u1" });
    const parsed = await verifySessionToken(token);
    expect(parsed?.userId).toBe("u1");
  });

  it("rejects a tampered token", async () => {
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
  });

  it("exposes a stable cookie name", () => {
    expect(SESSION_COOKIE).toBe("kwong_session");
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `pnpm test src/core/auth`
Expected: FAIL，模块不存在。

- [ ] **Step 5: 实现密码与会话模块**

`src/core/auth/password.ts`:

```ts
import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

`src/core/auth/session.ts`（使用 jose，Edge 与 Node 均可运行）:

```ts
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "kwong_session";
const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short");
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(payload: {
  userId: string;
}): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId === "string") {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
```

`src/core/auth/service.ts`:

```ts
import { prisma } from "@/core/db/client";
import { verifyPassword } from "./password";

export async function authenticate(
  email: string,
  password: string,
): Promise<{ userId: string } | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? { userId: user.id } : null;
}
```

`src/app/api/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/core/auth/service";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/core/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const result = await authenticate(email, password);
  if (!result) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await createSessionToken(result);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
```

`src/app/api/auth/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/core/auth/session";

export const runtime = "nodejs";

export function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
```

- [ ] **Step 6: 运行测试与类型检查确认通过**

Run: `pnpm test src/core/auth && pnpm typecheck`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: add single-user auth with session cookies"
```

---

### Task 5: 默认私有的路由授权中间件

**Files:**
- Create: `src/middleware.ts`
- Create: `src/core/auth/public-routes.ts`
- Test: `src/core/auth/public-routes.test.ts`

**Interfaces:**
- Consumes: `verifySessionToken`、`SESSION_COOKIE` from `src/core/auth/session.ts`。
- Produces: `isPublicPath(pathname: string): boolean` from `public-routes.ts`；后续模块通过在此登记来声明公开路径。

- [ ] **Step 1: 写公开路由判定失败测试**

`src/core/auth/public-routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-routes";

describe("isPublicPath", () => {
  it("allows public blog, home, health, login and static assets", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/blog")).toBe(true);
    expect(isPublicPath("/blog/hello-world")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
  });

  it("treats everything else as private", () => {
    expect(isPublicPath("/stocks")).toBe(false);
    expect(isPublicPath("/interview")).toBe(false);
    expect(isPublicPath("/english")).toBe(false);
    expect(isPublicPath("/api/stocks/list")).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/core/auth/public-routes.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现公开白名单与中间件**

`src/core/auth/public-routes.ts`:

```ts
const PUBLIC_PREFIXES = [
  "/blog",
  "/login",
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
```

`src/middleware.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { isPublicPath } from "@/core/auth/public-routes";
import { SESSION_COOKIE, verifySessionToken } from "@/core/auth/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
```

- [ ] **Step 4: 运行测试与类型检查确认通过**

Run: `pnpm test src/core/auth/public-routes.test.ts && pnpm typecheck`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: default-private route middleware with public whitelist"
```

---

### Task 6: 模块框架与示例模块模板

**Files:**
- Create: `src/modules/README.md`
- Create: `src/modules/_template/README.md`
- Create: `src/modules/_template/schema.md`
- Create: `src/core/modules/registry.ts`
- Test: `src/core/modules/registry.test.ts`

**Interfaces:**
- Produces: `ModuleDefinition` 类型与 `registerModule(def: ModuleDefinition): void`、`listModules(): ModuleDefinition[]` from `registry.ts`；后续业务模块任务用它登记导航项与可见性。

- [ ] **Step 1: 写模块注册表失败测试**

`src/core/modules/registry.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { listModules, registerModule, resetRegistry } from "./registry";

describe("module registry", () => {
  beforeEach(() => resetRegistry());

  it("registers and lists modules preserving visibility", () => {
    registerModule({ id: "blog", title: "博客", path: "/blog", visibility: "public" });
    registerModule({ id: "stocks", title: "股票", path: "/stocks", visibility: "private" });
    const all = listModules();
    expect(all.map((m) => m.id)).toEqual(["blog", "stocks"]);
    expect(all.find((m) => m.id === "stocks")?.visibility).toBe("private");
  });

  it("rejects duplicate module ids", () => {
    registerModule({ id: "blog", title: "博客", path: "/blog", visibility: "public" });
    expect(() =>
      registerModule({ id: "blog", title: "重复", path: "/x", visibility: "public" }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/core/modules/registry.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现注册表**

`src/core/modules/registry.ts`:

```ts
export type ModuleVisibility = "public" | "private";

export interface ModuleDefinition {
  id: string;
  title: string;
  path: string;
  visibility: ModuleVisibility;
}

const modules = new Map<string, ModuleDefinition>();

export function registerModule(def: ModuleDefinition): void {
  if (modules.has(def.id)) {
    throw new Error(`Module already registered: ${def.id}`);
  }
  modules.set(def.id, def);
}

export function listModules(): ModuleDefinition[] {
  return [...modules.values()];
}

export function resetRegistry(): void {
  modules.clear();
}
```

- [ ] **Step 4: 写模块约定文档**

`src/modules/README.md`:

```markdown
# 业务模块约定

每个模块是 `src/modules/<id>/` 下的独立目录，包含：

- `README.md`：模块职责、公开接口、数据表、外部依赖、常见修改方式
- `schema.prisma` 片段说明（模型在根 `prisma/schema.prisma` 中）
- `routes/`：页面组件
- `api/`：接口 handler
- `service.ts`：领域逻辑与数据访问

规则：

1. 模块之间禁止互相 import，共享能力放到 `src/core/*`。
2. 新建模块从 `_template` 复制并改名。
3. 模块默认私有，需公开的路径必须登记进 `src/core/auth/public-routes.ts`。
4. 每个模块自带测试。
```

`src/modules/_template/README.md`:

```markdown
# <模块名>

**职责：** 一句话说明。

**公开接口：** 列出对外的页面路径与 API。

**数据表：** 列出该模块拥有的 Prisma 模型。

**外部依赖：** 列出使用的第三方服务与所需环境变量。

**常见修改：** 列出最常见的两三种变更及涉及文件。
```

`src/modules/_template/schema.md`:

```markdown
在根 `prisma/schema.prisma` 中为本模块新增模型，模型名以模块前缀命名，例如 `BlogPost`、`StockPosition`，避免跨模块命名冲突。
```

- [ ] **Step 5: 运行测试、lint 与类型检查确认通过**

Run: `pnpm test src/core/modules/registry.test.ts && pnpm lint && pnpm typecheck`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add module registry and module conventions"
```

---

### Task 7: 核心 UI 外壳与登录页

**Files:**
- Create: `src/core/ui/shell.tsx`
- Create: `src/app/login/page.tsx`
- Modify: `src/app/layout.tsx`（引入外壳）
- Test: `src/core/ui/shell.test.tsx`
- Modify: `vitest.config.ts`（为组件测试增加 jsdom 环境）
- Modify: `package.json`（新增测试依赖）

**Interfaces:**
- Consumes: `listModules` from `src/core/modules/registry.ts`。
- Produces: `AppShell` 组件（props：`children: ReactNode`）from `shell.tsx`。

- [ ] **Step 1: 安装组件测试依赖并配置 jsdom**

```bash
pnpm add -D @testing-library/react @testing-library/dom jsdom
```

`vitest.config.ts` 的 `test` 中增加 `environmentMatchGlobs`：

```ts
  test: {
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
```

- [ ] **Step 2: 写外壳组件失败测试**

`src/core/ui/shell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./shell";

describe("AppShell", () => {
  it("renders its children inside a main region", () => {
    render(<AppShell>hello content</AppShell>);
    expect(screen.getByRole("main")).toHaveTextContent("hello content");
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm test src/core/ui/shell.test.tsx`
Expected: FAIL，模块不存在（或缺少 `toHaveTextContent` 匹配器时用 `expect(screen.getByRole("main").textContent).toContain("hello content")` 替代该断言）。

- [ ] **Step 4: 实现外壳与登录页**

`src/core/ui/shell.tsx`:

```tsx
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div>
      <header>
        <a href="/">Kwong</a>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

`src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") ? next : "/";
    } else {
      setError("邮箱或密码错误");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        邮箱
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
      </label>
      <label>
        密码
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">登录</button>
    </form>
  );
}
```

`src/app/layout.tsx` 改为使用外壳：

```tsx
import type { ReactNode } from "react";
import { AppShell } from "@/core/ui/shell";

export const metadata = {
  title: "Kwong",
  description: "Personal site",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

`src/app/page.tsx` 简化（外壳已提供 main）:

```tsx
export default function HomePage() {
  return <p>欢迎来到 Kwong 的个人网站</p>;
}
```

- [ ] **Step 5: 运行测试与类型检查确认通过**

Run: `pnpm test src/core/ui/shell.test.tsx && pnpm typecheck`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add app shell and login page"
```

---

### Task 8: 生产 Docker 镜像与本地构建验证

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-entrypoint.sh`
- Modify: `package.json`（确认 `start` 使用 standalone 输出）

**Interfaces:**
- Produces: 一个监听 3000、以非 root 运行、启动前执行 `prisma migrate deploy` 的镜像；Phase 2 部署计划依赖 `/api/health` 就绪。

- [ ] **Step 1: 写 .dockerignore 与入口脚本**

`.dockerignore`:

```dockerignore
node_modules
.next
.git
data
*.log
.env
.env.*
!.env.example
coverage
```

`docker-entrypoint.sh`:

```bash
#!/bin/sh
set -e
npx prisma migrate deploy
exec node server.js
```

- [ ] **Step 2: 写多阶段 Dockerfile**

`Dockerfile`:

```dockerfile
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate && pnpm build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

- [ ] **Step 3: 本地构建镜像**

Run: `docker build -t kwong-web:local .`
Expected: 构建成功，无报错。

- [ ] **Step 4: 本地运行并验证健康检查**

Run:

```bash
docker run --rm -d --name kwong-web-test \
  -e DATABASE_URL="file:/app/data/prod.db" \
  -e SESSION_SECRET="local-test-secret-please-change-000" \
  -p 3000:3000 kwong-web:local
sleep 5
curl -fsS http://localhost:3000/api/health
docker rm -f kwong-web-test
```

Expected: 返回 `{"status":"ok","time":"..."}`。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "build: add production dockerfile with migrate-on-start"
```

---

### Task 9: 持续集成工作流

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `package.json` 脚本 `lint`、`typecheck`、`test`、`build`；`Dockerfile`。
- Produces: 在 PR 与 `main` 推送上运行的 CI；Phase 2 部署计划在此基础上追加发布与部署作业。

- [ ] **Step 1: 写 CI 工作流**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

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

  docker:
    runs-on: ubuntu-latest
    needs: verify
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build image (no push)
        uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          tags: kwong-web:ci
```

- [ ] **Step 2: 本地静态校验工作流语法**

Run: `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK`
Expected: 输出 `OK`（若无 python，可用 `pnpm dlx yaml-lint .github/workflows/ci.yml`）。

- [ ] **Step 3: 提交并推送以触发 CI**

```bash
git add -A
git commit -m "ci: add lint, typecheck, test, build and docker workflow"
git push
```

Expected: GitHub Actions 中 `verify` 与 `docker` 两个作业均通过。

---

## Self-Review

**1. Spec coverage（对照设计文档）**

- 模块化单体与目录约定：Task 1/2/6 覆盖。
- 模块边界强制（不只文档）：Task 2 lint 规则 + Task 6 注册表。
- SQLite 数据层与迁移能力：Task 3（Prisma 抽象）。
- 单用户认证、密码哈希、会话 cookie：Task 4。
- 默认拒绝的路由授权：Task 5。
- 核心 UI 与登录：Task 7。
- 健康检查：Task 1 + Task 8。
- 生产镜像非 root、迁移随启动：Task 8。
- CI（lint/类型/测试/构建/镜像）：Task 9。
- 备份恢复、GHCR 发布、VPS 部署、nginx/Xray 接入、搜索实现、四个业务模块：**不在本计划**，属于 Phase 2 部署计划与 Phase 3 各模块计划，符合设计文档的分阶段安排。

**2. Placeholder scan：** 各代码步骤均含完整可运行代码，无 TBD/TODO。

**3. Type consistency：** `SESSION_COOKIE`、`verifySessionToken`、`isPublicPath`、`ModuleDefinition`、`registerModule/listModules`、`AppShell` 在定义任务与消费任务中签名一致。`User` 模型字段（`passwordHash`）在 Task 3 定义、Task 4 使用，一致。

## 后续计划（本计划完成后再各自编写）

- **Phase 2 部署集成计划：** GHCR 发布、SSH 部署脚本与自动回滚、持久化卷、备份恢复、`xray-deploy` 中 nginx server 块与 Compose 网络接入（保留五个 Xray 路径）。
- **Phase 3 业务模块计划（每个模块一份）：** 博客（公开）、面试准备、英语学习、股票看板（含 provider 与刷新策略确认）。
