# 成都猫狗小院 · PRODUCT.md

## Product

- Name: 成都猫狗小院
- Purpose: 为成都本地私人流浪猫狗救助中心提供一个温暖、清晰的领养展示网站，帮助动物找到合适的家庭。
- Primary audience: 通过手机或电脑浏览、了解并申请领养的访客。
- Secondary audience: 至少三位拥有相同权限的管理员，负责维护宠物档案、领养申请与联系方式。

## Core workflows

1. 访客按猫咪/狗狗和状态筛选宠物。
2. 访客打开宠物详情，查看照片、视频、性格、健康和领养要求。
3. 待领养宠物提交正式领养申请。
4. 暂不适合领养宠物提交预约申请，未来可转为正式申请。
5. 管理员查看、跟进并更新申请状态。
6. 管理员添加宠物、上传照片/短视频或视频链接，编辑状态和联系方式。
7. 已领养宠物保留公开档案，持续追加回访照片、视频和生活故事。

## Animal states

- 待领养：展示“申请领养”入口。
- 已领养：保留为公开成功案例，不展示申请按钮，可追加生活更新。
- 暂不适合领养：访客可浏览并使用“预约领养/开放后通知我”入口。

## Application fields

- 姓名
- 年龄
- 性别
- 联系方式
- 是否在成都市及周边有住所
- 是否有养宠经验
- 家庭成员是否同意领养
- 是否有其他宠物
- 补充说明（可选）

## Admin

- 至少三名独立管理员账号。
- 管理员拥有相同权限：宠物资料、媒体、领养/预约申请、网站联系方式和说明文字。
- 申请内部状态：未处理、沟通中、已通过、已登记、等待宠物开放、已通知、已转为正式领养申请、暂不考虑。

## Constraints

- 第一版暂不做捐赠、物资支持、志愿者报名、复杂搜索和多语言。
- 暂无真实图片、视频、Logo 或联系方式，先用示例内容和占位图片进行界面验证。
- 目标平台：响应式 Web，覆盖常见桌面浏览器与手机浏览器。

## Stack

- Delegated to assistant: plain HTML/CSS/JavaScript, no external framework required for the first runnable prototype.
- Future production step: connect a hosted database, object storage, authentication, and domain/hosting.
