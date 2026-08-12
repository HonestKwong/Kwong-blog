# 部署工件

本目录提供与现有 `xray-deploy`（nginx + Xray）共存的网站部署片段。

## 文件

- `docker-compose.kwong.yml`：只定义 `kwong-web`，加入外部网络 `xray-network`
- `.env.example`：复制为服务器上的 `.env.kwong`（勿提交真实密钥）
- `deploy.sh`：拉取镜像、只重建 `kwong-web`、健康检查失败回滚
- `backup.sh` / `restore.sh`：SQLite 一致性备份与恢复
- `nginx/`：一次性替换伪装站 `location /` 的反代片段

## 网络

`KWONG_DOCKER_NETWORK` 默认 `xray-network`，必须与 `xray-deploy` 的 Compose 网络同名，nginx 才能通过 `http://kwong-web:3000` 访问网站。
