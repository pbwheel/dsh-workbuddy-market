# dsh-workbuddy-market

**把本地 WorkBuddy 专家目录装进 DeepSeek Harness 的专家市场：浏览、一键装成用户预设、随时召唤**

[English](README.en.md) · [设计文档](docs/design.md) · [LICENSE](LICENSE)

## 它是什么

一个 DSH（DeepSeek Harness）Web 插件：在**运行时**扫描你本地的 WorkBuddy 专家插件目录（默认 `~/.workbuddy/plugins/marketplaces/experts/plugins`），把每个专家渲染成市场卡片——支持中英双语搜索与过滤、团队插件分组折叠、行内安装/更新/卸载、可更新一键全更。装好的专家有两种用法：新建会话时选 `wb-<id>` 预设直接开场，或在任意会话里让模型召唤（`workbuddy_experts` / `summon_workbuddy_expert` 两个模型工具，以及输入框「召唤专家」按钮和 `@` 菜单两个起草入口——只写草稿，不自动发送）。

```
设置 → WorkBuddy 专家 → 浏览/搜索 → 安装 ─┬→ 新建会话选 wb-<id> 预设 → 与专家开聊
                                          └→ 任意会话里召唤（workbuddy_experts / summon_workbuddy_expert）
```

WorkBuddy 侧更新了专家？市场页点「刷新」强制重扫，或什么都不做——每次读取都会先比对目录指纹，变了自动重扫；已装专家的卡片亮起 ↑ 可更新，可单卡更新也可一键全更。

## 隐私边界

- **只读扫描**：插件只读取你的 WorkBuddy 专家目录，绝不写它、绝不改动 WorkBuddy 本身。
- **零数据外发**：所有 HTTP 路由只接受同源请求，没有任何遥测、上报或第三方请求；专家内容永不离开你的机器。
- **产物只落 DSH_HOME**：安装动作把专家 persona/skills 复制进 `${DSH_HOME:-~/.dsh}/.agent-presets/wb-<id>/`，别处不落一文件；卸载删的就是这个目录。
- **仓库零专家数据**：本插件仓库没有 `data/` 目录——它带的是「市场机制」，不是专家内容。

## 与姊妹插件 dsh-agency-market 的关系

[dsh-agency-market](https://github.com/pbwheel/dsh-agency-market) 是同一机制的另一个市场：机制同源（市场页 + 装成用户预设 + 召唤工具），数据来源不同——它吃仓库内静态目录（agency-agents 的 273 位专家），本插件吃你目录里的活数据（WorkBuddy 私有专家，会更新）。**两者可在同一 profile 共存**：

| | dsh-agency-market | dsh-workbuddy-market（本插件） |
|---|---|---|
| 目录数据 | 仓库内 `data/`，随插件分发 | 运行时扫用户目录，不进仓库 |
| 数据更新 | 重跑导入脚本 | 用户点「刷新」即重扫（指纹自动重扫兜底） |
| 安装产物 | `expert-<id>` preset | `wb-<id>` preset（前缀隔离） |
| 召唤工具命名域 | `market_experts` / `summon_market_expert` | `workbuddy_experts` / `summon_workbuddy_expert` |

两边各装各的、各召各的；被召唤的专家子代理不能再召唤任何一个市场的专家（防递归 deny 名单互相覆盖）。

## 前置条件

- 一套可用的 DeepSeek Harness Web 安装，`dsh` 命令可用（Node.js 22+；`dsh` 不在 PATH 时可用 `npx -p @deepseek-ai/dsh dsh …` 代替下述命令）。
- 本机存在 WorkBuddy 专家目录（默认路径见上；没有也可先装插件，页面会黄条提示路径无效，路径就绪后自动恢复）。示例均使用 `web` profile，按需替换。

## 安装（从零，逐字可复制）

```sh
git clone https://github.com/pbwheel/dsh-workbuddy-market.git
cd dsh-workbuddy-market
dsh plugin --profile web add .
dsh --profile web --dump-config
```

配置输出里应能看到 `dsh-workbuddy-market`。然后**重启 `dsh web`**（bundles 列表只在启动时读）并**强刷浏览器**，打开 设置 → WorkBuddy 专家。

本插件零构建、零运行时依赖、不执行任何安装脚本：克隆目录就是插件源码目录，`src/` 与 `client/` 即产物，不要只拷贝 `src`。

## 使用

- **市场页**（设置 → WorkBuddy 专家）：搜索中英文均命中；过滤 chips（全部/已装/可更新/含技能/团队）；**分类 chips**（按 WorkBuddy 市场分组键 `categoryId` 派生：已知键本地化显示、未知键剥数字前缀示名、缺类卡片入「未分类」桶——与状态 chips、搜索三维可叠加；卡片带分类 badge，census 增「分类 N」）；**团队插件聚合为一条可展开的组头**（成员头像堆叠 + 已装/可更新计数），单体专家照旧平铺；搜索或过滤激活时组自动展开。
- **一键全更**：存在可更新卡片时出现入口——串行逐个更新、每完成一个卡片即翻新；中途失败会停下并呈现原因，可继续更新剩余。
- **孤儿区**：换过源目录后，装自别的源的 preset 单独列在「已安装但不在当前源」，只呈列不阻塞市场，确认后可按 id 卸载。
- **召唤**：任意会话让模型调工具（`workbuddy_experts` 列表带每位的分类，可选 `category` 参数按 `categoryId` 原串过滤），或点输入框「召唤专家」按钮 / 输入 `@` 选专家——后两者只写指令草稿。

## 配置

源目录存在宿主 settings 命名空间 `workbuddy-market` 的 `sourcePath`（默认 `~/.workbuddy/plugins/marketplaces/experts/plugins`，`~` 按原串存储、使用时展开）。页面顶栏可直接改路径（带 revision 冲突保护）；允许保存不存在的路径——状态里以 `pathExists` + 黄条呈现，改对即自动恢复。

## HTTP API（前缀 `/dsh-workbuddy-market`）

| 路由 | 方法 | 语义 |
|---|---|---|
| `/api/state` | GET | `{ sourcePath, pathExists, revision, experts, orphans, warnings }`；每卡带 `installed/updatable/broken/avatarUrl/category`（分类为 plugin.json `categoryId` 原串，可缺省），先比对指纹、变了自动重扫 |
| `/api/avatar?id=` | GET | 按需流式读当前扫描表里该专家的 PNG（不拷贝）；id 过 `ID_RE`、命中扫描表、realpath 后必须仍在源根内——未知/非法/越界一律同一 404；`image/png` + `max-age=60` |
| `/api/config` | POST | `{ sourcePath, expectedRevision? }` → 保存原串路径，返回新 state；revision 过期 409 |
| `/api/refresh` | POST | 强制重扫，返回新 state |
| `/api/install` | POST | `{ id }` → 装成用户级 `wb-<id>` preset；同源重复安装幂等 |
| `/api/update` | POST | `{ id }` → 就地重打（persona/skills 同步 + 指纹刷新） |
| `/api/uninstall` | POST | `{ id }` → 删整个 preset 目录（roster 为权威，孤儿也可按 id 卸载） |

变更路由仅收同源 POST、请求体上限 4 KiB、同时只允许一个变更（并发第二个 409）；JSON 路由一律 `cache-control: no-store`，唯一例外是 avatar 的 `max-age=60`。安装只是复制加文件改写，不执行任何脚本。

## 开发

```sh
node scripts/smoke.mjs            # 离线冒烟，零依赖
node scripts/zhname-audit.mjs     # zhName 优先级实证抽查（真实语料，只读）
```

无构建、无依赖、无 install 脚本。改完 host（`src/`）或 `package.json` 需重启 `dsh web`；只改 `client/client.js` 刷新页面即可。设计与决策记录见 [docs/design.md](docs/design.md)。

## License

MIT
