# dsh-workbuddy-market

DSH（DeepSeek Harness）插件：把本地 WorkBuddy 专家目录变成 DSH 里的专家市场——扫描 `~/.workbuddy/plugins/marketplaces/experts/plugins`，浏览专家卡，一键装成用户级 agent preset。**专家内容永远留在你的目录里**，插件仓库零数据、零拷贝。

> 状态：T1 + T2 + T4 + T6（issue #2/#3/#5/#7）。settings 命名空间、HTTP 路由（`/api/state`、`/api/avatar`、`/api/config`、`/api/refresh`）、**真实扫描器**（一个 agent md 一张专家卡：plugin.json 首选元数据、CRLF 容错、模板转义、团队拆卡与成员头像、`git:` 副本跳过、坏目录降级 warning）、**安装**（`POST /api/install` 按设计文档 §4 七步把专家装成 roster 认可的用户级 `wb-<id>` preset：standard 底座 copy → preset.yml 元数据 → persona 行锚定替换 → skills 拷贝 → skill-filesystem 行锚定挂载（`!!js` 表达式逐字同 shipped cordis preset，pristine/already-patched 两形态幂等）→ `standingKeyFor` 挂载校验 → `.workbuddy-market.json` 指纹清单）与**头像流**（`GET /api/avatar?id=` 按需读当前扫描表里的 PNG，`image/png` + `max-age=60`；id 过 ID_RE、命中扫描表、realpath 后必须仍在源根内——未知/非法/越界一律同一个 404）已就位；市场页、更新/卸载与召唤工具见 [docs/design.md](docs/design.md) 的切相计划。

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
| `/api/state` | GET | `{ sourcePath, pathExists, revision, experts, orphans, warnings }`；experts 卡带 `avatarUrl`（仅扫描到 PNG 的专家——无头像专家无此字段，client 侧 emoji 回退） |
| `/api/avatar?id=` | GET | 按需流式读当前扫描表里该专家的 PNG（不拷贝）；`id` 必须过 `ID_RE` 且命中当前扫描表，avatarPath `realpath` 后必须仍在源根内（防 `..` 与符号链接穿越）；未知/非法/越界/文件缺失一律同一 404；`image/png` + `max-age=60` |
| `/api/config` | POST | `{ sourcePath, expectedRevision? }` → 保存原串路径，返回新 state；revision 过期返回 409 |
| `/api/refresh` | POST | 强制重扫，返回新 state |
| `/api/install` | POST | `{ id }` → 把当前扫描表里的专家装成用户级 `wb-<id>` preset（设计文档 §4 七步）；同源重复安装幂等（产物一致、无误报）；撞上别的源装的 `wb-<id>` 报「该专家已从别的源目录安装」，撞上清单缺失/损坏报「清单缺失，请卸载重装」 |

变更路由仅收同源 POST、请求体上限 4 KiB、同时只允许一个变更（并发第二个 409）；JSON 路由一律 `cache-control: no-store`，唯一例外是 avatar 的 `max-age=60`（源文件 mtime 变了指纹重扫后自然换新）。安装只是复制加文件改写，不执行任何脚本。

## 开发

```sh
node scripts/smoke.mjs   # 离线冒烟，零依赖
```

## License

MIT
