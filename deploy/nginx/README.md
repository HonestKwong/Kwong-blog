# nginx 一次性接入

将 `kwong-proxy.conf.snippet` 中的 `location /` **分别**替换到：

1. `listen unix:/dev/shm/h1.sock ...` 的 server 块
2. `listen unix:/dev/shm/h2c.sock ...` 的 server 块

**不要**改动 `/trgrpc`、`/vlgrpc`、`/vmgrpc`、`/ssgrpc`、`/vlxh/`。

校验并重载（不重启 Xray）：

```bash
docker exec nginx nginx -t
docker exec nginx nginx -s reload
```
