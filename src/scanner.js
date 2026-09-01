/**
 * WorkBuddy source-directory scanner (ticket #3): reads the user's WorkBuddy
 * experts tree into complete expert cards — one card per flat `agents/*.md`.
 *
 * Contract (kept from the T1 placeholder):
 *   - `scanWorkbuddyRoot(rawRoot)` receives the RAW stored path (tilde intact,
 *     decision #18) and expands it against the filesystem itself;
 *   - it never writes anything — cards live in memory only.
 *
 * Field mapping (design doc §2, plugin.json first + original fallbacks #12):
 *   id           ← frontmatter `name` (must pass ID_RE)
 *   name         ← frontmatter `displayName.en` ?? `name`          (base/en)
 *   zhName       ← single: plugin.json `profession.zh`
 *                → team card: frontmatter `profession.zh` ?? `displayName.zh`
 *                  (decision #22, the P4 empirical audit: every sampled team
 *                  member's displayName.zh is a person name while
 *                  profession.zh is the functional name — the same shape the
 *                  solo plugin.json fields show, so both classes put the
 *                  functional name first)
 *                → frontmatter `displayName.zh` ?? `profession.zh` (any card,
 *                  as fallbacks after the class-specific sources above)
 *                → first body H1's functional name when it is Chinese
 *                (decision #19, see BODY-H1 EXTENSION below)
 *                → `name`
 *   description  ← frontmatter `description` (use-when trigger text)
 *   zhDescription← plugin.json `displayDescription.zh` → README.md first
 *                non-title paragraph (heuristic; may be English — disclosed)
 *   persona      ← agent body + every flat `rules/*.md` appended under a
 *                generated title; `{{…}}` groups that are not registered
 *                prompt variables get their braces split (`{{` → `{ {`,
 *                decision #6); every `\r` is stripped (decision #14)
 *   skills       ← names of ALL subdirectories under `skills/` — copied
 *                verbatim with zero interpretation, including data
 *                directories without SKILL.md (decision #15; the badge count
 *                equals the copy range equals what the directory shows)
 *   avatarPath   ← single: plugin.json `avatar` (relative, existence-checked
 *                — dangling references fall through) → first PNG in `avatars/`
 *                team card: `avatars/<agentName>.png` exact → `team.png` →
 *                first PNG (decision #13) → undefined (client emoji fallback)
 *   pluginDir    ← plugin directory name (provenance badge)
 *   agentFile    ← the card's agent md file name inside agents/ (install
 *                provenance — the fingerprint manifest records it, ticket #5)
 *   teamSize     ← number of agent files in the plugin directory
 *
 * BODY-H1 EXTENSION (decision #19, additive): the real corpus has 4 experts
 * with NO Chinese metadata anywhere (no frontmatter displayName/profession,
 * no plugin.json profession/displayName/displayDescription: design-to-code,
 * dockerfile-gen, product-management, remotion-video-generator). The designed
 * chain would leave them an English name, while the ticket requires a
 * Chinese functional name for every expert without frontmatter displayName.
 * Those four bodies open with a Chinese H1 of the shape `图变码（设计转代码
 * 专家）` — brand name plus the functional name in parentheses. The extension
 * therefore adds ONE last Chinese source before the English fallback: the
 * first body heading's parenthetical (or whole title when unparenthesized),
 * accepted only when it contains Han and stays under 40 chars. It can never
 * override an earlier source, so every expert the designed chain could name
 * keeps its name.
 *
 * Dropped fields (no DSH counterpart, recorded per design §2/#18): agent
 * frontmatter `maxTurns`, `agentMode`, `enabled*`, `vibe`/`emoji`/`color`,
 * and the frontmatter `skills` list (the directory is the truth source #15);
 * plugin.json `version`, `homepage`, `defaultInitPrompt`, `quickPrompts`,
 * `categoryId`, `tags`, plus `author`/`license`/`keywords`/`mcp`/
 * `connectorIds`/`dependencies`/`teamInfo`/`members`; SKILL.md `allowed-tools`
 * (skill contents are not read at scan time at all).
 *
 * Degradation rules (§2, #16 #17): `git:`-prefixed directories are skipped
 * whole and silently (WorkBuddy duplicate-install copies whose agent ids
 * collide with the original); a plugin directory whose plugin.json is missing
 * or corrupt is skipped with a warning while the scan continues; an agent
 * file that cannot be parsed (unreadable, no frontmatter name, invalid id)
 * degrades to a warning for that card only; duplicate ids across plugins are
 * first-wins with a warning (the id names the future `wb-<id>` preset); a
 * missing root yields an empty table with NO scanner warning — the state
 * layer already reports pathExists=false with its own warning.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

import { errorMessage } from './util.js'

/** Default WorkBuddy experts directory, stored/echoed verbatim (#18). */
export const DEFAULT_SOURCE_PATH = '~/.workbuddy/plugins/marketplaces/experts/plugins'

/**
 * The roster's own id rule; the card id names the future `wb-<id>` preset.
 * Exported since T6: the avatar route accepts the SAME charset (one source
 * of truth — the route can never grow an id class the scanner rejects).
 */
export const ID_RE = /^[a-z0-9][a-z0-9-]*$/

/**
 * Prompt variables the running harness registers (dsh-agent-loop registers
 * exactly these three). Kept as data — decision #6 — so the escape whitelist
 * grows with the real registration set, not with scattered literals.
 */
export const REGISTERED_PROMPT_VARIABLES = ['model', 'cwd', 'provider']

const REGISTERED_VARIABLE_SET = new Set(REGISTERED_PROMPT_VARIABLES)

/** Host interpolator's variable-name rule (dsh-system-prompt VARIABLE_NAME). */
const VARIABLE_NAME_RE = /^[a-z][a-z0-9_]*$/

/** A complete `{{...}}` reference group at the scan position. */
const GROUP_AT_RE = /^\{\{([^{}]*)\}\}/

/**
 * Expand a leading `~` or `~/` against the current home directory.
 * Anything else (absolute paths, `~foo`, relative paths) is returned as-is.
 * @param {string} value - raw stored path
 * @returns {string} the filesystem path to stat/read
 */
export function expandTildePath(value) {
  if (typeof value !== 'string') return value
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return join(homedir(), value.slice(2))
  return value
}

/** Strip a UTF-8 BOM, then normalize newlines (#14): `\r\n`/lone `\r` → `\n`. */
function normalizeNewlines(text) {
  return (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n?/g, '\n')
}

// Warnings render thrown values through the shared one-line helper.
const messageOf = errorMessage

// ── template escaping (decision #6) ─────────────────────────────────────────

/**
 * One escaping pass that mirrors the host interpolator's scan exactly:
 * at each `{{` —
 *   - a complete group whose name is a registered variable stays intact;
 *   - a complete group with any other name gets its braces split;
 *   - an incomplete group (nested braces) with a later `}}` in the text would
 *     make the interpolator THROW, so its braces are split too;
 *   - an incomplete group with no later `}}` is literal prose for the
 *     interpolator and is kept as-is.
 * Returns { text, changed } so the caller can iterate to a fixpoint — a
 * single pass can leave a fresh `{{` behind when three or more braces were
 * adjacent (`{{{x}}}` → `{ {{x}}}`), and each split strictly reduces the
 * total number of `{{` pairs, so the loop terminates.
 */
function escapeOnePass(text) {
  let out = ''
  let last = 0
  let changed = false
  for (let open = text.indexOf('{{', last); open >= 0; open = text.indexOf('{{', last)) {
    const group = GROUP_AT_RE.exec(text.slice(open))
    if (group !== null) {
      const name = group[0].slice(2, -2)
      if (VARIABLE_NAME_RE.test(name) && REGISTERED_VARIABLE_SET.has(name)) {
        out += text.slice(last, open + group[0].length)
        last = open + group[0].length
        continue
      }
    } else if (text.indexOf('}}', open + 2) < 0) {
      // Lone `{{` with no closing braces anywhere later: literal prose.
      out += text.slice(last, open + 2)
      last = open + 2
      continue
    }
    out += text.slice(last, open) + '{ {'
    last = open + 2
    changed = true
  }
  return { text: out + text.slice(last), changed }
}

/**
 * Split the braces of every non-registered `{{…}}` group (`{{` → `{ {`) so
 * the persona can never fail child startup at prompt interpolation, while
 * registered groups survive verbatim. Iterates to a fixpoint (see above).
 * @param {string} text - persona text with LF newlines
 * @returns {string} safe persona text
 */
export function escapeUnregisteredTemplateGroups(text) {
  let current = text
  for (;;) {
    const pass = escapeOnePass(current)
    if (!pass.changed) return current
    current = pass.text
  }
}

// ── mini frontmatter reader ─────────────────────────────────────────────────

/** Strip one matching pair of YAML quotes; plain values pass through. */
function unquoteScalar(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value)
    } catch {
      return value.slice(1, -1)
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

/**
 * Parse the WorkBuddy frontmatter YAML subset: top-level scalars (plain,
 * quoted, block `|`/`>` with optional chomp indicator) plus one level of
 * nested `key: value` children (displayName/profession en/zh). List values
 * and anything deeper are ignored — every field this scanner needs in the
 * real corpus is covered by that subset, and unknown shapes degrade to
 * absent fields instead of parse errors.
 */
function parseFrontmatterFields(lines) {
  const root = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i += 1
      continue
    }
    if (/^\s/.test(line)) {
      i += 1
      continue
    }
    const top = /^([A-Za-z_][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(line)
    if (top === null) {
      i += 1
      continue
    }
    const key = top[1]
    const value = top[2].trim()
    if (value === '|' || value === '>' || value === '|-' || value === '>-' || value === '|+' || value === '>+') {
      const folded = value.startsWith('>')
      const block = []
      let j = i + 1
      while (j < lines.length) {
        const next = lines[j]
        if (next.trim() === '') {
          if (block.length === 0) break
          block.push('')
        } else if (/^[ \t]/.test(next)) {
          block.push(next.replace(/^[ \t]+/, ''))
        } else {
          break
        }
        j += 1
      }
      while (block.length > 0 && block[block.length - 1] === '') block.pop()
      root[key] = block.join(folded ? ' ' : '\n')
      i = j
    } else if (value === '') {
      // Nested mapping (or an empty/list value): keep simple `k: v` children.
      const child = {}
      let j = i + 1
      while (j < lines.length) {
        const next = lines[j]
        if (next.trim() === '') {
          j += 1
          continue
        }
        const childMatch = /^[ \t]+([A-Za-z_][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(next)
        if (childMatch === null) break
        const childValue = childMatch[2].trim()
        if (childValue !== '') child[childMatch[1]] = String(unquoteScalar(childValue))
        j += 1
      }
      root[key] = child
      i = j
    } else {
      root[key] = String(unquoteScalar(value))
      i += 1
    }
  }
  return root
}

/**
 * Split `---`-delimited frontmatter off an already newline-normalized text.
 * Files without frontmatter parse to empty fields + the full body.
 * @returns {{ fields: object, body: string }}
 */
function splitFrontmatter(text) {
  const lines = text.split('\n')
  if (lines[0] === undefined || lines[0].trim() !== '---') return { fields: {}, body: text }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (close < 0) return { fields: {}, body: text }
  return {
    fields: parseFrontmatterFields(lines.slice(1, close)),
    body: lines.slice(close + 1).join('\n'),
  }
}

// ── field extraction helpers ────────────────────────────────────────────────

/** Trimmed `.zh` of a metadata object ('' when absent/not a string). */
function zhOf(value) {
  return typeof value?.zh === 'string' ? value.zh.trim() : ''
}

/** Trimmed `.en` of a metadata object ('' when absent/not a string). */
function enOf(value) {
  return typeof value?.en === 'string' ? value.en.trim() : ''
}

/** Trimmed string field ('' for anything else). */
function stringOf(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * First non-title paragraph of a README: frontmatter stripped by the shared
 * splitter, then headings / horizontal rules / HTML comments skipped; stops
 * at the paragraph's first blank line. Returned verbatim (may be English —
 * the design doc discloses this for team plugins shipping README_EN.md).
 */
function firstNonTitleParagraph(text) {
  if (stringOf(text) === '') return ''
  const paragraph = []
  for (const line of splitFrontmatter(normalizeNewlines(text)).body.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') {
      if (paragraph.length > 0) break
      continue
    }
    if (trimmed.startsWith('#') || trimmed === '---' || trimmed.startsWith('<!--')) {
      if (paragraph.length > 0) break
      continue
    }
    paragraph.push(trimmed)
  }
  return paragraph.join('\n')
}

/**
 * The BODY-H1 EXTENSION source: the first non-empty body line, accepted only
 * when it is a heading; the parenthetical part of `品牌（职能名）` wins over
 * the whole title, and only Chinese candidates up to 40 chars qualify.
 */
function bodyHeadingFunctionalName(body) {
  for (const rawLine of normalizeNewlines(body).split('\n').slice(0, 20)) {
    const line = rawLine.trim()
    if (line === '') continue
    const heading = /^#{1,6}[ \t]+(.+)$/.exec(line)
    if (heading === null) return ''
    const title = heading[1].trim()
    const parenthesized = /^(.+?)[（(](.+)[）)]$/.exec(title)
    const candidate = (parenthesized !== null ? parenthesized[2] : title).trim()
    if (candidate !== '' && candidate.length <= 40 && /\p{Script=Han}/u.test(candidate)) return candidate
    return ''
  }
  return ''
}

// ── directory listing helpers (all deterministic: name-sorted) ──────────────

/**
 * One readdir shape shared by every listing the scanner needs: name-sorted
 * entry names kept by the predicate, [] for a missing directory, anything
 * else thrown to the caller's degrade path.
 */
async function listDir(dir, keep) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  return entries.filter(keep).map((entry) => entry.name).sort()
}

/** Flat `*.md` file names in dir ([] when the directory is missing). */
async function listFlatMarkdown(dir) {
  return listDir(dir, (entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.'))
}

/** Sorted `*.png` file names in dir ([] when missing). */
async function listPngs(dir) {
  return listDir(dir, (entry) => entry.isFile() && entry.name.endsWith('.png') && !entry.name.startsWith('.'))
}

/** Names of ALL subdirectories under dir ([] when missing) — verbatim, #15. */
async function listSubdirectories(dir) {
  return listDir(dir, (entry) => entry.isDirectory() && !entry.name.startsWith('.'))
}

/** Read a file's text with newline normalization ('' when missing). */
async function readOptionalText(path) {
  try {
    return normalizeNewlines(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw error
  }
}

/** True when path exists as a regular file. */
async function isFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

// ── plugin + card assembly ──────────────────────────────────────────────────

/**
 * Build every card of one plugin directory. Throws for plugin-level
 * failures (plugin.json missing/corrupt while agents exist, unreadable
 * agents directory); per-agent-file failures land in warnings instead.
 * @returns {Promise<{ cards: object[], warnings: string[] }>}
 */
async function scanPluginDirectory(pluginDir) {
  const pluginName = basename(pluginDir)
  const agentFiles = await listFlatMarkdown(join(pluginDir, 'agents'))

  // The manifest read keeps its own ENOENT: a missing plugin.json is a
  // different verdict than a corrupt one (#17), and a directory with neither
  // manifest nor agents is a foreign folder that stays silently invisible.
  let manifestText
  try {
    manifestText = await readFile(join(pluginDir, '.codebuddy-plugin', 'plugin.json'), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (agentFiles.length === 0) return { cards: [], warnings: [] }
      throw new Error('plugin.json missing')
    }
    throw new Error(`plugin.json unreadable: ${messageOf(error)}`)
  }
  let manifest
  try {
    manifest = JSON.parse(normalizeNewlines(manifestText))
    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('plugin.json is not an object')
    }
  } catch (error) {
    throw new Error(`plugin.json corrupt: ${messageOf(error)}`)
  }

  const warnings = []
  const isTeam = manifest.expertType === 'team' || agentFiles.length > 1
  const pngs = await listPngs(join(pluginDir, 'avatars'))
  const firstPng = pngs[0]
  const teamPng = pngs.includes('team.png') ? 'team.png' : undefined
  const skills = await listSubdirectories(join(pluginDir, 'skills'))
  const ruleFiles = await listFlatMarkdown(join(pluginDir, 'rules'))
  const readmeParagraph = firstNonTitleParagraph(await readOptionalText(join(pluginDir, 'README.md')))
  const manifestProfessionZh = zhOf(manifest.profession)
  const manifestDescriptionZh = zhOf(manifest.displayDescription)

  const cards = []
  for (const file of agentFiles) {
    try {
      const raw = await readFile(join(pluginDir, 'agents', file), 'utf8')
      const { fields, body } = splitFrontmatter(normalizeNewlines(raw))

      const id = stringOf(fields.name)
      if (id === '') throw new Error('frontmatter has no name')
      if (!ID_RE.test(id)) throw new Error(`frontmatter name fails ${String(ID_RE)}: ${JSON.stringify(id)}`)
      const name = enOf(fields.displayName) || id

      // zhName chain — the FUNCTIONAL name first for both classes (#22, the
      // P4 empirical audit): solo cards lead with plugin.json profession.zh
      // (#12), team cards with their own frontmatter profession.zh (the
      // plugin.json one is team-level and identical for every member), each
      // keeping the other displayName/profession fields as fallbacks, the
      // body-H1 extension (#19) last, and the card's English base name as the
      // designed terminal fallback.
      const zhNameCandidates = isTeam
        ? [zhOf(fields.profession), zhOf(fields.displayName)]
        : [manifestProfessionZh, zhOf(fields.displayName), zhOf(fields.profession)]
      zhNameCandidates.push(bodyHeadingFunctionalName(body))
      const zhName = zhNameCandidates.find((candidate) => candidate !== '') ?? name

      // persona: agent body + every rule file under a generated title, with
      // template escaping applied to the assembled whole (rules included).
      const parts = [body.trim()]
      for (const rule of ruleFiles) {
        const ruleText = await readFile(join(pluginDir, 'rules', rule), 'utf8')
        parts.push(`# 附加规则：rules/${rule}\n\n${splitFrontmatter(normalizeNewlines(ruleText)).body.trim()}`)
      }
      const persona = escapeUnregisteredTemplateGroups(parts.join('\n\n'))

      // avatarPath: the existence-checked chains of #12/#13. The team's
      // `<agentName>.png` exact match tries the frontmatter name and the md
      // file stem — the two readings of "agent name" coincide across the
      // real corpus, and the extra candidate only adds robustness.
      let avatarPath
      if (isTeam) {
        const stem = file.replace(/\.md$/, '')
        const exact = pngs.find((png) => png === `${id}.png` || png === `${stem}.png`) ?? teamPng ?? firstPng
        avatarPath = exact === undefined ? undefined : join(pluginDir, 'avatars', exact)
      } else {
        const declared = stringOf(manifest.avatar).replace(/^\.\//, '')
        avatarPath = declared !== '' && (await isFile(join(pluginDir, declared)))
          ? join(pluginDir, declared)
          : firstPng === undefined ? undefined : join(pluginDir, 'avatars', firstPng)
      }

      cards.push({
        id,
        name,
        zhName,
        description: stringOf(fields.description),
        zhDescription: manifestDescriptionZh || readmeParagraph,
        persona,
        skills: [...skills],
        avatarPath,
        pluginDir: pluginName,
        agentFile: file,
        teamSize: agentFiles.length,
      })
    } catch (error) {
      warnings.push(`${pluginName}/agents/${file}: expert skipped (${messageOf(error)})`)
    }
  }
  return { cards, warnings }
}

/**
 * Scan one WorkBuddy root into expert cards. Pure read: nothing is written,
 * no scripts run, no fingerprinting (the catalog cache owns that, ticket #4).
 * @param {string} rawRoot - raw stored source path (tilde expanded here)
 * @returns {Promise<{ experts: object[], warnings: string[] }>}
 */
export async function scanWorkbuddyRoot(rawRoot) {
  const experts = []
  const warnings = []
  const root = expandTildePath(rawRoot)

  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    // A missing root is the state layer's message (pathExists=false plus its
    // own warning) — the scanner stays silent here to avoid duplicating it.
    if (error.code !== 'ENOENT') {
      warnings.push(`source directory not readable: ${root} (${messageOf(error)})`)
    }
    return { experts, warnings }
  }

  const seen = new Set()
  // The root keeps its own readdir (not listDir): a missing root is SILENT
  // here while every other failure warns, a distinction listDir's [] cannot
  // carry.
  for (const name of entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    // WorkBuddy's duplicate-install copies carry `git:`-prefixed names and
    // duplicate the original's agent ids — skipped whole, silently (#16).
    if (name.startsWith('git:')) continue
    let plugin
    try {
      plugin = await scanPluginDirectory(join(root, name))
    } catch (error) {
      warnings.push(`${name}: plugin skipped (${messageOf(error)})`)
      continue
    }
    for (const card of plugin.cards) {
      if (seen.has(card.id)) {
        warnings.push(`duplicate expert id "${card.id}" from ${card.pluginDir} skipped (first wins)`)
        continue
      }
      seen.add(card.id)
      experts.push(card)
    }
    warnings.push(...plugin.warnings)
  }
  return { experts, warnings }
}
