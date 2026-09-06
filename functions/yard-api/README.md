# 正式后台 API 说明

`yard-api` 是普通云函数，通过 CloudBase Web SDK 的 `app.callFunction()` 调用。

## 已实现的接口

- `health`：检查云函数是否可用。
- `public.bootstrap`：读取公开宠物档案、公开媒体和联系方式。
- `application.submit`：保存正式领养申请或预约申请，并执行隐藏字段、填表时间、重复提交和频率限制。
- `admin.inbox`：管理员查看收件箱。
- `admin.application.update`：管理员修改申请状态和内部备注。
- `admin.pet.save`：管理员新增或更新宠物档案。
- `admin.settings.save`：管理员修改公开设置。

## 尚待配置的安全项目

- `ADMIN_UIDS`：三位管理员的 CloudBase 用户 UID。
- `WECOM_WEBHOOK`：企业微信群机器人地址，必须只配置在云函数环境变量中。
- 腾讯验证码 SecretId / SecretKey：接入后，申请接口会在服务端执行验证码二次校验。
- 管理员上传媒体的存储策略和 RLS 权限：需要管理员账号创建完成后写入相应 UID。
