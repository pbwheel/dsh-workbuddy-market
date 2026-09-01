/**
 * Install flow (ticket #5): one WorkBuddy expert card → one roster-recognized
 * user preset `wb-<id>`, the design doc's §4 seven steps in a single pass:
 *
 *   ① agentPresets.copy('standard', 'wb-<id>', name) — the roster-sanctioned
 *      authoring write. An existing `wb-<id>` is classified FIRST by its
 *      fingerprint manifest: a manifest that is missing or corrupt is the
 *      「清单缺失，请卸载重装」 error (#17); a manifest naming another source
 *      is the 「该专家已从别的源目录安装」 error (#9); a manifest naming THIS
 *      source is our own previous install, removed and re-copied so repeated
 *      installs converge on identical products with no misreports.
 *   ② rewrite the copy's preset.yml (name/description from the card's base
 *      fields — the roster's copy keeps the source description and drops the
 *      roster order, so this is the authoring edit, sister-plugin style);
 *   ③ persona row anchor replacement (PERSONA_ROW_RE, sister-plugin verbatim;
 *      anchor miss → warning + the base persona stays, never a broken preset);
 *   ④ copy the expert's `skills/` subdirectories into presetDir/skills/
 *      (skipped entirely when the expert carries none);
 *   ⑤ skill-filesystem row anchor patch, idempotent over both forms (#7):
 *      pristine standard rows gain the `customSkillDirs` config with the
 *      `!!js` expression copied BYTE FOR BYTE from the shipped cordis preset
 *      (#18), and rows we already patched are replaced in place — a second
 *      execution produces no diff and no 「skills 未挂载」 warning. Anchor
 *      miss → step ④ skipped + warning (unmounted skills would be dead
 *      weight in the preset directory);
 *   ⑥ agentPresets.standingKeyFor('wb-<id>') — the same standing mount a
 *      session joins, so a preset that cannot compose never reports success;
 *   ⑦ write the fingerprint manifest presetDir/.workbuddy-market.json:
 *      { sourcePath, pluginDir, agentFile, fingerprint, importedAt }, where
 *      the fingerprint covers every card field that lands in the preset
 *      (decision #8) — name + description + persona + the skills listing
 *      (relative path + size + mtimeMs per file, straight from the source
 *      tree). It is the sha256 of scan-card data, NOT the ticket-#4 scan
 *      cache: update detection (#6) recomputes it from a fresh scan and
 *      compares, so degraded installs (anchor misses) still fingerprint the
 *      card as scanned — that keeps `updatable` semantics source-true.
 *
 * Never-breaks-the-preset rule: any failure after copy() removes the preset
 * we just created (best effort) before rethrowing, so a failed install
 * leaves no half product; failures before copy() create nothing. A reinstall
 * (same source, existing product) removes the old install first by
 * necessity — copy() never overwrites — so a failed reinstall reports that
 * the previous install is gone and a retry restores it.
 *
 * Ticket #6 (T5) adds the source-update follow-through around the same
 * manifest:
 *
 *   - `installedMarketState(agentPresets, rawSourcePath, experts)` — the
 *     `/api/state` overlay: for every roster `wb-<id>` it reads the manifest
 *     and classifies the install against the CURRENT scan table. Same source
 *     and card present → card flags { installed, updatable } (updatable =
 *     manifest fingerprint ≠ a fingerprint recomputed from the fresh scan;
 *     the comparison is source-true on both sides, so degraded installs and
 *     touch-only mtime drift report exactly as disclosed in #18/#21②). A
 *     different manifest source, or an id the current table lacks → an
 *     `orphans` entry — NEVER an automatic uninstall (#9). A missing or
 *     corrupt manifest → `broken` + the 「清单缺失，请卸载重装」 warning
 *     (#17), never a guess about where the preset came from.
 *   - `updateWorkbuddyExpert` — in-place re-stamp of our own user-trust
 *     product: preset.yml rewrite, persona + skill-filesystem anchor
 *     re-patches (both idempotent), skills directory sync (copy new /
 *     re-mirror changed / DELETE directories the source no longer lists),
 *     manifest refresh, and a fresh `standingKeyFor` validation. No copy(),
 *     no remove() — the preset directory itself never moves. On failure the
 *     texts it already rewrote are restored from their in-memory originals,
 *     so a failed update leaves the preset as loadable as it was found.
 *   - `uninstallWorkbuddyExpert` — `agentPresets.remove()` of the whole
 *     preset directory (skills and manifest go with it), refusing anything
 *     not `trust: "user"` exactly like the sister plugin's uninstall.
 */

import { createHash } from 'node:crypto'
import { chmod, cp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { expandTildePath } from './scanner.js'
import { errorMessage } from './util.js'

/** Every WorkBuddy preset this market installs is namespaced under this prefix. */
export const PRESET_ID_PREFIX = 'wb-'

/** The copy base: the roster's full coding-agent composition (pristine skill-filesystem row). */
export const BASE_PRESET_ID = 'standard'

/** The fingerprint manifest written into every installed preset directory. */
export const MANIFEST_FILE = '.workbuddy-market.json'

/**
 * The persona row exactly as the shipped presets lay it out (sister-plugin
 * verified shape): the match spans the `text:` header line AND every
 * following indented/blank line, so a multi-line folded scalar is replaced
 * whole; the next row stops it by starting at column 0. `\r?\n` keeps the
 * anchor working on CRLF files. A miss is a warning, never a hard failure —
 * the preset still mounts with the base persona.
 */
const PERSONA_ROW_RE =
  /(- id: persona\r?\n  name: '@deepseek-ai\/dsh-persona'\r?\n  config:\r?\n    text:)[^\n]*\r?\n(?:[ \t]+\S[^\n]*\r?\n|\r?\n)*/

/**
 * The skill-filesystem row head, plus — optionally — the config block that
 * follows it. The head anchors on the exact two shipped lines (`- id:` +
 * `name:`); the optional group captures a `  config:` section as every
 * indented non-empty line after it, stopping at the next row or blank line.
 * No match means composition drift between dsh versions → skills stay
 * unmounted (warning), never a broken patch.
 */
const SKILL_FS_ROW_RE =
  /(- id: skill-filesystem\r?\n  name: '@deepseek-ai\/dsh-skill-filesystem'\r?\n)(  config:\r?\n(?:[ \t]+\S[^\n]*\r?\n)+)?/

/**
 * The `customSkillDirs` entry this market writes, `!!js` expression copied
 * VERBATIM from the shipped cordis preset (decision #18 — no simplification):
 * it resolves the preset's own skills/ directory at composition load, the
 * same mount the shipped 创造模式 preset uses.
 */
const CUSTOM_SKILL_DIRS_ENTRY =
  '    customSkillDirs:\n'
  + '      - !!js "process.getBuiltinModule(\'node:url\').fileURLToPath(new URL(\'skills/\', baseUrl))"\n'

/** One config block with exactly our entry, appended under a pristine row head. */
const CUSTOM_SKILL_DIRS_BLOCK = `  config:\n${CUSTOM_SKILL_DIRS_ENTRY}`

/** An existing `customSkillDirs:` key inside a matched config block (own item lines included). */
const CUSTOM_SKILL_DIRS_IN_CONFIG_RE = /[ \t]*customSkillDirs:\r?\n(?:[ \t]+\S[^\n]*\r?\n)*/

/** Roster snapshot mapped to { id -> entry } for membership checks. */
async function rosterIndex(agentPresets) {
  const entries = await agentPresets.list()
  const index = new Map()
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry && typeof entry.id === 'string') index.set(entry.id, entry)
  }
  return index
}

/**
 * Swap the persona row's `text` for the expert persona. Returns the patched
 * composition text, or null when the anchor did not match. The replacement
 * is a JSON single-line scalar plus a blank line — YAML double-quote style
 * accepts JSON escapes, and the emitted shape keeps the anchor re-matchable,
 * so re-patching (update, reinstall) is naturally idempotent.
 */
export function patchPersonaText(compositionText, persona) {
  // JSON.stringify emits a double-quoted scalar; YAML double-quote style
  // accepts the same escapes (\n, \t, \", \\, \uXXXX), so this stays valid.
  // The replacer is a FUNCTION on purpose: personas are arbitrary user
  // content and the real corpus carries `$1`/`$&` sequences (regex and SQL
  // examples), which a replacement STRING would interpret as capture-group
  // references and silently rewrite.
  if (!PERSONA_ROW_RE.test(compositionText)) return null
  return compositionText.replace(
    PERSONA_ROW_RE,
    (_match, rowHead) => `${rowHead} ${JSON.stringify(persona)}\n\n`,
  )
}

/**
 * Patch the skill-filesystem row so the preset mounts its own skills/
 * directory. Idempotent over both forms (#7):
 *
 *   - pristine (the copied standard row carries no config) → the
 *     `customSkillDirs` block is appended right after the row head;
 *   - already patched (the row carries a config block — ours from a previous
 *     install/update, or the shipped cordis form) → the `customSkillDirs`
 *     entry is replaced in place; other config keys, if a future base ever
 *     ships any, survive.
 *
 * @param {string} compositionText - the copied composition, LF or CRLF
 * @returns {{ text: string, changed: boolean, form: 'pristine' | 'patched' } | null}
 *          null when the row anchor did not match (composition drift)
 */
export function patchSkillFilesystemRow(compositionText) {
  const match = SKILL_FS_ROW_RE.exec(compositionText)
  if (match === null) return null
  const rowHead = match[1]
  const configBlock = match[2]
  if (configBlock === undefined) {
    // Function replacer: the row head and block are fixed strings here, but
    // the same String.replace trap as the persona patch applies by habit.
    return {
      text: compositionText.replace(SKILL_FS_ROW_RE, () => rowHead + CUSTOM_SKILL_DIRS_BLOCK),
      changed: true,
      form: 'pristine',
    }
  }
  let nextBlock
  if (CUSTOM_SKILL_DIRS_IN_CONFIG_RE.test(configBlock)) {
    nextBlock = configBlock.replace(CUSTOM_SKILL_DIRS_IN_CONFIG_RE, () => CUSTOM_SKILL_DIRS_ENTRY)
  } else {
    nextBlock = configBlock.replace(/(  config:\r?\n)/, (_match, header) => header + CUSTOM_SKILL_DIRS_ENTRY)
  }
  return {
    text: nextBlock === configBlock
      ? compositionText
      : compositionText.replace(SKILL_FS_ROW_RE, () => rowHead + nextBlock),
    changed: nextBlock !== configBlock,
    form: 'patched',
  }
}

/** `preset.yml` written over the copy: pickers show a real name, not a dir. */
export function renderPresetYml(card) {
  return [
    `# Installed by dsh-workbuddy-market (expert: ${card.id}, source plugin: ${card.pluginDir})`,
    `name: ${JSON.stringify(String(card.name ?? card.id))}`,
    `description: ${JSON.stringify(String(card.description ?? ''))}`,
    '',
  ].join('\n')
}

/**
 * The fingerprint's skills slice: one (posixRelativePath, size, mtimeMs)
 * triple per file under every skill directory of the card, straight from the
 * source tree, globally sorted. Skill directories that vanished between scan
 * and install contribute nothing (the copy step reports them). Dotfiles and
 * dot-directories are skipped, matching the scanner's listing conventions.
 * @param {string} skillsRoot - the plugin's absolute skills/ directory
 * @param {string[]} skillNames - the card's skill directory names
 * @returns {Promise<[string, number, number][]>} the sorted manifest rows
 */
export async function skillsManifestOf(skillsRoot, skillNames) {
  const rows = []

  async function walk(dir, prefix) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), relative)
      } else {
        const info = await stat(join(dir, entry.name))
        if (info.isFile()) rows.push([relative, info.size, info.mtimeMs])
      }
    }
  }

  for (const name of [...skillNames].sort()) {
    await walk(join(skillsRoot, name), name)
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return rows
}

/**
 * The install fingerprint: sha256 over the card fields that land in the
 * preset — name + description + persona + the skills manifest rows
 * (decision #8: a frontmatter description tweak flips `updatable` too).
 * The exact serialization (JSON of one object with those four keys) is this
 * module's contract; ticket #6's update detection recomputes it from a
 * fresh scan and compares against the manifest, so it must stay stable.
 * @param {object} card - the scan card
 * @param {[string, number, number][]} skillsRows - skillsManifestOf output
 * @returns {string} hex sha256
 */
export function computeInstallFingerprint(card, skillsRows) {
  return createHash('sha256').update(JSON.stringify({
    name: String(card.name ?? card.id),
    description: String(card.description ?? ''),
    persona: card.persona,
    skills: skillsRows,
  })).digest('hex')
}

/**
 * Read one preset directory's install manifest.
 * @returns {Promise<{ ok: true, manifest: object } | { ok: false, reason: string }>}
 *          missing and corrupt are BOTH !ok — the design's #17 verdict treats
 *          them identically (「清单缺失，请卸载重装」). A manifest without a
 *          usable sourcePath OR fingerprint is just as corrupt: every
 *          manifest this plugin writes carries both, so anything less was
 *          not written by us and must never be guessed from (the update and
 *          updatable paths both rely on the fingerprint existing).
 */
async function readInstallManifest(presetDir) {
  const path = join(presetDir, MANIFEST_FILE)
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    return { ok: false, reason: error.code === 'ENOENT' ? 'file missing' : `unreadable (${errorMessage(error)})` }
  }
  try {
    const manifest = JSON.parse(text)
    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('not a JSON object')
    }
    if (typeof manifest.sourcePath !== 'string' || manifest.sourcePath === '') {
      throw new Error('sourcePath missing')
    }
    if (typeof manifest.fingerprint !== 'string' || manifest.fingerprint === '') {
      throw new Error('fingerprint missing')
    }
    return { ok: true, manifest }
  } catch (error) {
    return { ok: false, reason: `corrupt (${errorMessage(error)})` }
  }
}

/** Two raw source strings name the same source once tilde-expanded and normalized. */
function sameSource(rawA, rawB) {
  return resolve(expandTildePath(rawA)) === resolve(expandTildePath(rawB))
}

/**
 * Re-tighten one path this install ADDS to the preset directory (the skills
 * tree; the manifest gets a plain 0o600) to owner-only, mirroring the
 * roster's own copy tightening — dsh-agent-presets re-tightens the whole
 * copied tree because "the copy carries the same weight as the settings
 * document beside it", and files added afterwards must not loosen that
 * posture. Files keep their owner-execute bit; directories become 0o700.
 */
async function tightenOwnerOnly(path) {
  const info = await stat(path)
  if (info.isDirectory()) {
    await chmod(path, 0o700)
    for (const entry of await readdir(path, { withFileTypes: true })) {
      await tightenOwnerOnly(join(path, entry.name))
    }
  } else {
    await chmod(path, (info.mode & 0o100) === 0 ? 0o600 : 0o700)
  }
}

/**
 * Mirror the source's skill directories into the preset's skills/ directory
 * — the one filesystem writer install AND update share:
 *
 *   - every listed skill directory is re-copied whole (delete-then-copy, so
 *     a file the source dropped INSIDE a surviving directory cannot linger
 *     the way a plain recursive cp-over would let it);
 *   - preset skill directories the source no longer lists are removed;
 *   - a directory that vanished between scan and sync is skipped with a
 *     warning (`action` names the caller in the message);
 *   - dot entries are never touched — what the copy would never write, the
 *     sync never deletes (the scanner/fingerprint visibility symmetry).
 *
 * On a fresh install the deletion pass meets an empty (or missing)
 * directory and is naturally a no-op; on update it is the removal half of
 * the sync. The skills/ directory itself is never removed — an expert that
 * lost its last skill keeps an empty mounted directory (the standing
 * customSkillDirs mount then simply finds no skills).
 * @param {string} skillsRoot - the plugin's absolute skills/ directory in the source
 * @param {string[]} skillNames - the card's (current scan) skill directory names
 * @param {string} presetSkillsDir - the preset's absolute skills/ directory
 * @param {'install' | 'update'} action - message label for vanished skills
 * @param {string[]} warnings - the caller's warnings sink
 */
async function syncSkillDirectories(skillsRoot, skillNames, presetSkillsDir, action, warnings) {
  const wanted = new Set(skillNames)
  let existing = []
  try {
    existing = await readdir(presetSkillsDir, { withFileTypes: true })
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  for (const entry of existing) {
    if (entry.name.startsWith('.')) continue
    if (!wanted.has(entry.name)) {
      await rm(join(presetSkillsDir, entry.name), { recursive: true, force: true })
    }
  }
  let copied = 0
  for (const name of [...skillNames].sort()) {
    try {
      // Existence comes from the directory itself, never from fingerprint
      // rows — an empty or dotfile-only directory syncs verbatim per #15
      // while contributing no rows.
      await stat(join(skillsRoot, name))
    } catch {
      warnings.push(`skill "${name}" missing at ${action} time; skipped`)
      continue
    }
    await rm(join(presetSkillsDir, name), { recursive: true, force: true })
    await cp(join(skillsRoot, name), join(presetSkillsDir, name), {
      recursive: true,
      dereference: true,
    })
    await tightenOwnerOnly(join(presetSkillsDir, name))
    copied += 1
  }
  if (copied > 0) {
    // The parent directory joins the owner-only posture too (its children
    // were just tightened individually; this is the roster's own stance).
    try {
      const info = await stat(presetSkillsDir)
      if (info.isDirectory()) await chmod(presetSkillsDir, 0o700)
    } catch {
      // vanished mid-sync — the sync's own error (if any) is the report
    }
  }
}

/**
 * The card's skills slice of the CURRENT source tree, one shape every
 * skills-touching caller reads (install, update, the state overlay): the
 * card's skill directory names, the plugin's absolute skills/ root, and the
 * fingerprint rows straight from that root. The rows are source-true by
 * construction (#21②) — they never reflect what landed in the preset.
 * @param {string} rawSourcePath - the RAW stored source path (tilde intact, #18)
 * @param {object} card - the scan card
 * @returns {Promise<{ skillNames: string[], skillsRoot: string, rows: [string, number, number][] }>}
 */
async function sourceSkillsSlice(rawSourcePath, card) {
  const skillNames = Array.isArray(card.skills) ? card.skills : []
  const skillsRoot = join(expandTildePath(rawSourcePath), card.pluginDir, 'skills')
  const rows = skillNames.length > 0 ? await skillsManifestOf(skillsRoot, skillNames) : []
  return { skillNames, skillsRoot, rows }
}

/**
 * Write the fingerprint manifest (⑦, identical product from install and
 * update): every persisted field's provenance, owner-only like the rest of
 * what this plugin adds to the preset directory (#21③).
 */
async function writeInstallManifest(presetDir, card, rawSourcePath, fingerprint) {
  const path = join(presetDir, MANIFEST_FILE)
  await writeFile(path, `${JSON.stringify({
    sourcePath: rawSourcePath,
    pluginDir: card.pluginDir,
    agentFile: card.agentFile,
    fingerprint,
    importedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8')
  await chmod(path, 0o600)
}

/**
 * Install one expert card as the user preset `wb-<id>` (the §4 seven steps).
 * The card comes from the CURRENT scan table of the CURRENT source; the
 * route resolves it, this function owns everything after.
 * @param {object} agentPresets - the injected roster service
 * @param {object} card - the scan card (id/pluginDir/agentFile/name/description/persona/skills)
 * @param {string} rawSourcePath - the RAW stored source path (tilde intact, #18)
 * @returns {Promise<{ presetId: string, base: string, warnings: string[], fingerprint: string }>}
 * @throws with the design's exact error wording on the three collision
 *         scenarios (foreign source / manifest missing / base missing)
 */
export async function installWorkbuddyExpert(agentPresets, card, rawSourcePath) {
  if (card === null || typeof card !== 'object' || typeof card.id !== 'string') {
    throw new Error('expert card missing')
  }
  const presetId = PRESET_ID_PREFIX + card.id

  // ① pre-checks against the live roster: existing target, then base.
  const roster = await rosterIndex(agentPresets)
  const existing = roster.get(presetId)
  if (existing !== undefined) {
    if (typeof existing.path !== 'string') {
      throw new Error(`${presetId} 缺少可定位的 preset 目录，无法读取安装清单，请卸载重装`)
    }
    const presetDir = dirname(existing.path)
    const read = await readInstallManifest(presetDir)
    if (!read.ok) {
      throw new Error(`清单缺失，请卸载重装：${join(presetDir, MANIFEST_FILE)} ${read.reason}`)
    }
    if (!sameSource(read.manifest.sourcePath, rawSourcePath)) {
      throw new Error(
        `该专家已从别的源目录安装（已装源：${read.manifest.sourcePath}，当前源：${rawSourcePath}），请先卸载`,
      )
    }
    // Same source, our own product: fall through to a clean remove + re-copy
    // so repeated installs are idempotent (identical products, no misreports).
  }
  if (!roster.has(BASE_PRESET_ID)) {
    throw new Error(`base preset not found: ${BASE_PRESET_ID}`)
  }

  const reinstalling = existing !== undefined
  let copied = false
  try {
    if (reinstalling) {
      // Our own user-trust product from this source; the roster refuses
      // non-user presets on its own, and copy() below never overwrites.
      await agentPresets.remove(presetId)
    }
    await agentPresets.copy(BASE_PRESET_ID, presetId, String(card.name ?? presetId))
    copied = true

    const after = await rosterIndex(agentPresets)
    const entry = after.get(presetId)
    if (entry === undefined || typeof entry.path !== 'string') {
      throw new Error('copy() finished but the roster does not report the new preset')
    }
    const presetDir = dirname(entry.path)
    const compositionPath = entry.path

    // ② metadata: the copy kept the base's description and dropped its name;
    // overwrite both with the card's base fields.
    await writeFile(join(presetDir, 'preset.yml'), renderPresetYml(card), 'utf8')

    // ③⑤ composition patches, computed in memory and written once.
    const warnings = []
    const original = await readFile(compositionPath, 'utf8')
    let composition = original

    const personaPatched = patchPersonaText(composition, card.persona)
    if (personaPatched === null) {
      warnings.push('persona row not found in the copied composition; installed with the base persona')
    } else {
      composition = personaPatched
    }

    let skillsRows = []
    if (Array.isArray(card.skills) && card.skills.length > 0) {
      // The fingerprint slice always reflects the source as scanned — even
      // when mounting degrades below, `updatable` (#6) must stay source-true.
      const slice = await sourceSkillsSlice(rawSourcePath, card)
      skillsRows = slice.rows
      const skillsPatch = patchSkillFilesystemRow(composition)
      if (skillsPatch === null) {
        warnings.push('skills 未挂载：skill-filesystem row not found in the copied composition; skills not copied')
      } else {
        composition = skillsPatch.text
        // ④ mirror every listed skill directory into presetDir/skills/
        // (shared with update; the deletion pass is a no-op on a fresh copy).
        await syncSkillDirectories(
          slice.skillsRoot, [...slice.skillNames], join(presetDir, 'skills'), 'install', warnings,
        )
      }
    }

    if (composition !== original) {
      await writeFile(compositionPath, composition, 'utf8')
    }

    // ⑥ the same standing mount a session joins — a composition that cannot
    // load (our patch included) throws here, never after a success report.
    await agentPresets.standingKeyFor(presetId)

    // ⑦ fingerprint manifest, every persisted field's provenance.
    const fingerprint = computeInstallFingerprint(card, skillsRows)
    await writeInstallManifest(presetDir, card, rawSourcePath, fingerprint)

    return { presetId, base: BASE_PRESET_ID, warnings, fingerprint }
  } catch (error) {
    if (copied) {
      // No half products: the preset we just created goes away again. Best
      // effort — the rethrown install error is the meaningful one.
      try {
        await agentPresets.remove(presetId)
      } catch {
        // ignored
      }
    }
    if (reinstalling) {
      // A reinstall first removed the previous (working) install — a failure
      // from here on cannot bring it back, so the error says so instead of
      // looking like the expert was never installed.
      throw new Error(`${errorMessage(error)}（重装中断：原安装已在重装开始时移除，重新执行安装即可恢复）`)
    }
    throw error
  }
}

/**
 * Classify every roster `wb-<id>` against the CURRENT scan table — the
 * `/api/state` install overlay (ticket #6). One pass, three verdicts:
 *
 *   - same source + card present → flags `{ installed: true, updatable,
 *     broken }` for the card (updatable recomputes the install fingerprint
 *     from the fresh scan — both sides source-true per #21②, so a
 *     frontmatter-description edit flips it (#8) and a touch-only mtime
 *     change flips it too, the disclosed false positive of #18);
 *   - a manifest naming ANOTHER source, or an id the current table lacks →
 *     an `orphans` entry (#9) — reported, never uninstalled;
 *   - a manifest that is missing or corrupt → `broken` + the #17 warning
 *     「清单缺失，请卸载重装」 — on the card when the id is scanned, as an
 *     orphan entry (flagged broken) when it is not, so the install stays
 *     visible and uninstallable either way.
 *
 * A roster-reported broken preset (composition discovery failed) sets the
 * card's `broken` flag too — design §5: `broken` covers roster mount
 * failures AND manifest loss. `updatable` never accompanies `broken`: the
 * fix the warning sells is uninstall + reinstall, not an update.
 *
 * @param {object} agentPresets - the injected roster service
 * @param {string} rawSourcePath - the RAW stored source path (tilde intact, #18)
 * @param {object[]} experts - the current scan table's cards
 * @returns {Promise<{
 *   byId: Map<string, { installed: boolean, updatable: boolean, broken: boolean }>,
 *   orphans: object[],
 *   warnings: string[],
 * }>}
 */
export async function installedMarketState(agentPresets, rawSourcePath, experts) {
  const roster = await rosterIndex(agentPresets)
  const cards = new Map(
    (Array.isArray(experts) ? experts : []).map((expert) => [expert.id, expert]),
  )
  const byId = new Map()
  const orphans = []
  const warnings = []

  for (const entry of roster.values()) {
    if (typeof entry.id !== 'string' || !entry.id.startsWith(PRESET_ID_PREFIX)) continue
    const expertId = entry.id.slice(PRESET_ID_PREFIX.length)
    const card = cards.get(expertId)
    const rosterBroken = typeof entry.broken === 'string' && entry.broken !== ''

    if (typeof entry.path !== 'string') {
      // Cannot even locate the directory, so no manifest to classify by.
      const warning = `${entry.id}：preset 目录不可定位（roster 条目缺少 path），请卸载重装`
      warnings.push(warning)
      if (card === undefined) orphans.push({ id: expertId, presetId: entry.id, broken: true, warning })
      else byId.set(expertId, { installed: true, updatable: false, broken: true })
      continue
    }
    const presetDir = dirname(entry.path)
    const read = await readInstallManifest(presetDir)
    if (!read.ok) {
      const warning = `清单缺失，请卸载重装：${join(presetDir, MANIFEST_FILE)} ${read.reason}`
      warnings.push(warning)
      if (card === undefined) {
        orphans.push({ id: expertId, presetId: entry.id, broken: true, warning })
      } else {
        byId.set(expertId, { installed: true, updatable: false, broken: true })
      }
      continue
    }
    const manifest = read.manifest
    if (!sameSource(manifest.sourcePath, rawSourcePath) || card === undefined) {
      // #9: installed from another source, or its expert left this source —
      // reported as an orphan with full provenance, never touched.
      orphans.push({
        id: expertId,
        presetId: entry.id,
        name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : entry.id,
        sourcePath: manifest.sourcePath,
        pluginDir: manifest.pluginDir,
        agentFile: manifest.agentFile,
        importedAt: manifest.importedAt,
        broken: rosterBroken,
      })
      continue
    }
    if (rosterBroken) {
      // The roster itself cannot mount this composition — broken like #17,
      // with the roster's own reason surfaced.
      warnings.push(`${entry.id}：preset 无法挂载（${entry.broken}）`)
      byId.set(expertId, { installed: true, updatable: false, broken: true })
      continue
    }
    // The updatable comparison walks the CURRENT source tree for the skills
    // rows (the scanner collects names only). A source that cannot be read
    // here degrades to a warning, exactly the scanner's own per-plugin
    // philosophy — one unreadable skills directory never 500s the whole
    // state; the flag simply stays unset until the read succeeds.
    try {
      const { rows } = await sourceSkillsSlice(rawSourcePath, card)
      byId.set(expertId, {
        installed: true,
        updatable: manifest.fingerprint !== computeInstallFingerprint(card, rows),
        broken: false,
      })
    } catch (error) {
      warnings.push(`${entry.id}：无法读取源 skills 目录，跳过更新比对（${errorMessage(error)}）`)
      byId.set(expertId, { installed: true, updatable: false, broken: false })
    }
  }
  return { byId, orphans, warnings }
}

/**
 * Update one installed expert in place (ticket #6): re-stamp the preset
 * directory from the CURRENT scan card — preset.yml rewritten, persona and
 * skill-filesystem rows re-patched (both idempotent), skills directories
 * re-mirrored including the DELETION of directories the source no longer
 * lists, manifest refreshed, mount re-validated. Never copy()/remove(): the
 * roster entry and the directory itself are untouched, only their contents
 * converge on the new scan.
 *
 * Only our own user-trust product of THIS source is ever rewritten: the
 * checks mirror install's (not installed → clear error; trust ≠ user →
 * refused; manifest missing/corrupt → the #17 error; foreign source → the
 * #9 error).
 *
 * @param {object} agentPresets - the injected roster service
 * @param {object} card - the CURRENT scan card for the expert
 * @param {string} rawSourcePath - the RAW stored source path (tilde intact, #18)
 * @returns {Promise<{ presetId: string, base: string, warnings: string[], fingerprint: string }>}
 */
export async function updateWorkbuddyExpert(agentPresets, card, rawSourcePath) {
  if (card === null || typeof card !== 'object' || typeof card.id !== 'string') {
    throw new Error('expert card missing')
  }
  const presetId = PRESET_ID_PREFIX + card.id

  const roster = await rosterIndex(agentPresets)
  const entry = roster.get(presetId)
  if (entry === undefined) {
    throw new Error(`未安装：${presetId} 不在 preset roster 中，请先安装再更新`)
  }
  if (entry.trust !== undefined && entry.trust !== 'user') {
    throw new Error(`拒绝更新：${presetId} 非用户信任条目（trust: ${entry.trust}），市场只能就地重打它自己安装的 preset`)
  }
  if (typeof entry.path !== 'string') {
    throw new Error(`${presetId} 缺少可定位的 preset 目录，无法读取安装清单，请卸载重装`)
  }
  const presetDir = dirname(entry.path)
  const read = await readInstallManifest(presetDir)
  if (!read.ok) {
    throw new Error(`清单缺失，请卸载重装：${join(presetDir, MANIFEST_FILE)} ${read.reason}`)
  }
  if (!sameSource(read.manifest.sourcePath, rawSourcePath)) {
    throw new Error(
      `该专家已从别的源目录安装（已装源：${read.manifest.sourcePath}，当前源：${rawSourcePath}），请先卸载`,
    )
  }

  const compositionPath = entry.path
  const warnings = []
  // The fingerprint slice is source-true even when mounting degrades (#21②)
  // — computed BEFORE any patch decision, exactly like install.
  const { skillNames, skillsRoot, rows: skillsRows } = await sourceSkillsSlice(rawSourcePath, card)

  // Patch the composition in memory first: an anchor miss degrades to a
  // warning instead of ever writing a half-patched file.
  const original = await readFile(compositionPath, 'utf8')
  let composition = original
  const personaPatched = patchPersonaText(composition, card.persona)
  if (personaPatched === null) {
    warnings.push('persona row not found in the preset composition; the previously installed persona stays')
  } else {
    composition = personaPatched
  }
  let skillsMounted = false
  if (skillNames.length > 0) {
    const skillsPatch = patchSkillFilesystemRow(composition)
    if (skillsPatch === null) {
      warnings.push('skills 未挂载：skill-filesystem row not found in the preset composition; skills not synced')
    } else {
      composition = skillsPatch.text
      skillsMounted = true
    }
  }

  // No-half-update safety net: preset.yml and the composition are restored
  // from their in-memory originals when anything after their writes fails —
  // including REMOVING a preset.yml that did not exist before — so a failed
  // update leaves the preset as loadable as it was found. (The skills tree
  // has no cheap snapshot; a mid-sync failure there can leave it partially
  // mirrored — the next update re-mirrors it whole, and the updatable
  // comparison stays source-true either way.)
  const ymlPath = join(presetDir, 'preset.yml')
  const ymlExisted = await stat(ymlPath).then(() => true, () => false)
  const originalYml = ymlExisted ? await readFile(ymlPath, 'utf8') : null
  let wroteYml = false
  let wroteComposition = false
  try {
    await writeFile(ymlPath, renderPresetYml(card), 'utf8')
    wroteYml = true

    // Skills sync: the full mirror when the row mounted, or a pure cleanup
    // pass when the card carries no skills anymore (directories the source
    // dropped are removed either way; the mounted skills/ directory itself
    // survives empty rather than dangling the mount on a missing path).
    if (skillsMounted || skillNames.length === 0) {
      await syncSkillDirectories(skillsRoot, [...skillNames], join(presetDir, 'skills'), 'update', warnings)
    }

    if (composition !== original) {
      await writeFile(compositionPath, composition, 'utf8')
      wroteComposition = true
    }

    // The same standing mount a session joins — a re-stamped composition
    // that cannot load throws here, never after a success report.
    await agentPresets.standingKeyFor(presetId)

    const fingerprint = computeInstallFingerprint(card, skillsRows)
    await writeInstallManifest(presetDir, card, rawSourcePath, fingerprint)

    return { presetId, base: BASE_PRESET_ID, warnings, fingerprint }
  } catch (error) {
    const cause = errorMessage(error)
    try {
      if (wroteYml) {
        if (originalYml !== null) await writeFile(ymlPath, originalYml, 'utf8')
        else await rm(ymlPath, { force: true })
      }
      if (wroteComposition) await writeFile(compositionPath, original, 'utf8')
    } catch {
      // best effort — the rethrown cause is the meaningful report
    }
    throw new Error(`${cause}（更新中断：preset.yml 与组合文件已尽量恢复更新前内容，请重试或卸载重装）`)
  }
}

/**
 * Remove one installed expert's preset — the whole roster entry: the preset
 * directory, its skills tree, and the manifest go together (ticket #6).
 * Refuses anything not `trust: "user"`, exactly the sister plugin's gate: a
 * deployment-owned preset is never deleted by this market. Works for
 * ORPHANS too — the roster is the only authority consulted, so an expert
 * whose id the current scan table lacks (a switched-away source) still
 * uninstalls, which is the designed cleanup path for #9.
 * @param {object} agentPresets - the injected roster service
 * @param {string} expertId - the expert id (the `wb-` prefix is ours to add)
 * @returns {Promise<{ presetId: string }>}
 */
export async function uninstallWorkbuddyExpert(agentPresets, expertId) {
  const presetId = PRESET_ID_PREFIX + expertId
  const roster = await rosterIndex(agentPresets)
  const entry = roster.get(presetId)
  if (entry === undefined) {
    throw new Error(`未安装：${presetId} 不在 preset roster 中`)
  }
  if (entry.trust !== undefined && entry.trust !== 'user') {
    throw new Error(`拒绝卸载：${presetId} 非用户信任条目（trust: ${entry.trust}），市场只能卸载它自己安装的 preset`)
  }
  await agentPresets.remove(presetId)
  return { presetId }
}
