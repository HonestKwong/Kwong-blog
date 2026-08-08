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
