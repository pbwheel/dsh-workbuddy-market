# dsh-workbuddy-market

DSH（DeepSeek Harness）插件：把本地 WorkBuddy 专家目录变成 DSH 里的专家市场——扫描 `~/.workbuddy/plugins/marketplaces/experts/plugins`，浏览专家卡，一键装成用户级 agent preset。**专家内容永远留在你的目录里**，插件仓库零数据、零拷贝。

> 状态：T1 走路骨架（issue #2）。settings 命名空间、空扫描器与三个 HTTP 路由（`/api/state`、`/api/config`、`/api/refresh`）已就位；真实扫描、市场页与召唤工具见 [docs/design.md](docs/design.md) 的切相计划。

## 安装（scratch / 自有 profile）

```sh
npx -p @deepseek-ai/dsh dsh plugin --profile <name> add github:pbwheel/dsh-workbuddy-market
```

本地开发用路径安装（link）：

```sh
dsh plugin --profile <name> add /path/to/dsh-workbuddy-market
```

安装后重启目标 profile。零构建、零运行时依赖、不执行任何安装脚本；`src/` 与 `client/` 即产物。

## 配置

源目录存在宿主 settings 命名空间 `workbuddy-market` 的 `sourcePath`（默认 `~/.workbuddy/plugins/marketplaces/experts/plugins`，`~` 按原串存储、使用时展开）。改路径走 `POST /dsh-workbuddy-market/api/config`，允许保存不存在的路径（状态里以 `pathExists` + warning 呈现）。

## HTTP API（前缀 `/dsh-workbuddy-market`）

| 路由 | 方法 | 语义 |
|---|---|---|
| `/api/state` | GET | `{ sourcePath, pathExists, revision, experts, orphans, warnings }` |
| `/api/config` | POST | `{ sourcePath, expectedRevision? }` → 保存原串路径，返回新 state；revision 过期返回 409 |
| `/api/refresh` | POST | 强制重扫，返回新 state |

变更路由仅收同源 POST、请求体上限 4 KiB、同时只允许一个变更（并发第二个 409）；JSON 路由一律 `cache-control: no-store`。

## 开发

```sh
node scripts/smoke.mjs   # 离线冒烟，零依赖
```

## License

MIT
