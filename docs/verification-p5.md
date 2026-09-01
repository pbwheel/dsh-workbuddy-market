# P5 验证相记录：真实组合 / 从零安装 / GUI 清单

> 工票 #13（T12）· 执行基线：main @ `50cb693`（与 origin/main 同步，T1–T11 全部成果）
> 环境：macOS arm64 · Node v23.11.1 · dsh 0.1.1-rc.2 · pnpm 11.22.0（corepack 缓存）
> 验证日期：2026-09-01/02（UTC）· 全程隔离 `DSH_HOME` 于 `/tmp/wb-p5-verify/`，真实 WorkBuddy 语料与真实 `~/.dsh` 零写入
> 复验材料：脚本、日志与截图留存于 `/tmp/wb-p5-verify/`（`real/`、`zero/`、`gui/`）

## 结论速览

| 清单 | 结果 |
|---|---|
| ① 真实组合 | **12/12 过**，0 不过，0 环境不可验 |
| ② 从零安装 | **6/6 过**，0 不过，1 环境限制（https git clone 被本沙箱 TLS 拦截，以同树本地镜像替代，其余命令逐字一致） |
| ③ GUI 清单 | **9/9 可验项全过**，0 不过；1 项环境不可验（真实凭据召唤闭环，本环境无任何模型 API key） |
| 缺陷清单 | **零缺陷**（未发现需回灌或开新票的产品问题；环境限制 4 条单列于 §4） |
| 收尾检查 | `node scripts/smoke.mjs` 全绿；仓库工作树零改动（仅新增本文件）；真实语料 mtime 级零写入 |

---

## ① 真实组合（隔离 DSH_HOME + 本地路径安装 + 真实语料）

环境：`DSH_HOME=/tmp/wb-p5-verify/real/home`；corepack/pnpm 缓存亦隔离（`COREPACK_HOME`、`XDG_CACHE_HOME` 指向 `/tmp/wb-p5-verify/`）。安装形态按工票要求取本地路径：

```sh
dsh plugin --profile web add /Users/chan/github/my-dsh/dsh-workbuddy-market
# → dependencies: + dsh-workbuddy-market link:/Users/chan/github/my-dsh/dsh-workbuddy-market
# → Done in 309ms（link: 形态，零网络、零构建）
```

### 逐项结果

| # | 项 | 结果 | 关键证据 |
|---|---|---|---|
| 1.1 | `plugin add` 本地路径安装成功 | ✅ 过 | profile `dependencies` 增 `dsh-workbuddy-market`（link:）；`dsh.profile.bundles` 增补该层 |
| 1.2 | `--dump-config` 断言 bundle 层 | ✅ 过 | 输出含三层标记：`# == @deepseek-ai/dsh-base` → `# == @deepseek-ai/dsh-web-app`（patch 层）→ `# == dsh-workbuddy-market`（第 504 行起） |
| 1.3 | 断言插件行 | ✅ 过 | 行体恰为 `- id: dsh-workbuddy-market` / `name: dsh-workbuddy-market`，与 `cordis.patch.yml` 逐字一致。config 断言按本插件形态取**负存在性**：行无 `config` 段——插件刻意不导出 Config schema（导出普通对象会令 loader 启动即崩，源码注释有说明；配置面走宿主 settings 命名空间 `workbuddy-market`，见 1.4 的 sourcePath 回传），故「配置」断言即「行内无 config 且 dump 与 patch 声明逐字一致」 |
| 1.4 | boot 后 `curl /api/state`（50 卡真实语料） | ✅ 过 | `http=200`、`cache-control: no-store`、`pathExists:true`、`experts:50`、`warnings:[]`、`orphans:[]`；默认 `sourcePath` 以 `~` 原串返回；带 skills 卡 30 张、8 人团队卡 8 张（每张 teamSize=8）。census 报 `41 plugins` 而磁盘目录 42 个：多出的 1 个是 `git:` 前缀重名安装副本，按设计（scanner 的 git:-skip 规则）整体跳过，不产卡——两数由此吻合 |
| 1.5 | 写操作仅走 fixture 源：install | ✅ 过 | `POST /api/install {id:"p5-solo-a"}` → `{"ok":true,"presetId":"wb-p5-solo-a","base":"standard"}`；产物目录含 `preset.yml`、`agent.cordis.yml`、`.workbuddy-market.json`（指纹+源路径+导入时间）、`skills/p5-skill-one/SKILL.md` 与 `skills/p5-refs-only/data.txt`（含无 SKILL.md 的数据目录，照搬不解释，符合设计 #15） |
| 1.6 | update | ✅ 过 | 改 fixture 源正文 → `POST /api/refresh` → 卡片 `updatable:true` → `POST /api/update` → preset 内出现 `MARKER-A-V2`、指纹翻新（`de63…` → `6d4f…`）、`updatable` 归零 |
| 1.7 | uninstall | ✅ 过 | `POST /api/uninstall` → `{"ok":true}`，`.agent-presets/` 下目录消失（含 skills 与 manifest） |
| 1.8 | 真实语料只读一轮：装真实专家→卸载清理 | ✅ 过 | 装真实 `backend-architect`（skills 2 个目录、含字体文件全量拷入）→ roster installed 标记真 → 卸载即清；全程真实语料目录 mtime 级零写入（`find … -newer` 为空，收尾复验同） |
| 1.9 | roster 断言（读路径） | ✅ 过 | installed/updatable 覆盖层由宿主 `agentPresets.list()` 计算（`src/presets.js:128`），装/卸翻转即时正确——roster 读路径经真实服务证实 |
| 1.10 | roster 断言（写路径 + preset 目录产物） | ✅ 过 | 安装走 roster 认可的 copy 路径；`preset.yml` 的 `name: "p5-solo-a"`、`.workbuddy-market.json` 溯源四元组齐备 |
| 1.11 | 同源围栏与变更纪律复验 | ✅ 过 | 无 `Origin` 头的 POST → `403`；所有 JSON 响应 `no-store`（唯一例外 avatar `max-age=60` 未变更） |
| 1.12 | 服务器日志零错 | ✅ 过 | 全程 server.log 仅 banner 一行：`dsh web: http://127.0.0.1:3411` |

---

## ② 从零安装（全新 DSH_HOME，README 安装段逐字执行）

环境：`DSH_HOME=/tmp/wb-p5-verify/zero/home`（全新）；工作目录 `/tmp/wb-p5-verify/zero/`。

### 环境限制（非 README 缺陷）

README 安装段第一条 `git clone https://github.com/pbwheel/dsh-workbuddy-market.git` 在本沙箱内被 TLS 层拦截（git 报 `LibreSSL SSL_connect: SSL_ERROR_SYSCALL`，三次重试一致；同一 URL 用 curl 曾获 HTTP 200，github.com 本身可达——属本执行环境对 git TLS 的选择性阻断，正常机器不受影响）。按 dsh-plugin-development skill §8.4 兜底：从与远端同步的本地镜像克隆**完全相同的发布树**（main @ `50cb693`，克隆后 `git rev-parse HEAD` 与 `git status`（clean, in sync）留档）。**其余三条命令逐字复制自 README，无任何改写。**

### 逐项结果

| # | 项 | 结果 | 关键证据 |
|---|---|---|---|
| 2.1 | README 命令逐字可执行 | ✅ 过（含 1 环境限制） | `cd dsh-workbuddy-market` → `dsh plugin --profile web add .` → `dsh --profile web --dump-config`；`add` 自动初始化全新 profile（`dsh: initialized profile web at …`）并 218ms 完成 |
| 2.2 | 零构建 | ✅ 过 | 插件 `package.json` 无 `scripts`、无 `dependencies`；安装输出无任何构建/prepare 动作；克隆目录即源码目录（`src/`、`client/` 即产物） |
| 2.3 | 无需 prepare/allowBuilds | ✅ 过 | 全程无 pnpm 构建脚本拦截提示；profile 的 `pnpm-workspace.yaml` 保持模板原样（无 `allowBuilds` 字段写入） |
| 2.4 | profile 依赖就位 | ✅ 过 | `dependencies: {"dsh-workbuddy-market":"link:…/zero/dsh-workbuddy-market"}`；`dsh.profile.bundles` 三层含本插件 |
| 2.5 | exports 指向的每个文件真实存在 | ✅ 过 | `src/index.js`、`client/client.js`、`cordis.patch.yml`、`package.json` 四个 exports 目标逐一 `[ -f ]` 通过（经 profile `node_modules` 符号链接解析到克隆树） |
| 2.6 | 插件 boot 无错 | ✅ 过 | `dsh --profile web --port 3412` 启动：日志仅 banner；`curl /api/state` → 50 卡；首页 `__DSH_BOOT__` 引导图含 `dsh-workbuddy-market/client.js?rev=e8ae…`；`GET /plugins/dsh-workbuddy-market/client.js` → 200 `text/javascript` 105479 字节，与仓库 `client/client.js` **逐字节一致**（`cmp` 通过） |

补充：`--dump-config` 输出第 504–506 行出现本插件层（与 ① 同形），README 所述「配置输出里应能看到 dsh-workbuddy-market」属实。

---

## ③ GUI 清单（独立 web profile + 真实浏览器 CDP）

环境：`DSH_HOME=/tmp/wb-p5-verify/gui/home`（独立第三套），插件装自 scratch 副本 `/tmp/wb-p5-verify/gui/wt`（仓库发布树的逐文件拷贝——保证随后 HMR 触碰不污染工作仓库）；服务器 `--port 3413`。

浏览器说明（环境限制，非插件缺陷）：系统 Chrome 在本委托沙箱下多进程网络服务持续崩溃（`Network service crashed`），改用 Playwright 的 **chromium headless shell**（真实 Chromium 引擎，CDP 协议完整）。该构建对 `Page.navigate` 应答挂起，导航一律以 `location.href` 赋值驱动——对页面与被测插件无差别。应用界面语言随 headless 默认为英文（en 字典为插件自带的完整翻译，双语标签驱动均已验证）。

另：DSH shell 首跑引导（Internal Testing Notice / Add an API key）在无凭据的 scratch home 中每次重载都会重现，属 shell 行为；验证脚本先以 Configure later/Continue 关闭再走清单项，不构成插件缺陷。

### 逐项结果

| # | 项 | 结果 | 关键证据 |
|---|---|---|---|
| 3.1 | 市场页在设置中可达（路由） | ✅ 过 | 设置 nav：`["General","Models","Plugins","Agent presets","WorkBuddy Experts"]`；进入后 `.wbm-path-input` 默认值 `~/.workbuddy/plugins/marketplaces/experts/plugins`、census `50 experts / 41 plugins`（真实语料）、scoped style tag 恰 1 个、console 零错 |
| 3.2 | 刷新按钮工作 | ✅ 过 | 新建 fixture 专家目录后 600ms 页面仍 4 卡（不自动重扫）；点刷新按钮飞行中 `disabled:true`（防重复提交）→ 完成后 census `5 experts / 4 plugins`、迟到专家卡出现 → 按钮复原 `disabled:false` |
| 3.3 | 装/卸交互真实生效 | ✅ 过 | 卡片「Install」→ 行内确认「Install now?」→ 卡翻 `installed:true` 且按钮变「Uninstall」；落盘核对 `${DSH_HOME}/.agent-presets/wb-p5-solo-a/`（preset.yml + skills + manifest）即时出现；「Uninstall → 确认」后目录消失、卡回「Install」 |
| 3.4 | 刷新浏览器页面后状态保持 | ✅ 过 | `location.reload()` + 重开设置：census 前后一致（`5 experts4 plugins`）、已装的 p5-solo-b 仍 `installed:true`、源路径仍 fixture；磁盘 `settings.yaml` 持久层同步（`workbuddy-market.sourcePath`） |
| 3.5 | 宽/窄屏两档布局不破 | ✅ 过 | 1600×1000：`scrollW 1600 = inner` 无横向溢出；390×844（mobile）：`scrollW 390 = inner` 无溢出；两档可见面一致。可见卡口径：fixture 此时 4 个插件目录（p5-solo-a、p5-solo-b、p5-late-expert 三个单体 + pb-team 一个 2 人团队）→ census `5 experts / 4 plugins`（5 = 3 单体 + 2 团队成员）；页面上 `.wbm-card` 计 3 张（3 张单体卡），团队成员卡按 T11 已验的折叠特性收进 1 个 `.wbm-group-head` 组头（组头非 `.wbm-card`），故「3 张卡 + 1 组头」与 census「5 专家/4 插件」为同一状态的两种口径，均与 3.6 的过滤计数吻合（Installed 过滤后 1 张、All 复原 3 张，指的都是单体卡基数） |
| 3.6 | 焦点/键盘可达 | ✅ 过 | 从搜索框起 Tab 遍历：全部 wbm 控件（5 枚过滤 chips → 卡片装卸按钮 → 团队组头）**枚枚带焦点环**；刷新按钮聚焦 `outline: solid 2px` 可见环，**Enter 键真实触发重扫**（完成复原）；「Installed」chip 聚焦后 **Space 激活**过滤（`1 shown`、卡片 1 张），「All」chip **Enter** 复原（3 张）。（附注：Tab 链上两个无环停靠为 DSH shell 的 composer 文本域与 body，非本插件元素，见 §4-E4） |
| 3.7 | reduced motion | ✅ 过 | `Emulation.setEmulatedMedia` 双向实证：`prefers-reduced-motion: reduce` 下刷新飞行中旋转图标 computed `animation: none / 0s`；对照组 `no-preference` 下同一元素 `wbm-spin / 0.9s`——媒体查询门控精确生效（client CSS 343–345 行的两条规则各得其所）；reduce 下页面渲染与功能无异常 |
| 3.8 | HMR/dispose：bundle 触碰的活体 dispose | ✅ 过 | 页内 MutationObserver 监听 `head`：向 scratch 副本 `client/client.js` 追加一行注释 → host stat-poll → SSE `rebuilt` 帧 → 观测到 style tag **移除**（log:1）随后**恰恢复 1 个**（remount），市场页复测可用（census 50/41）、console 零错——旧 fiber 的 slot/style/controller 清理与新 fiber 重挂载全链真实走通 |
| 3.9 | HMR/dispose：`dsh plugin remove` 后全清理 | ✅ 过 | `dsh plugin --profile web remove dsh-workbuddy-market`（deps 清空、bundles 回两层）→ 重启服务器 → 重载页面：`style[data-plugin="dsh-workbuddy-market"]` **0 个**、任何 style 内 `.wbm-` **0 处**、wbm 元素 **0 个**、设置 nav **无** WorkBuddy 条目、市场 state 路由 **404**（host 半随组合卸载）、console 零错 |
| 3.10 | 召唤闭环（真实凭据） | ⚠️ 环境不可验 | 本环境无任何模型 API key（env 无 `DEEPSEEK_API_KEY` 等，scratch home 无凭据），无法安全发起真实模型调用。**留人工**：装好任一专家后在任意会话让模型调 `summon_workbuddy_expert`。工具注册面（`workbuddy_experts` / `summon_workbuddy_expert`）经 ① 的组合断言与 T9/T10 记录覆盖 |

补充说明：T10 已交付并真机验证过的召唤入口（输入框药丸 + `@` 触发源）本轮尝试复验时，被 DSH shell 的「选择工作区」流程挡住——headless 环境下 shell 的 native 目录选择器不可用，工作区选择无法提交（console 全程零错，插件面无任何报错）。这是 shell 与 headless 环境的组合限制，非插件缺陷；T10 的验证记录（`/tmp/wb-t10-verify/`，截图与日志在案）继续有效。roster 的用户可见面（新会话预设选择器）同理未能走通，roster 断言以 ① 的服务端读路径 + 磁盘产物覆盖。

---

## 4. 环境限制记录（均非产品缺陷，不回灌、不开票）

| # | 现象 | 判定依据 |
|---|---|---|
| E1 | `git clone https://github.com/…` 在本沙箱被 TLS 选择性阻断（git 报 SSL_ERROR_SYSCALL，curl 同 URL 可达） | 三次重试一致；同一 URL curl 获 200；改用同树本地镜像后其余 README 命令逐字通过——README 本身在正常网络下无问题 |
| E2 | 全新 profile 首次 `dsh plugin add` 若 corepack 无 pnpm 缓存，会尝试访问 registry.npmjs.org（本沙箱同样被拦）；预热 `COREPACK_HOME` 缓存后 200ms 级完成 | dsh/corepack 行为；README 无需变更（正常机器 corepack 首次联网属常规） |
| E3 | 系统 Chrome 在本委托沙箱下网络服务子进程崩溃，无法作 CDP 载体；换 Playwright chromium headless shell（真实 Chromium）完成全部清单 | chrome.log 留档 `Network service crashed or was terminated`；headless shell 下全部断言通过、console 零错 |
| E4 | DSH shell 首跑引导对话框每次重载重现；shell composer 文本域/body 在 Tab 链上无焦点环；headless 下 shell 工作区选择的 native picker 不可用 | 三者均在插件未涉及的 shell 表面；插件自身全部交互控件焦点环完备（3.6） |

## 5. 缺陷清单

**零。** 三项清单可验项全部通过；未发现任何需回灌既有票（#8/#10/#12 等）或开新票的产品缺陷；因此本票无静默修复——产品代码、README、测试断言零改动（工作树仅新增本记录文件）。

## 6. 收尾自检

- `node scripts/smoke.mjs`：验证全部结束后复跑，**全绿**（两条 gate + all checks passed）。
- `git status`：main @ 50cb693 干净（本文件为唯一新增）。
- 真实语料 `~/.workbuddy/…`：`find -newer` 零命中（装/卸只读写 DSH_HOME 侧 preset，与设计隐私边界一致）。
- 全部临时进程（3411/3412/3413 服务器、CDP 浏览器）已结束；隔离产物留存 `/tmp/wb-p5-verify/` 供抽查（log：`real/`、`zero/`、`gui/gui1–gui6.log`；截图：`gui/shot-*.png` 18 张，含 5c/5d/5e 三张工作区侧探查过程的旁证）。
