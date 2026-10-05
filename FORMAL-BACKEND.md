# 正式后台开发说明

## 当前状态

- 测试展示网站已发布到 CloudBase 静态托管。
- 本目录中的 `database/schema.sql` 创建正式后台的数据表和 `yard-media` 媒体桶。
- `functions/yard-api` 是后续的云端接口：公开读取宠物、提交申请、管理员收件箱、宠物资料管理。

## 上线顺序

1. 通过 CloudBase CLI 执行 `database/schema.sql`。
2. 在 CloudBase 身份认证中启用“用户名 + 密码”管理员登录方式。
3. 创建管理员账号，并把对应 UID 写入 `yard_administrators` 表。
4. 配置 `ADMIN_UIDS`、企业微信群机器人 Webhook 和腾讯验证码密钥。
5. 部署 `yard-api` 云函数。
6. 发布新版静态站点。

## 不应提交的内容

- 管理员密码
- CloudBase API Key
- PostgreSQL 连接密码
- 企业微信群机器人 Webhook
- 腾讯验证码密钥
