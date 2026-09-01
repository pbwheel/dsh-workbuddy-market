# 技术方案：dsh-workbuddy-market —— 运行时读取 WorkBuddy 专家目录的 DSH 插件

> 状态：**已定稿**（评审修订版，待实施）——初始四项决策 + 评审新增 #5–#11 + 拷问轮新增 #12–#18，见 §11 决策记录
> 2025-09 评审修订要点：指纹粒度实证修正（#5）、模板转义保真代价披露（#6）、skills 锚定幂等（#7）、指纹覆盖落盘字段（#8）、跨源冲突与孤儿 preset（#9）、防递归不对称（#10）、P5 验证相（#11）
> 2025-09 拷问轮新增：plugin.json 首选元数据源（#12）、团队头像匹配（#13）、CRLF 全链路容错（#14）、skills 全量照搬（#15）、同名 id first-wins（#16）、manifest 缺失并入 broken（#17）、实现细节三件套与 `~` 展开（#18）
> 前身方案（把专家拷进 dsh-agency-market 仓库目录）已废弃：专家是私有的，不该进公开仓库
> 需求三要素：**运行时读用户目录**（默认 `~/.workbuddy/plugins/marketplaces/experts/plugins`）、**目录可改**、**可手动刷新重导**（WorkBuddy 侧会更新）

## 0. 定位

一个独立 DSH Web 插件（`dsh-workbuddy-market`），把用户本地 WorkBuddy 专家插件目录变成 DSH 里的专家市场：浏览 → 一键装成用户级 agent preset → 开专家会话 / 会话中途召唤。**专家内容永远留在用户目录**——插件仓库零数据、零拷贝（安装动作本身除外，见 §4）。

与姊妹插件 `dsh-agency-market` 的关系：**机制同源、数据来源不同**。后者吃仓库内静态目录（273 位 agency-agents 专家），本插件吃用户目录的活数据（WorkBuddy 私有专家，会更新）。两者可共存于同一 profile：

| | dsh-agency-market | dsh-workbuddy-market（本插件） |
|---|---|---|
| 目录数据 | 仓库内 `data/`，随插件分发 | 运行时扫用户目录，不进仓库 |
| 数据更新 | 重跑导入脚本 | 用户点「刷新」即重扫 |
| 安装产物 | `expert-<id>` preset | `wb-<id>` preset（前缀隔离） |
| 召唤工具命名域 | `market_*` | `workbuddy_*` |
| 复用机制 | — | roster 安装路径 / persona 锚定替换 / 同源路由 / 手写 client bundle 对齐姊妹插件已验证实现；**skills 挂载为本插件新增机制**（姊妹插件无此功能），挂载方式对齐 shipped cordis preset 同款 |

## 1. 总体架构

```
浏览器                                 DSH 宿主进程
──────                                 ───────────
client/client.js                       src/index.js（host 入口，三段 inject 编排）
  settings.section「WorkBuddy 专家」      ├─ inject settings:
    源路径编辑 + 刷新按钮 + 卡片网格  ──同源 fetch──→ │   src/settings.js  settings namespace（sourcePath 持久化 + watch 失效缓存）
    （安装/更新/卸载 行内确认）              ├─ inject webServer+agentPresets+settings:
                                            │   src/routes.js   /dsh-workbuddy-market/api/*
  conversation.input.left「召唤」按钮       │   src/scanner.js  运行时扫描器（纯函数 + 指纹缓存）
  inputTriggers「@」触发源（P3）            │   src/presets.js  安装/更新/卸载（roster 路径 + skills 挂载）
                                            └─ inject tools+subagents+systemPrompt+agentPresets:
                                              src/summon.js    workbuddy_experts / summon_workbuddy_expert（P3）

用户目录（只读扫描，安装时才读细节拷进 preset）：
~/.workbuddy/plugins/marketplaces/experts/plugins/<插件>/agents|skills|rules|avatars|README.md
                                          ↓ 安装产物
                                        ~/.dsh/.agent-presets/wb-<id>/（persona + skills/ + .workbuddy-market.json 指纹清单）
```

零构建、零运行时依赖、不执行任何安装脚本——全盘沿用姊妹插件的工程约定。

`settings` 是硬依赖（三段中两段注入它）：web/标准组合恒有该服务；极端缺失时 settings/routes 两段保持挂起、召唤段独立可用，属可诊断的 pending 状态，不做 `ctx.get` 降级。

## 2. 扫描器（`src/scanner.js`）：运行时读取，零落盘

**纯函数** `scanWorkbuddyRoot(root) → { experts, warnings }`，不写任何文件：

- 遍历 root 下每个插件目录的 `agents/*.md`（**只扫平铺一层**，子目录与非 md 静默忽略，#18），**一个 md = 一张专家卡**（团队插件自然拆成多卡，如 mvp-dev-expert-team ×8）；
- **CRLF 全链路容错（#14）**：实测 11/50 agent 文件为 CRLF 行尾（backend-architect、software-architect 等皆在内）——frontmatter / README / rules / plugin.json 读取一律按 `\r?\n` 切行，抽取出的字段值与 persona 文本统一 strip `\r` 再进内存与落盘。不洗的后果：近四分之一专家静默走降级 warning；同文件 CRLF↔LF 重存会让 fingerprint 假报 updatable；
- 字段抽取（**plugin.json 首选 + 原映射兜底，#12**）：42/42 插件都有 `.codebuddy-plugin/plugin.json`，含现成双语元数据（displayDescription / avatar 显式路径 / profession / categoryId / tags / teamInfo），优先取用；**团队卡除外**——plugin.json 是插件级、无成员细分，团队卡仍走 agent frontmatter 链：

| WorkBuddy 来源 | 内存中的专家字段 |
|---|---|
| frontmatter `name` | `id`（必须过 `ID_RE = /^[a-z0-9][a-z0-9-]*$/`） |
| `displayName.en` ?? `name` | `name`（基字段，en） |
| plugin.json `profession.zh`（单体首选）→ frontmatter `displayName.zh` ?? `profession.zh`（单体后续兜底）；团队卡 = frontmatter `profession.zh` ?? `displayName.zh`（#22 调序）；末端正文首 H1（#19）→ `name` | `zhName`（displayName 类字段常为品牌名/人名——「鹏城信息AI专家」「吴八哥」，`profession.zh` 才是职能名「后端架构师」；实测 18/50 agent 文件无 frontmatter displayName/profession，plugin.json 恰好补位；P4 实证抽查已定案，见 #22） |
| `description`（use-when 触发描述） | `description` |
| plugin.json `displayDescription.zh`（实测 41/41 单体插件皆有）→ README.md 首个非标题段落（启发式兜底） | `zhDescription`（#12；README 兜底注意团队插件可能带 README_EN.md、README.md 首段是英文） |
| agent 正文 + `rules/*.md` 逐个带标题追加 | `persona`（`{{…}}` 非注册变量组拆括号转义，见下「模板转义」——不转义会让子代理/preset 启动失败；CRLF 行尾统一 strip，见上 #14） |
| `skills/` **全部**子目录名列表（#15：照搬零解释——含无 SKILL.md 的数据目录，如 model-expert 的 `references/`；已核实 dsh-skill-filesystem 只认 `<dir>/SKILL.md`，此类目录拷进 preset 为死重但无害，badge 计数 = 拷贝范围 = 目录所见） | `skills: [name]`（内容安装时才拷） |
| 单体：plugin.json `avatar` 字段（相对路径，**存在性检查**——实测有悬空引用）→ `avatars/` 首 PNG；团队：`avatars/<agentName>.png` 精确匹配 → `team.png` → 首 PNG（#13，实测 8/8 成员各有 `<agentName>.png`，按「首 PNG」会给成员发错头像）；全部落空 → `undefined`（实测 4 插件根本没有 PNG），client emoji 回退（姊妹同款静态 🧑‍💻） | `avatarPath`（路由按需流式读，**不拷贝**） |
| 插件目录名 + 目录内 agent 数 | `pluginDir`、`teamSize`（溯源 badge + 团队分组键） |

- **降级粒度**：单个插件目录解析失败 → 跳过该插件 + warning（照搬姊妹插件逐文件隔离哲学）；`git:` 前缀目录（WorkBuddy 的重名安装副本，agent id 与正主重复）整体跳过；**跨插件同名 frontmatter name → first-wins + warning（#16）**——id 直接决定 `wb-<id>` preset 名，静默覆盖会让前一张卡的已装 preset 突然指向别人的 persona（姊妹目录装载同款策略）；root 不存在 → 空专家表 + warning（页面黄条提示路径无效，不让市场崩）；
- **丢弃字段**（DSH 无对应物，如实记录；#18 补全）：agent frontmatter 的 `maxTurns`、`agentMode`、`enabled*`、`vibe`/`emoji`/`color`（3 文件有）；plugin.json 的 `version`、`homepage`、`defaultInitPrompt`、`quickPrompts`、`categoryId`（"02-Engineering" 类分组键）、`tags`（zh/en 标签）——#12 拷问轮明确不采用，控制 P1/P2 范围；SKILL.md 的 `allowed-tools` 门控。
- **模板转义（保真代价，如实记录，决策 #6）**：宿主插值器（`dsh-system-prompt` 的 interpolate）对「完整 `{{…}}` 组但变量名不合法 / 未注册 / 嵌套大括号且后文存在 `}}`」一律抛错，且**无非破坏性转义语法**。真实语料除 `{{.CurrentDate}}` 外还有十余处**代码示例大括号**（`{{ y: -2 }}`、`{{ github.sha }}`、`{{ type: "spring", stiffness: 100 }}` 等，出自 Remotion/grafana 类专家的正文代码块），全部必须转义。方案：非注册组拆括号（`{{` → `{ {`）；代价是模型读到的 persona 里这类代码示例的大括号被永久改写——功能正确、示例保真受损，已接受。注册变量白名单（当前 `model`/`cwd`/`provider`）做成数据而非写死，随正式版注册集增长而更新。

**缓存与指纹**（`src/catalog.js`）：

- 缓存一次扫描结果，键 = `sourcePath` + **逐插件文件清单哈希**：对每个插件目录下 `agents/ skills/ rules/ avatars/` 中的文件（深度 ≤3）**以及 `.codebuddy-plugin/plugin.json`（#12 起为元数据源，改动必须失效缓存）**收集 `(相对路径, mtimeMs, size)`，连同插件目录名清单一起哈希——42 插件约数百次 stat，毫秒级（决策 #5）；
  - 为什么不用「顶层目录项 `(name, mtimeMs)`」：目录 mtime 只反映**直接条目**的增删改名——**编辑既有 agent 文件、在同一插件目录里新增 agent 文件，插件目录与顶层的 mtime 都不变**（已实证）。内容更新恰是「WorkBuddy 侧会更新」的主形态，顶层方案会系统性漏检，`updatable` 也会对着陈旧扫描误报「已是最新」；
- `GET /api/state` 每次先比对指纹：变了自动重扫（增删插件目录、既有插件内容变更均可见），没变用缓存——扫 42 插件约百余文件，冷扫 <100ms，但没必要每请求都读；
- 「刷新」按钮 → `POST /api/refresh` 强制丢缓存重扫（兜底 mtime 被保留式复制工具欺骗等 exotic 情况）；
- `settings.watch`（sourcePath 变化）→ 缓存立即失效。

## 3. 设置持久化（`src/settings.js`）

用宿主 `settings` 服务的插件命名空间机制（已核实契约：`register(ns, schema, { base })` → `{ get, watch, update, replace }`，fiber 卸载自动清理，revision 冲突保护）：

- ns：`workbuddy-market`（settings 命名空间强制 `^[a-z][a-z0-9-]*$`，插件名的点号不合法——T1 实施时修正）；schema（schemastery）：`{ sourcePath: string }`；
- `base` = 默认路径 `~/.workbuddy/plugins/marketplaces/experts/plugins`（用户没改过就一直用它）；**`~` 按原串存储与回显、使用时展开（#18）**——scanner 与 avatar 路由拿到路径先做 tilde 展开，settings 与 `/api/state` 里始终是用户输入的原串；
- 改路径：client `POST /api/config { sourcePath }` → host 侧 **service 级** `settings.update(ns, { sourcePath }, expectedRevision)`（scope 级 `update(patch)` 不接收 `expectedRevision`，冲突保护只能走 service 级）→ watch 触发缓存失效 → 返回新 state；
- **允许保存不存在的路径**（便于先填后建），`/api/state` 返回 `pathExists` + warning，页面黄条提示——避免「手滑打错一个字母就被拒」和「目录暂时没挂载」的死锁；
- `expectedRevision` 冲突保护透传，防多标签页互踩；revision 取自 `settings.describe()` descriptor，随 `/api/state` 返回。

## 4. 安装 / 更新 / 卸载（`src/presets.js`）

安装 = roster 认可的预设编写路径（与姊妹插件同款，前缀换成 `wb-` 隔离命名空间）：

```
① agentPresets.copy('standard', 'wb-<id>', name)   ← 底座必须是 roster 里真实存在的，否则报错；
   撞上已存在的 wb-<id> 时读其 manifest——sourcePath 是别的源 → 报「该专家已从别的源目录安装」（决策 #9）
② 重写副本 preset.yml（name/description 用基字段）
③ persona 锚定替换（PERSONA_ROW_RE 同款；锚失配 → warning + 底座 persona 降级，绝不装坏预设）
④ skills 拷贝：源目录 skills/<name>/ → presetDir/skills/<name>/（仅当专家带 skills）
⑤ skill-filesystem 行锚定 patch（两形态幂等，决策 #7）：
   锚定匹配行头（- id: skill-filesystem + name 行），然后分两形态：
   - pristine（standard 底座该行无 config）→ 锚定追加（`!!js` 表达式逐字照抄 shipped cordis preset 的写法，不得简写，#18）：
       config:
         customSkillDirs:
           - !!js "process.getBuiltinModule('node:url').fileURLToPath(new URL('skills/', baseUrl))"
   - already-patched（该行已带 config.customSkillDirs，即本插件装过/更新过）→ 原位替换该 config 段
   （锚失配 → 跳过 ④ + warning「skills 未挂载」；此挂载方式 = shipped cordis preset 同款，standingKeyFor 免费验证。
    update 重打走同一函数：二次执行命中 already-patched 分支，不产生「skills 未挂载」误报。
    persona 锚定天然幂等：PERSONA_ROW_RE 替换产物是 JSON 单行标量 + 空行，锚点可重复匹配——姊妹同款，已验证）
⑥ agentPresets.standingKeyFor('wb-<id>') 挂载校验
⑦ 写指纹清单 presetDir/.workbuddy-market.json：
   { sourcePath, pluginDir, agentFile, fingerprint, importedAt }
   fingerprint = sha256(name + description + persona 文本 + skills 清单(相对路径+size+mtime) )
   （决策 #8：覆盖所有落盘进 preset 的字段——只改 frontmatter description / displayName.en 也要触发 updatable；
    README 首段启发式 zhDescription 不落盘、不入指纹，只改 README 不触发更新，符合预期；
     #18 披露：skills 清单含 mtime——touch 不改内容也会假报 updatable，无害（update 就地重打幂等），接受）
```

**更新检测与更新流**（WorkBuddy 侧会更新，这是本插件区别于姊妹插件的核心新增）：

- `/api/state` 对每个已装 `wb-<id>`：读 preset 目录里的 `.workbuddy-market.json`，比对当前扫描 fingerprint → 卡片打 `updatable` 标；
- `POST /api/update { id }` → **就地重打**：重写 preset.yml + 重替换 persona + skills 目录同步（新增/覆盖变更/删除源里已不存在的）+ 刷新 manifest + 再跑 `standingKeyFor`。preset 是我们生成的 user-trust 目录，就地重打无破坏面；
- manifest 丢失或 JSON 损坏（用户手动动过 preset）→ 不猜：该卡 `broken: true` + 专属 warning 文案「清单缺失，请卸载重装」（#17——并入姊妹 broken ⚠ badge 视觉，不新增 state 字段；install/update 撞到这种 preset 时报同样错误）；
- **换源孤儿**（决策 #9）：roster 里的 `wb-<id>` 在当前扫描表无对应专家（用户切换了 sourcePath）→ `/api/state` 以 `orphans` 返回，市场页 P4 展示「已安装但不在当前源」，不阻塞、不自动卸载；
- **卸载零新增**：`agentPresets.remove('wb-<id>')` 删整个 preset 目录，skills/manifest 随之消失；照旧拒绝非 `trust: "user"` 条目。

## 5. HTTP API（`src/routes.js`，前缀 `/dsh-workbuddy-market`）

| 路由 | 方法 | 语义 |
|---|---|---|
| `/api/state?locale=` | GET | `{ sourcePath, pathExists, revision, experts[…], orphans[…], warnings }`；experts 含 `installed/updatable/broken/skills/avatarUrl/pluginDir/teamSize`（`broken` 兼指 roster 挂载失败与 manifest 丢失/损坏，#17；`sourcePath` 回显用户原串，`~` 使用时展开，#18） |
| `/api/config` | POST | 改 `sourcePath`（同源 + 4KiB + expectedRevision） |
| `/api/refresh` | POST | 强制重扫，返回新 state |
| `/api/install` `/api/update` `/api/uninstall` | POST | `{ id }`；互斥单飞（安装期 roster copy 非并发安全） |
| `/api/avatar?id=` | GET | 从 `avatarPath` 流式读 PNG；`id` 过 `ID_RE` 且必须命中当前扫描表（防目录穿越），resolve 后必须仍在 root 内；`image/png` + `cache-control: max-age=60`（源文件 mtime 变了重扫后自然换新） |

安全约定照搬姊妹插件：变更路由只收同源 POST、请求体上限 4KiB、同时只允许一个安装/更新/卸载、安装只是复制加文件改写**不执行任何脚本**；所有 JSON 路由 `cache-control: no-store`（姊妹同款），唯一例外是 avatar 的 `max-age=60`。

## 6. 召唤工具（`src/summon.js`，P3 相，已确认要做）

与姊妹插件 `summon.js` 同构，命名域换 `workbuddy`：

- `workbuddy_experts()` —— 列当前可召唤（= 已安装）的 wb 专家；
- `summon_workbuddy_expert(expert, task)` —— 一次性子代理带完整专家 persona 跑完自包含任务；expert 支持 id/中文名模糊匹配；
- **防递归升级**：子代理 `toolFilter` deny 名单同时含 `workbuddy_experts`、`summon_workbuddy_expert`、**以及姊妹插件的 `market_experts`、`summon_market_expert`**（两插件共存时，被召唤的专家不能绕道召唤另一个市场的专家）；系统提示 section 子会话返回空串，同款；
- **防递归不对称（已知，接受，决策 #10）**：姊妹插件只 deny 自己的两名——agency 召唤出的子代理仍可召唤 wb 专家，再往下一层被本插件名单截断，**深度 3 有界终止**；完全对称需改姊妹插件（跨仓库），不作为本插件的依赖；
- **工程注记**：工具以手写 ToolDefinition 对象注册（姊妹同款的**有意偏离**，理由：link 安装在 profile 树外解析不到 `@deepseek-ai/dsh-tools`；偏离理由注释随实现继承，勿当疏漏「修掉」）；
- 边界不变：召唤按次注 persona、不挂 preset，**随包 skills 在召唤模式不可用**（skills 属于「装成 preset 开专场」的用法）。

## 7. Client（`client/client.js`）

- **市场页**（`settings.section` 插槽，标题「WorkBuddy 专家」）：
  - 顶栏：源路径输入框 + 应用按钮 + 有效性黄条（`pathExists=false` 时）+ **刷新按钮**（转圈动画，防重复点击）+ 专家计数；
  - 卡片网格：PNG 头像（`avatarUrl`，onError 回退 emoji）+ 名（随界面语言 zh/en）+ 描述 + badge（来源插件 / 技能数 / 团队）+ 状态（已装 ✓ / **可更新 ↑** / broken ⚠）；
  - 行内安装/更新/卸载确认（姊妹插件同款交互）；warnings 折叠条；
  - 搜索 zh+en 双语命中；过滤 chips：全部 / 已装 / 可更新 / 含技能 / 团队；
- **输入框「召唤专家」按钮 + `@` 触发源**（P3，与召唤工具同相）：只起草指令草稿不自动发送，同款；
- 工程形态照抄姊妹插件：手写 `window.__ModuleLoader__.load` bundle 格式（唯一 external `react`，`React.createElement` 无 JSX；wrapper 形状与姊妹逐字一致——skill 默认倾向 tsdown helper，本插件选零构建手写，姊妹已验证 + smoke stub 兜底，有意偏离）、主题 token + 回退、`<style data-plugin>` 随卸载清理、locale 服务 zh/en 字典。

## 8. 插件目录结构

```
dsh-workbuddy-market/
  package.json            # dsh.bundle.patch + dsh.client.inject（对齐姊妹插件）
  cordis.patch.yml        # host 半边插进 profile 层栈
  src/index.js            # 三段 inject 编排（settings / webServer+agentPresets / tools+subagents）
  src/settings.js  src/scanner.js  src/catalog.js  src/presets.js  src/routes.js  src/summon.js
  src/schemastery.js      # link 安装下 @deepseek-ai/schemastery 的运行时锚定解析（T1 新增）
  client/client.js
  scripts/smoke.mjs       # 离线冒烟（自建 fixture 假 WorkBuddy 树，见 §9）
  scripts/zhname-audit.mjs # zhName 优先级实证抽查（真实语料只读，#22 的证据载体）
  LICENSE  README.md  README.en.md
```

**没有 `data/` 目录**——这是本插件与姊妹插件最大的结构差异，也是隐私边界的体现。

## 9. smoke（`scripts/smoke.mjs`，零依赖离线）

在 tmp 目录生成 fixture 假 WorkBuddy 树覆盖全部路径：2 个单体专家（其一带 skills+rules+PNG+`{{.CurrentDate}}` 模板；其二**写成 CRLF 行尾**并带 plugin.json 元数据（含悬空 avatar 引用与 `displayDescription.zh`））、1 个三 agent 团队（**成员各带 `<agentName>.png` + team.png**，其一成员 md 为 CRLF、无 frontmatter displayName）、1 个 `git:` 副本目录、**1 对跨插件同名 id**、1 个 skills 子目录**无 SKILL.md**（照拷）。断言：

1. scanner：git: 跳过、团队拆 3 卡（成员头像命中 `<agentName>.png` 而非首 PNG）、rules 追加进 persona、模板组已转义（fixture 含 `{{.CurrentDate}}`、代码示例 `{{ y: -2 }}` 与嵌套 `{{ {a:1} }}`，转义后仅存注册组）、**CRLF 文件正常出卡且 persona 无 `\r`**、**plugin.json 元数据优先（zhDescription/avatar/zhName）且悬空 avatar 回退首 PNG**、**同名 id first-wins + warning**、坏插件目录降级为 warning；
2. 安装（mock `agentPresets`，姊妹插件 smoke 同款手法）：skills 落进 preset、组合文本含 `customSkillDirs`、manifest 指纹正确、persona 锚失配降级路径出 warning、skills 锚定二次执行幂等（already-patched 分支无 diff 无误报）、撞不同源 `wb-<id>`（manifest sourcePath 不同）报明确错误、**撞 manifest 丢失/损坏的 `wb-<id>` 报「清单缺失」明确错误**；
3. 更新与指纹：改 fixture（换 persona + 加一个 skill）→ update → 断言 persona 已换、新 skill 就位、被删 skill 目录清掉、无「skills 未挂载」误报；**编辑既有 agent 文件内容 / 在既有插件目录新增 agent 文件 / 编辑 plugin.json → 指纹变化 → state 自动重扫**（决策 #5 + #12 的回归锚）；
4. 路由：avatar 字节流与 404、同源拒绝、单飞互斥；
5. client bundle：加载与插槽注册（姊妹插件 smoke 同款）。

## 10. 实施切相

| 相 | 内容 | 规模估算 |
|---|---|---|
| P1 | host 全链路：scanner（含 mini frontmatter 读取器）+ settings + presets(装/更/卸) + routes + smoke | ~1100 行 |
| P2 | 市场页 client：路径编辑 / 刷新 / 卡片 / badge / 过滤 | ~600 行 |
| P3 | 召唤工具 + 输入框按钮 + @ 触发源 | ~350 行 |
| P4 | README（中英）+ 打磨：团队视图聚合、可更新一键全更、孤儿 preset 展示、zhName 优先级校验（`displayName.zh` 常为品牌/人名，见 §2） | 文档+小改 |
| P5 | 验证相（决策 #11）：真实组合 + 从零安装 + GUI 清单 | 验证 |

P1 规模依据：姊妹插件功能更少的 host 半边约 820 行，本插件另需 frontmatter-YAML 读取器与 update/avatar 链路。
P1 结束即可用 API 驱动安装（curl 可验）；P2 才有页面；P3 召唤。P5 内容：

- **真实组合**：`dsh plugin --profile <scratch> add` 装本插件 → `--dump-config` 断言 bundle 层 / 行 id / config → 启动后 curl `/api/state`、装/更/卸各一轮、断言 roster 与 preset 目录产物；
- **从零安装**：全新临时 `DSH_HOME`/profile，按 README 的精确命令（Git 分发；本插件零构建，仓库内 `src/`+`client/` 即产物，无需 prepare/allowBuilds）安装，断言 profile dependency、`dsh.profile.bundles` 与 exports 各文件存在；
- **GUI 清单**：独立 web profile 真实浏览器——市场页路由、刷新、装卸交互、刷新页面后状态保持、宽窄屏、焦点/键盘、reduced motion、HMR/dispose 后 slot/style/controller 清理。

## 11. 决策记录（2025-09，已全部拍板）

| # | 议题 | 决策 | 落点 |
|---|---|---|---|
| 1 | 命名 | 插件 `dsh-workbuddy-market`；preset 前缀 `wb-`；工具 `workbuddy_*`；路由前缀 `/dsh-workbuddy-market` | §0 §5 §6 |
| 2 | 召唤能力 | **要**，进首版规划（P3 相） | §6 §7 §10 |
| 3 | 无效源路径 | **允许保存 + 页面黄条提示**：保存不校验存在性，`/api/state` 返回 `pathExists` + warning，市场页黄条呈现，改对路径即自动恢复 | §3 §5 §7 |
| 4 | 目录变更监听 | **不做 fs.watch**：手动刷新按钮 + `/api/state` 指纹自动重扫已覆盖「WorkBuddy 侧更新」场景 | §2 |
| 5 | 指纹粒度 | **逐文件哈希（深度 ≤3，`(相对路径, mtimeMs, size)`）**：顶层目录 mtime 方案经实证感知不到既有插件的内容更新与目录内新增 agent，系统性漏检 | §2 §9 |
| 6 | 模板转义 | 非注册 `{{…}}` 组**全部**拆括号转义（含代码示例大括号）；注册白名单（model/cwd/provider）数据化；大括号被永久改写的保真代价如实披露 | §2 §9 |
| 7 | skills 锚定幂等 | skill-filesystem 行 patch 兼容 pristine / already-patched 两形态，update 重打不误报「skills 未挂载」 | §4 §9 |
| 8 | manifest 指纹覆盖面 | 指纹 = 落盘进 preset 的全部字段（name/description/persona/skills），只改 frontmatter 描述也触发 updatable | §4 |
| 9 | 跨源冲突与孤儿 | 撞不同源装的 `wb-<id>` 报明确错误；换源后 roster 孤儿以 `orphans` 返回、P4 展示，不自动卸载 | §4 §5 §10 |
| 10 | 防递归不对称 | 接受：姊妹只 deny market_*，agency 子代理可再召 wb 专家，深度 3 有界终止；不依赖跨仓库改动 | §6 |
| 11 | 验证相 | 新增 P5：真实组合（scratch profile + `--dump-config` + curl）、从零安装（全新 DSH_HOME 按 README 命令）、GUI 清单 | §10 |
| 12 | 元数据源 | **plugin.json 首选 + 原映射兜底**：`.codebuddy-plugin/plugin.json`（42/42 插件皆有）提供 zhDescription/avatar/profession.zh；团队卡走 agent frontmatter 链 | §2 |
| 13 | 团队头像 | `avatars/<agentName>.png` 精确匹配 → `team.png` → 首 PNG → emoji（静态 🧑‍💻）；匹配失败不警告 | §2 |
| 14 | CRLF 语料 | 全链路 `\r?\n` 容错 + 抽取文本统一 strip `\r`（实测 11/50 文件 CRLF，不洗则近四分之一专家静默降级） | §2 |
| 15 | skills 真相源 | 照搬 `skills/` 全部子目录（含无 SKILL.md 的死重如 `references/`）；badge 计数 = 拷贝范围 = 目录所见；不做声明一致性检查 | §2 §4 |
| 16 | 同名 id | 跨插件同名 frontmatter name → first-wins + warning（姊妹装载同款；id 决定 preset 名不可静默覆盖） | §2 |
| 17 | manifest 缺失/损坏 | 并入 `broken: true` + 专属 warning 文案「清单缺失，请卸载重装」；install/update 撞到时报同样错误 | §4 §5 |
| 18 | 实现细节 | `~` 原串存储/使用时展开；丢弃字段清单补全（vibe/emoji/color、plugin.json 的 version/homepage/quickPrompts/defaultInitPrompt/categoryId/tags）；`agents/` 只扫平铺 `*.md`；`!!js` 表达式逐字照抄 shipped cordis preset；mtime touch 假报 updatable 披露 | §2 §3 §4 |
| 19 | zhName 末端兜底（T2 实施新增） | 正文首 H1 的括号职能名作**最后一个中文来源**插在 `name` 兜底之前（仅接受含 Han 且 ≤40 字；无括号取整个标题）：实测 4 个专家（design-to-code / dockerfile-gen / product-management / remotion-video-generator）frontmatter 与 plugin.json 均无任何中文元数据，设计链必然落到英文 `name`，而工票 #3 验收要求「18 个无 frontmatter displayName 的专家全部取到中文职能名、无英文 id 兜底」——这 4 个的正文 H1 恰为「品牌（职能名）」形（`图变码（设计转代码专家）`）。**只增不改**：设计链能命中的专家 zhName 分毫不变；末端兜底仍按 §2 表落到 `name`（displayName.en ?? id），不落裸 id。另：root 不存在的 warning 由 state 层（pathExists）报出，scanner 不重复报（§2 行为口径不变，实现分工在此注明） | §2 |
| 20 | 指纹清单的可见性对齐（T3 实施新增） | 逐插件清单条目**含目录本身**（`agents/ skills/ rules/ avatars/` 深度 ≤3 内的目录也按 `(相对路径, mtimeMs, size)` 入清单），不只收文件：`skills/` 的**空子目录**无任何文件却直接改扫描输出（skills 名单 = 子目录名所见，#15），只收文件会漏检；`git:` 前缀插件目录**不入**插件目录名清单也不 walked——scanner 整体跳过它们，输出永不为它们所动，键也必须不能（⟺ 可见性对齐，含 root 级点目录：scanner 扫它们，键也收）；named 子目录内的点条目与 symlink 同 scanner 的 listDir 一样不可见、不入清单；不可达 root（缺失/不可读）哈希为稳定标记——空扫描照样可缓存；并发同 (路径, 指纹) 的 stateOf 合并到单个在途扫描 | §2 |
| 21 | 安装期实施口径（T4 实施新增） | 三项只增不改的实施决定：**① 同源重复安装 = remove → 重拷的幂等重装**（copy() 拒绝覆盖已有 id，重装失败时报「原安装已在重装开始时移除，重新执行安装即可恢复」，不留半成品规则不变）；**② 降级路径的指纹仍取扫描卡数据**（persona/skills 锚失配时落盘产物降级，但 manifest fingerprint 照算卡数据的 sha256——#6 的 updatable 比对双方都来自源扫描，若按实际落盘算，降级安装会永远显示 updatable；「指纹=落盘字段」的 #8 字面在降级路径上让位于此）；**③ 安装新增产物（skills 树、manifest）随 roster 收紧为 owner-only**（0o600/0o700，文件保留 owner-execute 位——roster 对 copy 产物本身就这么做，后加文件不得放宽该姿态）。另：skills 子目录的存在性以目录 stat 为准（空目录/纯 dotfile 目录照拷 #15，指纹行可以为空） | §4 |
| 22 | zhName 优先级实证（T11/P4 实施新增） | **团队卡链调序为 frontmatter `profession.zh` ?? `displayName.zh`**（原 `displayName.zh` 优先）；**单体链维持** plugin.json `profession.zh` 首选。依据 `scripts/zhname-audit.mjs` 对真实语料的抽查（11/11 团队成员全量 + 10 张单体抽样）：团队成员卡 frontmatter `displayName.zh` **一律人名/花名**（高见远、贝洛奇、颜好看、大湾区靓仔、阿爆…），`profession.zh` **一律职能名**（首席架构师、后端工程师、UI/UX 设计师…），正文 H1 亦以「职能名 - 人名」为序——原链会让每张团队卡以人名示人；单体抽样 7/10 的 plugin.json `displayName.zh` 携品牌/人名（鹏城信息AI专家、火眼眼、运维通、严研行）而 `profession.zh` 为职能名，重申单体现行优先级正确。两类卡统一「职能名优先」口径；正文 H1 兜底链位不变（#19） | §2 `scripts/zhname-audit.mjs` |

后续新议题在此追加，保持「议题 → 决策 → 落点」三列。
