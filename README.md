# IOSDecryptHub · 官网

IOSDecryptHub 的官方网站——一个基于 fishhook 的
iOS App 运行时加解密审计平台。本站为交互式作品级站点，Vite + Three.js 构建。

代码在 decrypthub 组织公开维护：

- [巨魔版 IOSDecryptHubTrollStore](https://github.com/decrypthub/IOSDecryptHubTrollStore)
- [越狱新版 IOSDecryptHubJB](https://github.com/decrypthub/IOSDecryptHubJB)
- [官网 IOSDecryptHubPage](https://github.com/decrypthub/IOSDecryptHubPage)

既有 [IOSDecryptHub](https://github.com/decrypthub/IOSDecryptHub) 保留旧源码、Release 与更新链接；新版本由两个独立项目分别发布，本站继续使用原域名、包 ID 与源签名公钥分发下载和完整包更新。

## 页面结构

- **首页 `/`**：3D 主视觉（Three.js 解密核心 + 扫描环）、直接下载 DYLIB、实时面板复刻。
- **文档 `/docs.html`**：安装与注入（TrollFools / 越狱插件源 / idh 网关）、能力全景、算法覆盖矩阵、MCP · Capstone 36 工具。
- **动态 `/news.html`**：技术文章（markdown 渲染 + hash 路由），文章数据在 `src/news-data.js`，发布新文章时在数组末尾追加一条。

## 语言切换

全站支持中文 / English 切换，默认中文：

- 导航栏右侧按钮切换，选择存入 `localStorage`（`idh-lang`）持久化。
- 静态文案用 `data-i18n` 属性标注，字典在 `src/i18n.js`。
- JS 渲染的数据（能力 / 算法 / MCP 工具）各自携带 `en` 字段，切换时自动重渲染。
- 技术文章正文以中文撰写（发布时补充），列表与界面文案双语。

## 呈现内容

- **3D 主视觉**：Three.js 解密核心（wireframe 二十面体 + 粒子场 + 扫描环），鼠标视差。
- **首页直接下载 DYLIB**：TrollStore 注入器选目标 App 即可注入。
- **实时捕获流**：模拟 App 调用加密 API 的结构化事件流 + master-detail 详情。
- **交互式 Web 面板复刻**：加解密 / 文件 / 系统 / 符号 / Dump 五 tab 可切换。
- **算法覆盖矩阵**：摘要 / HMAC / 对称 / OpenSSL EVP / 非对称 / KDF（文档页）。
- **砸壳流水线**：FairPlay 内存脱壳四步可视化（文档页）。
- **MCP · Capstone 工具集**：36 个工具（11 个反汇编 / xref + 取证 / 沙盒 / 控制）的 JSON-RPC 交互演示（文档页）。
- **fail-loud 健康监控**。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build   # 产物在 dist/
```

## 托管（Cloudflare Workers Builds）

本站是 Vite 多页静态站，用 Workers Static Assets 托管。Cloudflare 连接本仓库后，推送 `main` 即自动构建部署。本仓已迁入 `decrypthub/IOSDecryptHubPage` 并设为公开。

Dashboard 构建配置应对齐：

| 项 | 值 |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/`（本仓库根目录） |
| Production branch | `main` |

`wrangler.jsonc` 里的 `name` 必须和 Dashboard 里的 Worker 名称一致（2026-10-26 实测为 `iosdecrypthubpage`，已绑定 `ios.decrypthub.com`）。以现有域名绑定的 Worker 为准，不另建同名近似站点。

Cloudflare 的 GitHub 集成应关联组织内的 `decrypthub/IOSDecryptHubPage` 仓库。

自定义域名：Worker → Settings → Domains & Routes → Add → Custom Domain，填 `ios.decrypthub.com`（域名必须已经接入 Cloudflare）。

本地预览 Workers 运行时：

```bash
npm run preview:workers
```

## 发布

新版本发布时，先同步 dylib 到官网静态目录并更新首页下载元数据：

```bash
./scripts/sync_dylib.sh                 # 自动选择 ../IOSDecryptHub 下最新的版本
./scripts/sync_dylib.sh ../IOSDecryptHub/decrypt_helper-1.23.8.dylib
```

脚本会把 dylib 复制到 `public/dylibs/`，并刷新 `src/data.js` 里的版本、大小与 SHA-256。
之后推送 `main`，Cloudflare Workers Builds 会执行 `npm run build` 再 `npx wrangler deploy`。

## 技术栈

- Vite 5
- Three.js（Hero 3D 场景）
- 原生 JS 模块 + 手写设计系统 CSS，无 UI 框架依赖

## 在线地址

https://ios.decrypthub.com/

## 协议

[MIT](./LICENSE)

## v1.27.6 维护更新

- 首页 dylib 来自 IOSDecryptHubTrollStore 的 trollstore 构建；越狱源完整 deb 来自 IOSDecryptHubJB。
- 原域名、包 ID、源公钥保持兼容，保留 v1.27.5；索引生成必须成功签名并通过既有公钥验证。
- 越狱 Manager 查询 APT 候选版本并打开包管理器更新完整包，不再独立覆盖引擎。
- 常驻分析服务、Inline Hook 与 Trace 属于后续越狱项目规划。

如需通过已登录的 Wrangler 手动部署到同一个官网 Worker：

```bash
npm run build
npx wrangler deploy
```

部署后核验 `/Packages`、`/InRelease`、两类完整 deb 和首页 dylib；不能仅凭推送成功判定源已上线。
