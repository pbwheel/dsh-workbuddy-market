/**
 * Mid-session WorkBuddy expert summoning — the market's second activation
 * mode (ticket #10, design §6).
 *
 * Preset installs (src/presets.js + src/routes.js) stay untouched: install
 * once, pick the `wb-<id>` preset when starting a session. This module adds
 * the other half: two model tools that run any INSTALLED WorkBuddy expert as
 * a one-shot specialist subagent, so a running session can consult or switch
 * experts without restarting on a different preset.
 *
 *   workbuddy_experts()                    → id/name/zhName/description of
 *                                            every installed (summonable)
 *                                            WorkBuddy expert
 *   summon_workbuddy_expert(expert, task)  → delegate one task; the scan
 *                                            card's COMPLETE persona is
 *                                            handed to
 *                                            subagents.start('spawn', …)
 *                                            PER RUN, which is what makes
 *                                            experts switchable
 *                                            mid-conversation.
 *
 * Summon mode deliberately mounts NO preset and injects no skills — the
 * persona is a per-run subagent override and the packaged skills/ tree only
 * exists for the "install as preset, open a session" mode (design §6 边界).
 *
 * Summonable set = the /api/state install overlay's `installed` set (src/
 * presets.js installedMarketState — the one classification authority): a
 * roster `wb-<id>` whose fingerprint manifest names the CURRENT source. Two
 * deliberate consequences: an orphan (installed from another source, or its
 * id left the current table, #9) is NOT summonable even when a same-id card
 * exists in the new source — the installed expert is the other source's —
 * and a broken install (#17) still is, because summoning never touches the
 * preset: the persona comes from the scan card either way.
 *
 * Expert resolution runs against the CURRENT scan table through the shared
 * catalog cache (never a private rescan) and matches id, the English base
 * name, AND the Chinese name (zhName) — a zh user pastes the card title
 * they see, and the model forwards it (exact, then substring; multiple
 * substring hits list candidate ids).
 *
 * Recursion guard (design §6, decision #10): the child's toolFilter deny
 * list names BOTH markets' tools — workbuddy_experts /
 * summon_workbuddy_expert AND the sister plugin's market_experts /
 * summon_market_expert — so with both markets composed a summoned expert
 * cannot reach either market (the sister only denies its own two, so its
 * children can still summon a wb expert once; one level deeper this list
 * cuts the chain — bounded at depth 3, accepted #10). The list is
 * INTERSECTED with the names the tools registry actually serves before
 * each start: the core's tools.restrict() — which the spawn provider
 * applies to the child — validates names loudly and THROWS on unknown ones,
 * so passing the sister's two names verbatim in a profile WITHOUT the
 * sister plugin would fail every child start. An unregistered tool cannot
 * be summoned anyway, so the intersection keeps the guard's exact
 * coexistence semantics while staying functional in every profile.
 *
 * Tools are registered as hand-written ToolDefinition objects (compiled JSON
 * Schema form, argument checks inside execute) instead of defineTool():
 * this plugin is link-installed OUTSIDE the profile tree, so Node's
 * parent-directory resolution from the real source path cannot see
 * '@deepseek-ai/dsh-tools' — the flat fallback under ~/.dsh/profiles only
 * covers plugins physically installed there (which is how the reference
 * resolves it). defineTool is a thin validation wrapper around the exact
 * object shape used here; owning the checks ourselves keeps the repo free
 * of runtime dependencies. (Deviation inherited from the sister plugin —
 * deliberate, do not "fix".)
 *
 * `settings` is NOT injected here (design §1: the summon segment stays
 * usable even when the settings/routes segments are pending): the source
 * path is read through the optional service at call time, falling back to
 * the default raw path when neither the service nor this plugin's
 * namespace is available.
 */

import { installedMarketState } from './presets.js'
import { DEFAULT_SOURCE_PATH } from './scanner.js'
import { SETTINGS_NS } from './settings.js'

/** List tool name — the workbuddy_* namespace (design decision #1). */
export const LIST_TOOL = 'workbuddy_experts'

/** Summon tool name — same namespace rule as LIST_TOOL. */
export const SUMMON_TOOL = 'summon_workbuddy_expert'

/** The sister market's two tool names, denied in every summoned child too. */
const SISTER_TOOL_NAMES = ['market_experts', 'summon_market_expert']

/**
 * Every tool name denied in each summoned child (recursion guard, §6):
 * this plugin's two PLUS the sister market's two, so coexisting markets
 * cannot be reached through each other's children.
 */
export const SUMMON_TOOL_NAMES = [LIST_TOOL, SUMMON_TOOL, ...SISTER_TOOL_NAMES]

/** One-shot subagent provider (the deployment default). */
const PROVIDER = 'spawn'

/** Unicode code-point limit for one delegated task. */
export const TASK_MAX_CHARS = 8000

/** Prompt-section order; the tool-guidance convention band is 100–199. */
const SECTION_ORDER = 117

/** Unique prompt-section name for this plugin's summon guidance. */
const SECTION_NAME = 'workbuddy-market:summon'

// Host-side bilingual messages (zh default, like the sister plugin). Key
// parity between the two dicts is enforced by the smoke run.
const ZH = {
  'error.expertRequired': '必须提供专家 id 或名称',
  'error.expertAmbiguous': '专家“{query}”有歧义；候选：{candidates}。请改用精确 id。',
  'error.expertMissing': '没有匹配“{query}”的 WorkBuddy 专家。请调用 workbuddy_experts 查看可召唤列表。',
  'error.expertNotInstalled': '专家「{name}」尚未安装，无法召唤。请先在 设置 → WorkBuddy 专家 安装该专家。',
  'error.taskRequired': '任务描述不能为空',
  'error.taskLimit': '任务描述过长（{length} 个字符，上限 {max}）',
  'error.requiresAgent': 'summon_workbuddy_expert 需要由智能体会话调用',
  'error.providerMissing': '子代理 provider“{provider}”未注册',
  'error.providerNoPersona': '子代理 provider“{provider}”不支持按次传入专家人格',
  'error.providerNoToolFilter': '子代理 provider“{provider}”无法阻止递归召唤',
  'error.expertRun': '专家运行以“{reason}”结束{detail}',
  'error.partialOutput': '\n部分输出：\n{text}',
  'list.empty': '当前没有可召唤的 WorkBuddy 专家：尚未安装任何专家，或源目录没有扫到专家。请先在 设置 → WorkBuddy 专家 安装或检查源路径。',
  'list.heading': '共 {total} 位可召唤的 WorkBuddy 专家：',
}

const EN = {
  'error.expertRequired': 'an expert id or name is required',
  'error.expertAmbiguous': 'Ambiguous expert "{query}"; candidates: {candidates}. Use an exact id.',
  'error.expertMissing': 'No WorkBuddy expert matched "{query}". Call workbuddy_experts to list summonable experts.',
  'error.expertNotInstalled': 'WorkBuddy expert "{name}" is not installed, so it cannot be summoned. Install it first in Settings → WorkBuddy 专家 (WorkBuddy Expert Market).',
  'error.taskRequired': 'The task must not be empty',
  'error.taskLimit': 'The task is too long ({length} characters, limit {max})',
  'error.requiresAgent': 'summon_workbuddy_expert requires a calling agent session',
  'error.providerMissing': 'subagent provider "{provider}" is not registered',
  'error.providerNoPersona': 'subagent provider "{provider}" does not support per-run personas',
  'error.providerNoToolFilter': 'subagent provider "{provider}" cannot prevent recursive summoning',
  'error.expertRun': 'expert run ended with "{reason}"{detail}',
  'error.partialOutput': '\nPartial output:\n{text}',
  'list.empty': 'No WorkBuddy experts are summonable yet: nothing is installed, or the source directory scanned none. Install experts (or check the source path) in Settings → WorkBuddy 专家 first.',
  'list.heading': '{total} summonable WorkBuddy expert(s):',
}

/** Resolve the host display language from the optional settings service. */
function activeLocale(ctx) {
  try {
    const section = ctx.get('settings')?.get?.('locale')
    return section?.preference === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

/** Format one host message in the given language with {name} interpolation. */
function format(locale, key, params) {
  let text = (locale === 'en' ? EN : ZH)[key]
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

/**
 * Every display name one expert answers to: the English base name plus the
 * Chinese name (zhName). A zh user pastes the card title they see — the
 * model must resolve it.
 */
function displayNames(expert) {
  return [String(expert.name ?? ''), String(expert.zhName ?? '')].filter((name) => name !== '')
}

/**
 * Resolve one scanned expert card by id or display name (English or
 * Chinese). Exact id wins, then an exact name, then substring matches on
 * id/name/zhName; multiple substring hits are an error listing candidate
 * ids (so the model picks an exact id), zero hits a plain not-found.
 * @param {object[]} experts - the current scan table's cards
 * @param {string} query - the caller-provided id or name
 * @param {string} locale - host language for error messages
 * @returns the scan card.
 */
export function resolveSummonExpert(experts, query, locale = 'zh') {
  const q = String(query ?? '').trim().toLowerCase()
  if (q === '') throw new Error(format(locale, 'error.expertRequired'))
  const table = Array.isArray(experts) ? experts : []
  const byId = table.find((expert) => expert.id === q)
  if (byId !== undefined) return byId
  const exactNames = table.filter((expert) =>
    displayNames(expert).some((name) => name.toLowerCase() === q),
  )
  if (exactNames.length === 1) return exactNames[0]
  const matches =
    exactNames.length > 1
      ? exactNames
      : table.filter(
          (expert) =>
            String(expert.id ?? '').includes(q) ||
            displayNames(expert).some((name) => name.toLowerCase().includes(q)),
        )
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    throw new Error(
      format(locale, 'error.expertAmbiguous', {
        query: String(query),
        candidates: matches.slice(0, 12).map((expert) => expert.id).join(', '),
      }),
    )
  }
  throw new Error(format(locale, 'error.expertMissing', { query: String(query) }))
}

/**
 * Validate one delegated task: non-empty and at most TASK_MAX_CHARS Unicode
 * code points (surrogate pairs count once). Returns the original string.
 */
export function normalizeTask(task, locale = 'zh') {
  const text = task === undefined || task === null ? '' : String(task)
  if (text.trim() === '') throw new Error(format(locale, 'error.taskRequired'))
  const length = Array.from(text).length
  if (length > TASK_MAX_CHARS) {
    throw new Error(format(locale, 'error.taskLimit', { length, max: TASK_MAX_CHARS }))
  }
  return text
}

/**
 * The RAW stored source path the summon side scans (tilde intact, #18):
 * this plugin's settings namespace when the optional settings service and
 * the settings segment are both live, the default raw path otherwise — the
 * summon segment never depends on the settings segment (design §1).
 * @param {object|undefined} settingsService - `ctx.get('settings')`
 * @returns {string}
 */
export function currentRawSourcePath(settingsService) {
  const value = settingsService?.get?.(SETTINGS_NS)
  return typeof value?.sourcePath === 'string' && value.sourcePath !== ''
    ? value.sourcePath
    : DEFAULT_SOURCE_PATH
}

/**
 * The summonable cards of one scan table: exactly the cards the /api/state
 * install overlay reports as installed (roster `wb-<id>` + fingerprint
 * manifest naming the CURRENT source — orphans and foreign presets are not
 * summonable, broken installs are, see the module comment).
 * @param {object} agentPresets - the injected roster service
 * @param {string} rawSourcePath - the RAW stored source path
 * @param {object[]} experts - the current scan table's cards
 * @returns {Promise<object[]>}
 */
export async function summonableCards(agentPresets, rawSourcePath, experts) {
  const overlay = await installedMarketState(agentPresets, rawSourcePath, experts)
  return (Array.isArray(experts) ? experts : []).filter((expert) => overlay.byId.has(expert.id))
}

/**
 * The deny list for one child start: SUMMON_TOOL_NAMES intersected with the
 * names the tools registry actually serves. The core's tools.restrict() —
 * applied to the child by the spawn provider — throws on unknown names, so
 * a profile without the sister plugin must not receive its two names
 * verbatim (see the module comment); our own two are always registered by
 * the very fiber running this code. Caveat: if the sister plugin ever
 * renames its tools, the stale names here simply drop out of the effective
 * list — a coexistence review is the remedy, and the smoke run pins
 * today's four names.
 */
function effectiveDenyNames(toolsService) {
  return SUMMON_TOOL_NAMES.filter((name) => {
    try {
      return toolsService.get(name) !== undefined
    } catch {
      // A lookup that itself fails stays in the list: fail loud, never a
      // silently weakened recursion guard.
      return true
    }
  })
}

/** Concatenate the text blocks of one subagent result output. */
function textBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
}

/**
 * Persona passthrough, deliberately verbatim: the scan card's persona was
 * template-escaped at scan time (decision #6 — only registered variables
 * like {{model}}/{{cwd}} survive as complete groups), so it interpolates
 * with exactly the child persona semantics the core documents. Nothing is
 * re-sanitized here; a future scanner regression fails loudly at child
 * startup, which is the fail-loud behavior we want.
 */

/**
 * Run one expert as a one-shot subagent and await its answer.
 * @param {object} ctx - injected context with subagents + agentPresets + tools
 * @param {{ stateOf(rawRoot: string): Promise<{experts: object[], warnings: string[]}> }} catalog
 *        the shared scan cache (never a private rescan)
 * @param {string} locale - host language for error messages
 * @param {string} query - expert id or name from the model
 * @param {string} task - the delegated task text
 * @param {object} exec - tool execution (agent + cancellation signal)
 * @returns {Promise<{expert: string, answer: string}>}
 */
async function runExpert(ctx, catalog, locale, query, task, exec) {
  const taskText = normalizeTask(task, locale)
  if (exec === undefined || exec.agent === undefined) {
    throw new Error(format(locale, 'error.requiresAgent'))
  }
  const provider = ctx.subagents.getProvider(PROVIDER)
  if (provider === undefined) {
    throw new Error(format(locale, 'error.providerMissing', { provider: PROVIDER }))
  }
  if (!provider.capabilities.persona) {
    throw new Error(format(locale, 'error.providerNoPersona', { provider: PROVIDER }))
  }
  if (!provider.capabilities.toolFilter) {
    throw new Error(format(locale, 'error.providerNoToolFilter', { provider: PROVIDER }))
  }

  const rawSourcePath = currentRawSourcePath(ctx.get('settings'))
  const scan = await catalog.stateOf(rawSourcePath)
  const expert = resolveSummonExpert(scan.experts, query, locale)
  const summonable = await summonableCards(ctx.agentPresets, rawSourcePath, scan.experts)
  if (!summonable.some((card) => card.id === expert.id)) {
    throw new Error(
      format(locale, 'error.expertNotInstalled', { name: String(expert.zhName ?? expert.name ?? expert.id) }),
    )
  }

  const run = await ctx.subagents.start(PROVIDER, {
    label: `wb-expert:${expert.id}`,
    prompt: [{ type: 'text', text: taskText }],
    parent: exec.agent,
    persona: expert.persona, // verbatim — see the persona note above
    toolFilter: { deny: effectiveDenyNames(ctx.tools) }, // summoned experts cannot summon
    signal: exec.signal,
  })
  try {
    const result = await run.result
    const text = textBlocks(result.output)
    if (result.stopReason !== 'completed') {
      const bits = []
      if (typeof result.diagnostic === 'string' && result.diagnostic !== '') {
        bits.push(result.diagnostic)
      }
      if (text !== '') bits.push(format(locale, 'error.partialOutput', { text }))
      throw new Error(
        format(locale, 'error.expertRun', { reason: result.stopReason, detail: bits.join('\n') }),
      )
    }
    return { expert: expert.id, answer: text }
  } finally {
    await run.dispose()
  }
}

/** Parent-session guidance; children get '' so they never re-summon. */
const SECTION_TEXT = [
  '## WorkBuddy expert summoning',
  'WorkBuddy experts installed from the WorkBuddy Expert Market (Settings → WorkBuddy 专家) can be summoned in ANY session, mid-conversation — no new session needed.',
  '- `workbuddy_experts()` lists installed experts (id, English name, Chinese name, description).',
  '- `summon_workbuddy_expert(expert, task)` delegates one self-contained task to that expert: a specialist subagent runs with the expert persona and this call returns its answer.',
  'Use it whenever the user asks to consult a WorkBuddy expert or a task clearly belongs to one; different experts can be summoned for different tasks in the same conversation. `expert` accepts the id (preferred), the English name, or the Chinese name (中文可模糊匹配). Not-installed experts cannot be summoned — tell the user to install them in Settings → WorkBuddy 专家 first.',
].join('\n')

/** Render the list tool's canonical value as model-facing text. */
function renderExpertList(locale, _args, value) {
  if (value.experts.length === 0) return format(locale, 'list.empty')
  const lines = [format(locale, 'list.heading', { total: value.total })]
  for (const expert of value.experts) {
    if (locale === 'en') {
      lines.push(`- ${expert.id} · ${expert.name} — ${expert.description}`)
    } else {
      lines.push(`- ${expert.id} · ${expert.zhName} — ${expert.zhDescription || expert.description}`)
    }
  }
  return lines.join('\n')
}

/**
 * Register the two summon tools and the prompt section on an injected
 * context. Returns a disposer that drops all three, so the plugin unloads
 * cleanly (every side effect reversible, mirroring src/routes.js).
 * @param {object} ctx - context with tools, subagents, systemPrompt, agentPresets
 * @param {{ stateOf(rawRoot: string): Promise<{experts: object[], warnings: string[]}> }} deps.catalog
 *        the shared scan cache created in src/index.js
 * @returns {() => void} combined disposer.
 */
export function mountWorkbuddySummon(ctx, { catalog }) {
  const disposers = []
  const register = (off) => {
    if (typeof off === 'function') disposers.push(off)
  }

  register(
    ctx.tools.register({
      name: LIST_TOOL,
      description:
        'List WorkBuddy experts installed from the WorkBuddy Expert Market that can be summoned in the current session: each expert\'s id, English name, Chinese name (zhName), and description. Call this BEFORE summon_workbuddy_expert whenever you do not know the exact expert id — summoning accepts an id, the English name, or the Chinese name. Only installed experts are summonable; users install experts in Settings → WorkBuddy 专家 (WorkBuddy Expert Market).',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            experts: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  zhName: { type: 'string' },
                  description: { type: 'string' },
                  zhDescription: { type: 'string' },
                },
                required: ['id', 'name', 'zhName', 'description', 'zhDescription'],
              },
            },
            total: { type: 'integer' },
          },
          required: ['experts', 'total'],
        },
        render: (args, value) => [
          { type: 'text', text: renderExpertList(activeLocale(ctx), args, value) },
        ],
      },
      async execute() {
        const locale = activeLocale(ctx)
        const rawSourcePath = currentRawSourcePath(ctx.get('settings'))
        const scan = await catalog.stateOf(rawSourcePath)
        const summonable = await summonableCards(ctx.agentPresets, rawSourcePath, scan.experts)
        return {
          experts: summonable.map((expert) => ({
            id: String(expert.id),
            name: String(expert.name ?? expert.id),
            zhName: String(expert.zhName ?? ''),
            description: String(expert.description ?? ''),
            zhDescription: String(expert.zhDescription ?? ''),
          })),
          total: summonable.length,
        }
      },
    }),
  )

  register(
    ctx.tools.register({
      name: SUMMON_TOOL,
      description:
        'Summon one installed WorkBuddy expert to complete a task: a specialist subagent runs with that expert\'s full persona and this call returns its answer. Use it to consult or switch experts mid-conversation without starting a new session. `expert` is the expert id (preferred), English name, or Chinese name (fuzzy matching supported); `task` must be complete and self-contained — include every piece of context it needs. This call waits for the expert\'s result. Call workbuddy_experts first if you do not know the exact id. Not-installed experts cannot be summoned.',
      parameters: {
        type: 'object',
        properties: {
          expert: {
            type: 'string',
            description: 'Expert id (preferred, e.g. backend-architect), English name, or Chinese name (zhName).',
          },
          task: {
            type: 'string',
            description:
              'The complete, self-contained task for the expert — include every piece of context it needs.',
          },
        },
        required: ['expert', 'task'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            expert: { type: 'string' },
            answer: { type: 'string' },
          },
          required: ['expert', 'answer'],
        },
        render: (_args, value) => [{ type: 'text', text: value.answer }],
      },
      async execute(args, exec) {
        const locale = activeLocale(ctx)
        // Hand-written definitions get no defineTool() argument wrapper, so
        // validate the two strings here (extra keys are ignored — the schema
        // already tells the model not to send them).
        const query = args && typeof args.expert === 'string' ? args.expert : ''
        if (query.trim() === '') throw new Error(format(locale, 'error.expertRequired'))
        const task = args && typeof args.task === 'string' ? args.task : ''
        return runExpert(ctx, catalog, locale, query, task, exec)
      },
    }),
  )

  register(
    ctx.systemPrompt.section({
      name: SECTION_NAME,
      order: SECTION_ORDER,
      // Sub-sessions (a parentSession in the header) get an empty section:
      // summoned experts must not be taught to summon further experts —
      // from either market.
      text: (context) =>
        context.agent?.session?.header?.parentSession !== undefined ? '' : SECTION_TEXT,
    }),
  )

  return () => {
    for (const off of disposers) off()
  }
}
