# 成都猫狗小院 · 流浪猫狗领养平台

> 「传智杯」全国 IT 技能大赛 · **AI WEB 网页开发挑战赛**参赛作品
> 赛项主题：**健康守护**

**线上演示**：<https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.tcloudbaseapp.com/>
（进入页面后点导航栏「**AI 匹配**」，或直接跳到 `#match` 区块）

---

## 一句话介绍

这是一个**已经在为真实流浪动物救助站服务**的领养平台。参赛期间我们为它加入了 AI 能力，
把它从「能收申请」推进到「能判断什么样的领养更可能成功」。

## 我们解决的真实问题

流浪动物救助的痛点不只在动物身上，更在「人」与「动物」的匹配环节：

**① 访客不知道该选哪只，凭一张照片就冲动申请**

到沟通阶段才发现「租房不让养」「家人不同意」「白天没人遛狗」——两边都白耗精力。
而**不匹配的领养，最后往往演变成二次遗弃**，这正是「健康守护」要解决的问题。

**② 管理员要逐条读长申请，还要对照该宠物的领养要求找缺口**

小院只有三位管理员，申请已经在真实进来，人工逐条比对很费神。

## AI 能力

### ① AI 领养匹配助手 —— 已上线

访客用自然语言描述自己的居住情况、作息、养宠经验、家人态度，
AI 结合站内**宠物公开档案**推荐 1–3 只，并：

- 对每只推荐**说明理由**，理由必须对应档案里的具体条目
- **主动提示容易忽略的风险**（租房是否经房东同意、家人是否都同意、白天是否有人在家）
- 条件都不匹配时**如实说明**并给改善建议，不硬推

工程上的几个要点：

| 要点 | 做法 |
| --- | --- |
| 真实流式 | HTTP 云函数 + SSE，边生成边显示（不是等整段返回做假打字机） |
| 密钥不出服务端 | 模型 Key 只从环境变量或数据库读取，前端只调用自己的云函数 |
| 额度保护 | 按 IP 限频，IP **只存 SHA-256 哈希**，不存明文 |
| 输入约束 | 请求体 16 KB、单条消息 600 字、最多 8 轮 |
| 数据边界 | 只发送「宠物公开档案 + 访客自述」，**不含任何申请人隐私** |
| 降级可用 | 未配置模型 Key 时自动进入演示模式，页面功能不中断 |

### ② AI 申请摘要与条件比对 —— 开发中

把一份长申请压成 3 行要点，并对照该宠物的领养要求标出缺口
（如「未提及封窗」「家庭意见尚未沟通」），给管理员 1–2 个沟通时可以问的问题。

> 我们**不让 AI 做录取决定**，它只做信息整理与提示，决定权始终在管理员。

## 关于项目基线（如实说明）

**成都猫狗小院是真实在运营的私人流浪动物救助站。**
本站点的**基础版本**（宠物档案展示、领养申请提交、管理员后台、企业微信提醒）
在 **2026 年 9 月已完成并上线**，早于本次参赛。

**参赛期间**（2026 年 10 月起）新增的工作集中在 AI 能力与工程质量上，
全部记录在本仓库的提交历史中：

| 提交 | 内容 |
| --- | --- |
| `feat(ai): 新增 AI 流式代理云函数 ai-stream` | SSE 流式代理、限频、隐私边界 |
| `test(ai): 新增 AI 对话与 SSE 流式验证脚本` | 端到端验证（含流式真实性实测） |
| `feat(web): 首页接入 AI 领养匹配助手` | 对话面板，复用既有设计语言 |

我们选择把这一点写清楚，而不是含糊带过。原因有两个：
提交历史本身可查；而且我们认为，**一个已经在服务真实用户的系统，
比一个没有用户的演示更有说服力**。

## 技术架构

```text
浏览器（原生 JS 单页 + 响应式 CSS）
   │
   ├─ 匿名会话 ──→ CloudBase 网关 ──→ 云函数 yard-api（Event）
   │                                      ├─ PostgreSQL（RLS 策略约束权限）
   │                                      └─ 企业微信群机器人提醒
   │
   └─ AI 对话 ──→ HTTP 云函数 ai-stream（SSE 流式）
                     ├─ 读取宠物公开档案
                     ├─ 调用大模型（Key 只在服务端）
                     └─ 按 IP 限频（哈希存储）
```

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 前端 | 原生 JS + CSS（无构建步骤） | 首屏极轻；复用既有设计系统 |
| 业务后端 | CloudBase 云函数 `yard-api`（Event） | 申请提交、令牌校验、后台接口 |
| AI 后端 | CloudBase 云函数 `ai-stream`（HTTP） | **SSE 流式只在 HTTP 云函数可用** |
| 数据库 | CloudBase PostgreSQL（RDB） | 全部表启用 RLS，权限由数据库决定 |
| 存储 | 对象存储桶 `yard-media` | 公开桶，仅存宠物影像与二维码 |
| 部署 | CloudBase 静态托管 | 发布 `release/` 下三个文件 |

### 为什么 AI 单独一个云函数

现有 `yard-api` 是 Event 类型，经网关调用**只返回一次性 JSON，无法边算边推**。
SSE 流式响应只在 HTTP（Web）云函数上支持，因此 AI 代理单独部署，
也顺带做到了风险隔离：AI 服务异常不影响领养申请这件核心业务。

## 环境配置说明

### 云端资源

| 项 | 值 |
| --- | --- |
| 平台 | 腾讯云 CloudBase（云开发） |
| 环境 ID | `chuanzhibei-d3gvmowp1e63d7f33` |
| 地域 | `ap-shanghai` |
| 数据库 | PostgreSQL RDB，schema `public` |
| 对象存储 | 桶 `yard-media` |
| 云函数 | `yard-api`（Event）· `ai-stream`（HTTP） |
| 静态托管 | 根目录，发布源为 `release/` |

### 需要配置的项

| 配置项 | 位置 | 说明 |
| --- | --- | --- |
| **匿名登录** | 控制台 → 身份认证 → 登录方式 | ⚠️ **必须开启**，否则访客无法提交申请 |
| 用户名密码登录 | 控制台 → 身份认证 → 登录方式 | 管理员登录用 |
| 管理员 UID | 数据库 `public.yard_administrators` | 与认证用户 UID 对应，`active = true` |
| 企业微信机器人地址 | 管理员后台 → 网站设置 | 存数据库，**不进代码与配置文件** |
| 模型 API Key | 环境变量 `DEEPSEEK_API_KEY` 或数据库 `yard_settings.ai_config` | 未配置时 AI 走演示模式 |
| 前端可发布密钥 | `index.html` → `window.YARD_CLOUD_CONFIG` | Publishable Key，权限仅 `anon`，**设计上就是公开的** |

> **密钥不着地**：管理密钥、机器人地址、模型 Key 都不出现在本仓库的任何文件里。
> 前端使用的 `accessKey` 是 CloudBase 的**可发布密钥**，权限仅为匿名只读，
> 与「管理密钥」是两回事。

## 本地运行

站点是纯静态的，**没有构建步骤**：

```bash
git clone <repo>
cd <repo>
npx serve .          # 或任意静态服务器，例如 python -m http.server 8000
```

打开提示的地址即可。云端数据来自线上环境，无需在本地跑后端。

## 部署

```bash
npm install
npx cloudbase login

ENV=chuanzhibei-d3gvmowp1e63d7f33

# 1) 数据库迁移
node_modules/.bin/cloudbase db pg migration up -e $ENV

# 2) 业务云函数（Event）
node_modules/.bin/cloudbase fn deploy yard-api -e $ENV --force --install-dependency false

# 3) AI 流式代理（HTTP 云函数）
node_modules/.bin/cloudbase fn deploy ai-stream -e $ENV --httpFn --force --install-dependency false

# 4) 绑定 HTTP 访问服务
node_modules/.bin/cloudbase service create -p ai-stream -f ai-stream -e $ENV

# 5) 发布前端
node_modules/.bin/cloudbase hosting deploy release -e $ENV --verify
```

> ⚠️ 第 3、4 步**必须分开执行**。若在第 3 步直接带 `--path`，
> 会建出一条触发类型错误的绑定，访问时返回
> `FUNCTIONS_PARAM_INVALID: FunctionType parameter is invalid`。

> ⚠️ HTTP 云函数必须有 `scf_bootstrap` 启动文件（已随代码提交），应用监听 **9000 端口**。
> 另外默认超时只有 3 秒，SSE 会被截断，`cloudbaserc.json` 中已设为 60 秒。

## 测试

验证脚本直接运行，不依赖测试框架：

```bash
node tools/test-ai-chat.cjs              # AI 对话端到端 24 项（含流式真实性、隐私边界）
node tools/check-ai-preview.cjs          # 页面结构与线上状态 21 项
node tools/test-wecom-notify.cjs         # 企业微信提醒 56 项
node tools/test-tc3-signing.cjs          # 云 API 签名 51 项
node tools/test-admin-applicant-edit.cjs # 管理员代改资料 24 项
node tools/verify-anon-lockdown.cjs      # 匿名直写入口已关闭 6 项
node tools/probe-browser-path.cjs        # 浏览器真实通路（匿名登录 → 调函数 → 读数据）
node tools/check-qr-url.cjs              # 站点素材可达性
```

## 目录结构

```text
├── index.html / app.js / styles.css   # 站点源码（无构建步骤）
├── release/                           # 待发布的三个文件（发布源）
├── functions/
│   ├── yard-api/                      # 业务云函数（Event）
│   └── ai-stream/                     # AI 流式代理（HTTP + scf_bootstrap）
├── cloudbase/migrations/              # 数据库迁移（表结构的唯一来源）
├── database/schema.sql                # 早期建表脚本（已由迁移取代，仅作参考）
├── tools/                             # 验证脚本
├── DESIGN.md                          # 设计语言与视觉基调
├── PRODUCT.md                         # 产品定位与核心流程
└── FORMAL-BACKEND.md                  # 后端结构与上线顺序
```

## 隐私与安全设计

- 全部数据表启用 **RLS（行级安全）**，前端能读到什么由数据库策略决定，不依赖前端自觉
- 申请人可自助修改资料，凭 **256 位随机令牌**，且数据库**只存哈希**，24 小时有效
- **匿名直写入口已关闭**：申请只能经云函数提交，绕过前端也写不进数据库
- 提交侧有蜜罐字段、最短填写时长、浏览器指纹与多维限频
- 群提醒**不包含**管理员内部备注、来源 IP 哈希、浏览器指纹、修改令牌
- AI 只发送宠物公开档案与访客自述，**不发送任何申请人隐私**

## 已知限制

- 站点部署在腾讯云 CloudBase 中国大陆节点，绑定自定义域名需先完成 ICP 备案
- 宠物照片目前偏大（单张可达 4 MB），已计划做压缩与缩略图
- AI 申请摘要（功能 ②）仍在开发中

## 文档

- [`DESIGN.md`](DESIGN.md) —— 设计语言、配色与视觉基调
- [`PRODUCT.md`](PRODUCT.md) —— 产品定位、用户与核心流程
- [`FORMAL-BACKEND.md`](FORMAL-BACKEND.md) —— 后端结构与上线顺序
