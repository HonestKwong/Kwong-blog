# 部署指南（Phase 2）

推送到 `main` 后，GitHub Actions 会：

1. 运行 lint / typecheck / test / build
2. 构建并推送镜像到 GHCR：`ghcr.io/<owner>/kwong-blog:<sha>`
3. 仅当 repository variable `ENABLE_DEPLOY=true` 时，SSH 到 VPS 更新 `kwong-web`

日常发布**不会**重启 Xray，也**不会**修改 nginx。

## 一次性服务器接入

### 1. 准备目录与环境文件

```bash
sudo mkdir -p /opt/kwong /var/backups/kwong
sudo chown "$USER":"$USER" /opt/kwong /var/backups/kwong
cp deploy/.env.example /opt/kwong/.env.kwong
# 编辑 /opt/kwong/.env.kwong：填写 SESSION_SECRET、ADMIN_EMAIL、镜像名等
```

确认 `KWONG_DOCKER_NETWORK` 与 `xray-deploy` 中的网络名一致（当前为 `xray-network`）。

### 2. 确认 Docker 网络

```bash
docker network inspect xray-network >/dev/null
```

若 `kwong-web` 使用独立 Compose，网络必须以 `external: true` 方式加入现有网络。

### 3. 替换伪装站的 nginx `location /`

编辑 `xray-deploy` 的站点配置：把 `h1.sock` 与 `h2c.sock` 两个 server 中的 `location /` 换成仓库里的：

`deploy/nginx/kwong-proxy.conf.snippet`

保留 `/trgrpc`、`/vlgrpc`、`/vmgrpc`、`/ssgrpc`、`/vlxh/` 不变。

```bash
docker exec nginx nginx -t
docker exec nginx nginx -s reload
```

### 4. 首次手动启动网站容器

```bash
cd /opt/kwong
# 将仓库 deploy/ 下脚本与 compose 拷到此目录
export KWONG_WEB_IMAGE=ghcr.io/<owner>/kwong-blog:main
docker compose -f docker-compose.kwong.yml pull
docker compose -f docker-compose.kwong.yml up -d
docker inspect -f '{{.State.Health.Status}}' kwong-web
```

### 5. 创建管理员

在能访问数据库文件的环境中执行（容器内或挂载同卷的一次性任务）：

```bash
ADMIN_EMAIL='you@example.com' ADMIN_PASSWORD='your-strong-password' pnpm db:seed
```

或在运行中的容器里用等价方式写入 `User` 表。

## GitHub 配置

### Secrets

| Name | 用途 |
|---|---|
| `DEPLOY_HOST` | VPS IP 或域名 |
| `DEPLOY_USER` | SSH 用户 |
| `DEPLOY_SSH_KEY` | 专用部署私钥 |
| `GHCR_PULL_USER` | 服务器拉取 GHCR 的用户名 |
| `GHCR_PULL_TOKEN` | 具备 `read:packages` 的 token |

### Variables

| Name | 值 |
|---|---|
| `ENABLE_DEPLOY` | `true`（配好 Secrets 与服务器后再打开） |

## 备份

```bash
DB_PATH=/path/to/prod.db BACKUP_DIR=/var/backups/kwong ./backup.sh
./restore.sh /var/backups/kwong/prod-YYYYMMDDTHHMMSSZ.db
```

恢复前建议先停止 `kwong-web`，恢复后再启动。

## 回滚

`deploy.sh` 在健康检查失败时会自动回到上一镜像 SHA。也可手动：

```bash
export KWONG_WEB_IMAGE=ghcr.io/<owner>/kwong-blog:<previous-sha>
./deploy.sh
```
