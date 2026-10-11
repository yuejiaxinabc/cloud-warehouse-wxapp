# 📱 云仓小程序端（独立项目）

> 「云仓智能仓储管理平台」的微信小程序客户端，**独立仓库/独立项目**，通过 HTTPS 调用云仓服务端的开放接口（`/api/v1/mp/*`）。
>
> 🔗 **服务端主项目**：<https://github.com/yuejiaxinabc/cloud-warehouse>（Next.js Web 端 + 后端，本小程序不含后端代码）

原生微信小程序开发（无第三方框架），共 7 个页面，围绕仓库现场的高频操作设计：**扫码收发货、扫码盘点、随手采购申请**。

---

## ✨ 功能清单

| 页面 | 功能 |
|------|------|
| `pages/login` | 账号密码登录（与 Web 端同一套账号体系），登录态 30 天有效 |
| `pages/index`（首页） | 库存总量/总价值看板、仓库分布、7 日出入库趋势、扫码查询商品 |
| `pages/stock-in`（入库） | 扫商品条码或手动选择，选仓库/货位，提交采购/退货/生产入库 |
| `pages/stock-out`（出库） | 扫码或选择商品，填数量与去向，提交出库（走服务端审批与防超卖） |
| `pages/stocktake`（盘点） | 按仓库发起盘点，逐项录入实盘数，提交差异 |
| `pages/purchase`（采购申请） | 选仓库与商品、填数量备注，提交采购申请 |
| `pages/mine`（我的） | 查看个人信息、退出登录 |

扫码通过 `wx.scanCode` 实现（`utils/api.js` 的 `api.scan()`），扫出的条码交由服务端匹配商品，匹配不到会提示手动选择。

## 📁 目录结构

```
wxapp/
├── app.js / app.json / app.wxss   # 全局入口与配置（tabBar 5 个页签）
├── pages/                          # 7 个页面（index/login/mine/purchase/stock-in/stock-out/stocktake）
├── utils/api.js                    # 唯一的请求层：BASE_URL、会话管理、扫码封装
├── project.config.json             # 微信开发者工具工程配置
└── sitemap.json
```

> 改请求只动 `utils/api.js` 一个文件。

## 🔧 配置服务器地址

打开 `utils/api.js` 第 2 行，改成你的云仓服务端地址（必须是 HTTPS）：

```js
const BASE_URL = 'https://your-domain.example.com';
```

会话机制：登录成功后服务端签发 30 天 Token（存 `wx.getStorageSync('mpToken')`），后续请求自动带 `Authorization: Bearer <token>`；遇到 401 自动清除本地会话并跳回登录页。

## 🚀 本地开发调试

1. **导入项目**：微信开发者工具 → 导入 → 选择本目录（读取 `project.config.json`）→ 填入你的小程序 AppID（没有可选「测试号」）。
2. **放开域名校验**：开发者工具右上角「详情 → 本地设置」勾选 **「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**（仅开发阶段）。
3. 确保 `BASE_URL` 指向的服务端已启动（Web 端部署见服务端仓库 `docs/DEPLOYMENT.md`）。
4. 编译预览，用与 Web 端相同的账号登录（如 `wh_keeper / User@123`，账号由服务端管理员在「系统设置 → 用户管理」中分配）。

## 📦 正式发布

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com) → 开发管理 → 开发设置 → **服务器域名**：
   - `request 合法域名` 添加：`https://your-domain.example.com`
   - 要求：HTTPS、ICP 备案、证书链完整（Let's Encrypt 可用）
2. 开发者工具 → 上传 → 填版本号与备注。
3. 公众平台 → 版本管理 → 提交审核（类目建议：工具 → 效率/企业管理）→ 审核通过后发布。
4. 体验版：版本管理中设为「体验版」，扫码即可给同事试用，无需过审。

## 🔌 依赖的服务端接口

全部位于服务端 `/api/v1/mp/*`，由 `mpSession` 表 Token 鉴权（除登录外）：

| 接口 | 用途 |
|------|------|
| `POST /api/v1/mp/login` | 账号密码登录，签发 Token |
| `GET /api/v1/mp/dashboard` | 首页看板（库存统计/仓库分布/7 日趋势/待办） |
| `GET /api/v1/mp/me` | 当前用户信息 |
| `GET /api/v1/mp/warehouses` | 仓库下拉列表 |
| `GET /api/v1/mp/locations` | 仓库下的货位 |
| `GET /api/v1/mp/boxes` | 货位下的盒子 |
| `GET /api/v1/mp/inventory/search` | 扫码/关键词查库存 |
| `POST /api/v1/mp/stock-in` | 提交入库 |
| `POST /api/v1/mp/stock-out` | 提交出库 |
| `POST /api/v1/mp/stocktake` | 提交盘点 |
| `POST /api/v1/mp/purchase` | 提交采购申请 |
| `GET /api/v1/mp/box` | 盒子详情 |

> ⚠️ 服务端升级时若改动上述接口的入参/出参，需同步更新本小程序并重新发版。

## ❓ 常见问题

| 问题 | 解决 |
|------|------|
| 真机提示「不在以下 request 合法域名列表中」 | 正式版必须配置域名白名单（见「正式发布」第 1 步）；开发期用开发者工具勾选不校验，真机调试请在小程序打开「开发调试」 |
| 登录成功但马上跳回登录页 | 服务端 `NEXTAUTH_URL`/域名证书问题导致 401，先确认 Web 端可正常登录 |
| 扫码无反应 | 检查相机权限；条码需与服务端商品档案中的条码字段一致 |
| 提示「网络异常，请稍后再试」 | `BASE_URL` 不可达：服务器宕机/域名过期/证书失效 |
| 账号登录被拒「账号已被禁用」 | 服务端管理员在用户管理中启用该账号 |

## 📄 许可证

与服务端主项目 [cloud-warehouse](https://github.com/yuejiaxinabc/cloud-warehouse) 一致（MIT）。
