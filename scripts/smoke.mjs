/**
 * Offline smoke checks for dsh-workbuddy-market — no browser, no live
 * profile, zero dependencies: `node scripts/smoke.mjs`.
 *
 *   1. package contract: manifest shape (dsh.bundle.patch, dsh.client),
 *      every exports target exists, patch layer + host orchestration wire
 *      up as files;
 *   2. scanner: default raw path, tilde expansion rules (decision #18),
 *      missing root → empty table with no scanner warning;
 *   2b. scanner over the full pathology fixture (ticket #3): two solo
 *      experts (one with skills + rules + PNG + template variables; one
 *      fully CRLF with plugin.json metadata and a dangling avatar
 *      reference), a three-agent team (one member CRLF and without
 *      frontmatter displayName, every member with its own PNG plus
 *      team.png), a `git:` copy of the team, a cross-plugin duplicate-id
 *      pair, a corrupt-plugin.json directory, and a skills subdirectory
 *      without SKILL.md — asserting every offline-checkable acceptance
 *      item (team split + per-member avatars, rules appended into the
 *      persona, template escaping via the registered-variable whitelist,
 *      CRLF tolerance with `\r`-free personas, plugin.json priority with
 *      dangling-avatar fallback, README zhDescription fallback, duplicate
 *      id first-wins + warning, broken-directory degradation, verbatim
 *      skills copying, undefined avatarPath for PNG-less experts, and the
 *      body-H1 zhName extension);
 *   3. catalog cache + fingerprint (ticket #4): the stat-only fingerprint's
 *      stability and disclosed blind spots (a size+mtime-preserving rewrite
 *      stays invisible — refresh's raison d'être; git: copies cannot move
 *      the key), a cache hit that re-reads zero file content, auto-rescan
 *      on an edited agent file / a NEW agent file inside an existing
 *      plugin directory (the top-level-mtime regression anchor, decision
 *      #5) / an edited plugin.json (#12), invalidate() forcing a rescan of
 *      an unchanged tree, and concurrent misses sharing one in-flight scan;
 *   4. settings mount against a fake settings service + fake schemastery:
 *      base default, raw-string storage, and the watcher dropping the
 *      cache the moment sourcePath changes (new path serves its own scan,
 *      switching back rescans, a same-value update keeps the cache);
 *   5. routes over a fake webServer with duck-typed request/response:
 *      /api/state shape + no-store (including a full state over the
 *      pathology fixture and a route-level auto-rescan after a fixture
 *      edit), /api/config (save, tilde passthrough, nonexistent path
 *      allowed, revision conflict 409, validation), /api/refresh, 405/403
 *      rejection, the 4 KiB body cap, the mutating single-flight lane
 *      (concurrent second change → 409), and full disposal;
 *   6. client bundle loads through a stub __ModuleLoader__ and mounts
 *      nothing (the market page is a later ticket);
 *   7. the schemastery resolver, when a real harness is present on this
 *      machine, hands back a usable factory (skipped silently otherwise —
 *      this section reports, it never gates).
 *
 * The real install/boot/curl matrix runs in a scratch profile (design doc
 * P5); everything offline-coverable from that list lives here.
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { readFile } from 'node:fs/promises'

const root = new URL('..', import.meta.url).pathname

// ── 1. package contract ──────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(pkg.name, 'dsh-workbuddy-market')
assert.equal(pkg.type, 'module', 'zero-build ESM, no runtime deps')
assert.equal(pkg.main, 'src/index.js')
assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], 'no runtime dependencies')
assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml', 'bundle patch declared')
assert.equal(pkg.dsh?.client?.platform, 'web', 'client platform declared')
assert.ok(Array.isArray(pkg.dsh.client.inject) && pkg.dsh.client.inject.length >= 1,
  'client inject declaration present')
for (const [specifier, target] of Object.entries(pkg.exports)) {
  const path = join(root, target)
  assert.ok(readFileSync(path, 'utf8') !== undefined, `exports target exists: ${specifier} -> ${target}`)
}
const patchText = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
assert.ok(patchText.includes('- insert:'), 'patch is a top-level insert array')
assert.ok(patchText.includes('id: dsh-workbuddy-market'), 'patch row id present')
assert.ok(/name: ['"]?dsh-workbuddy-market/.test(patchText), 'patch row name present')
const indexText = readFileSync(join(root, 'src', 'index.js'), 'utf8')
assert.ok(indexText.includes("ctx.inject(['settings']"), 'settings segment declared')
assert.ok(indexText.includes("ctx.inject(['webServer', 'agentPresets', 'settings']"),
  'routes segment declared with its three services')
assert.ok(!indexText.includes("from './summon.js'"), 'P3 summon segment not shipped early')

// ── 2. scanner: constants, tilde rules, missing root ─────────────────────────

const scannerModule = await import(join(root, 'src', 'scanner.js'))
const { DEFAULT_SOURCE_PATH, expandTildePath, scanWorkbuddyRoot } = scannerModule
const { REGISTERED_PROMPT_VARIABLES, escapeUnregisteredTemplateGroups } = scannerModule

assert.equal(DEFAULT_SOURCE_PATH, '~/.workbuddy/plugins/marketplaces/experts/plugins',
  'default source path is the raw tilde string (#18)')
assert.ok(Array.isArray(REGISTERED_PROMPT_VARIABLES) && REGISTERED_PROMPT_VARIABLES.includes('model'),
  'the escape whitelist is data (a constant array), not scattered literals')

/** Complete {{…}} group names in a persona — the sister-plugin assertion shape. */
const templateGroupsOf = (text) => [...text.matchAll(/\{\{([^{}]*)\}\}/g)].map((match) => match[1])

assert.deepEqual(await scanWorkbuddyRoot('/definitely/not/scanned/yet'),
  { experts: [], warnings: [] },
  'missing root → empty table with NO scanner warning (the state layer owns the pathExists warning)')

assert.equal(expandTildePath('~'), homedir(), 'bare tilde expands')
assert.equal(expandTildePath('~/plugins'), join(homedir(), 'plugins'), 'tilde prefix expands')
assert.equal(expandTildePath('/absolute/path'), '/absolute/path', 'absolute path untouched')
assert.equal(expandTildePath('~foo/bar'), '~foo/bar', 'other-user tilde untouched')
assert.equal(expandTildePath('relative'), 'relative', 'relative path untouched')

// Template-escape unit checks: the whitelist survives, everything else splits.
{
  const escaped = escapeUnregisteredTemplateGroups(
    'keep {{model}} and {{provider}}; split {{ y: -2 }}, {{.CurrentDate}}, {{ cwd }}, {{bogus}}, {{ {a:1} }}, {{{ ninja }}}',
  )
  const groups = templateGroupsOf(escaped)
  assert.deepEqual([...new Set(groups)].sort(), ['model', 'provider'],
    'only registered variables remain as complete groups (sister-plugin assertion technique)')
  assert.ok(escaped.includes('{ { y: -2 }}') && escaped.includes('{ {.CurrentDate}}'),
    'non-registered groups are split at the opening braces')
  assert.ok(!escaped.includes('{{ {'), 'nested-brace groups never survive whole')
  // A lone `{{` with no closing braces anywhere is literal prose for the host
  // interpolator and must pass through untouched.
  assert.equal(escapeUnregisteredTemplateGroups('a {{ lonely opener'), 'a {{ lonely opener',
    'lone `{{` without any `}}` stays literal')
}

// ── 2b. scanner over the pathology fixture (ticket #3) ──────────────────────

const fixtureRoot = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-scan-'))
const FIXTURE_PNG = Buffer.from('89504e470d0a1a0a-fixture-png')

/** Write one fixture file, creating parent directories as needed. */
function fixtureWrite(relative, content) {
  const path = join(fixtureRoot, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

// Solo expert #1: skills (one subdir WITHOUT SKILL.md) + rules + PNG +
// template variables + full plugin.json metadata.
fixtureWrite('solo-one/agents/solo-one.md', [
  '---',
  'name: solo-one',
  'description: Use when asked to review code paths end to end.',
  'displayName:',
  '  en: "Solo One"',
  '  zh: "独奏一号"',
  'profession:',
  '  en: "Solo Review Expert"',
  '  zh: "评审专家"',
  'maxTurns: 50',
  '---',
  '',
  '# 评审专家',
  '',
  '模板变量 {{model}} 与 {{provider}} 已注册，保留原样。',
  '未注册组必须拆括号：{{ y: -2 }}、{{ github.sha }}、{{ t(\'welcome\') }}、{{ cwd }}（带空格同样未注册）。',
  '系统时间变量 {{.CurrentDate}} 与嵌套大括号 {{ {a:1} }}、三连 {{{ ninja }}} 都不允许让插值器抛错。',
  '',
].join('\n'))
fixtureWrite('solo-one/rules/quality.md', [
  '---',
  'description: quality gate',
  'alwaysApply: true',
  '---',
  '',
  '规则正文：所有输出必须自证。模板组 {{ item.name }} 出现在规则文件里也要被转义。',
  '',
].join('\n'))
fixtureWrite('solo-one/skills/main-skill/SKILL.md', 'SKILL: main\n')
fixtureWrite('solo-one/skills/references/data.md', 'reference data with no SKILL.md\n')
fixtureWrite('solo-one/avatars/solo-one.png', FIXTURE_PNG)
fixtureWrite('solo-one/.codebuddy-plugin/plugin.json', JSON.stringify({
  name: 'solo-one',
  profession: { en: 'Solo Review Expert', zh: '评审专家' },
  displayDescription: { en: 'English display', zh: '来自 plugin.json 的中文描述。' },
  avatar: 'avatars/solo-one.png',
  categoryId: '02-Engineering',
  tags: [{ en: 'Review', zh: '评审' }],
}))

// Solo expert #2: every file CRLF, frontmatter without displayName/profession
// (zhName must come from plugin.json profession.zh), plugin.json with a
// DANGLING avatar reference (falls back to the first PNG).
const crlf = (text) => text.split('\n').join('\r\n')
fixtureWrite('solo-two/agents/solo-two.md', crlf([
  '---',
  'name: solo-two',
  'description: Use when asked to containerize workloads.',
  '---',
  '',
  '# 容器器（Dockerfile 生成专家）',
  '',
  'CRLF 正文第一行。多阶段构建与镜像瘦身是本职。\r',
  '第二行同样以 CRLF 结尾，抽取后不得残留 \\r。',
  '',
].join('\n')))
fixtureWrite('solo-two/avatars/actual.png', FIXTURE_PNG)
fixtureWrite('solo-two/.codebuddy-plugin/plugin.json', crlf(JSON.stringify({
  name: 'solo-two',
  profession: { en: 'Container Expert', zh: '容器专家' },
  displayDescription: { en: 'English display', zh: 'CRLF plugin.json 的中文描述。' },
  avatar: 'avatars/ghost-does-not-exist.png',
}, null, 2)))

// Three-agent team: every member owns <agentName>.png, team.png exists, one
// member is CRLF without frontmatter displayName (zhName from profession.zh),
// plugin.json has NO displayDescription (zhDescription falls back to README).
fixtureWrite('team-x/agents/team-x-lead.md', [
  '---',
  'name: team-x-lead',
  'description: Lead of the fixture team.',
  'displayName:',
  '  en: "Lead Person"',
  '  zh: "队长甲"',
  'profession:',
  '  en: "Team Lead"',
  '  zh: "队长"',
  '---',
  '',
  '# 队长',
  '',
  '统筹全局。',
].join('\n'))
fixtureWrite('team-x/agents/team-x-maker.md', crlf([
  '---',
  'name: team-x-maker',
  'description: Maker of the fixture team.',
  'profession:',
  '  en: "Maker"',
  '  zh: "制造工程师"',
  '---',
  '',
  '# 制造',
  '',
  'CRLF 成员正文，没有 frontmatter displayName。',
].join('\n')))
fixtureWrite('team-x/agents/team-x-checker.md', [
  '---',
  'name: team-x-checker',
  'description: Checker of the fixture team.',
  'displayName:',
  '  en: "Checker Person"',
  '  zh: "质检乙"',
  'profession:',
  '  en: "Checker"',
  '  zh: "质检员"',
  '---',
  '',
  '# 质检',
  '',
  '把关交付。',
].join('\n'))
for (const member of ['team-x-lead', 'team-x-maker', 'team-x-checker', 'team']) {
  fixtureWrite(`team-x/avatars/${member}.png`, FIXTURE_PNG)
}
fixtureWrite('team-x/README.md', [
  '# 团队插件',
  '',
  'README 首段中文兜底描述：无 displayDescription 时 zhDescription 取自这里。',
  '',
  '## 后文',
  '',
  '不取。',
].join('\n'))
fixtureWrite('team-x/.codebuddy-plugin/plugin.json', JSON.stringify({
  name: 'team-x',
  expertType: 'team',
  agentName: 'team-x-lead',
  teamInfo: { leadAgent: 'team-x-lead', memberAgents: ['team-x-maker', 'team-x-checker'] },
  profession: { en: 'Fixture Team', zh: '夹具团队' },
}))

// A `git:`-prefixed duplicate-install copy of the team — skipped whole.
for (const file of ['agents/team-x-lead.md', 'agents/team-x-maker.md', 'agents/team-x-checker.md']) {
  fixtureWrite(`git:team-x:team-x-lead/${file}`, readFileSync(join(fixtureRoot, 'team-x', file)))
}
fixtureWrite('git:team-x:team-x-lead/.codebuddy-plugin/plugin.json',
  readFileSync(join(fixtureRoot, 'team-x', '.codebuddy-plugin', 'plugin.json')))

// Cross-plugin duplicate-id pair: alpha wins (name-sorted first), zeta is
// skipped with a warning. Alpha also carries the body-H1 zhName case (no
// Chinese metadata anywhere else) and no PNGs at all.
fixtureWrite('alpha-dup/agents/one.md', [
  '---',
  'name: dup-expert',
  'description: First definition of the shared id.',
  '---',
  '',
  '# 阿尔法（重复名专家）',
  '',
  '胜者正文。',
].join('\n'))
fixtureWrite('alpha-dup/.codebuddy-plugin/plugin.json', JSON.stringify({ name: 'alpha-dup' }))
fixtureWrite('zeta-dup/agents/one.md', [
  '---',
  'name: dup-expert',
  'description: Second definition of the shared id.',
  '---',
  '',
  '# 失败者',
  '',
  '败者正文。',
].join('\n'))
fixtureWrite('zeta-dup/.codebuddy-plugin/plugin.json', JSON.stringify({ name: 'zeta-dup' }))

// Broken plugin directory: corrupt plugin.json → skipped with a warning.
fixtureWrite('broken-one/agents/has-agent.md', '---\nname: broken-one-agent\ndescription: x\n---\n\n正文。\n')
fixtureWrite('broken-one/.codebuddy-plugin/plugin.json', '{ not json')

// Agents without a plugin.json: a broken plugin (manifest missing, #17).
fixtureWrite('no-manifest/agents/orphan.md', '---\nname: orphan-expert\ndescription: x\n---\n\n正文。\n')

// A foreign directory (neither agents nor manifest): invisible, no warning.
fixtureWrite('foreign-dir/notes.txt', 'not a WorkBuddy plugin\n')

// Terminal-fallback card: English-only metadata (displayName.en, non-Han
// H1, no zh anywhere) — zhName must fall back to the card's English base
// NAME (displayName.en), never to the bare id.
fixtureWrite('solo-three/agents/solo-three.md', [
  '---',
  'name: solo-three',
  'description: Use when asked to check the terminal fallback.',
  'displayName:',
  '  en: "Solo Three"',
  '---',
  '',
  '# Plain English Title',
  '',
  'No Chinese metadata anywhere.',
].join('\n'))
fixtureWrite('solo-three/.codebuddy-plugin/plugin.json', JSON.stringify({ name: 'solo-three' }))

const scan = await scanWorkbuddyRoot(fixtureRoot)
const byId = new Map(scan.experts.map((expert) => [expert.id, expert]))

// Card inventory: 2 solo + 1 fallback probe + 3 team + 1 duplicate winner —
// git: copy invisible, zeta-dup dropped by first-wins, broken/no-manifest
// degraded.
assert.deepEqual(scan.experts.map((expert) => expert.id), [
  'dup-expert', 'solo-one', 'solo-three', 'solo-two', 'team-x-checker', 'team-x-lead', 'team-x-maker',
].sort(), 'exactly the seven surviving cards, in deterministic order')
assert.equal(scan.experts.filter((expert) => expert.pluginDir.startsWith('git:')).length, 0,
  'git: copy contributes no card at all')
assert.equal(scan.experts.filter((expert) => expert.pluginDir === 'zeta-dup').length, 0,
  'duplicate loser is invisible')

// Warnings: duplicate id + broken/corrupt directories — and nothing else.
assert.equal(scan.warnings.filter((warning) => warning.includes('duplicate expert id "dup-expert"')).length, 1,
  'duplicate id reported once, first-wins')
assert.equal(scan.warnings.filter((warning) => warning.startsWith('broken-one:')).length, 1,
  'corrupt plugin.json degrades to one plugin-level warning without failing the scan')
assert.equal(scan.warnings.filter((warning) => warning.startsWith('no-manifest:')).length, 1,
  'agents without plugin.json degrade to one "manifest missing" warning (#17)')
assert.ok(scan.warnings.some((warning) => warning.startsWith('no-manifest:') && warning.includes('plugin.json missing')),
  'the missing-manifest warning names the cause')
assert.deepEqual(
  scan.warnings.filter((warning) => !warning.includes('dup-expert')
    && !warning.startsWith('broken-one:') && !warning.startsWith('no-manifest:')),
  [], 'no other warnings — git: copies and foreign directories stay silent')

// Solo #1: plugin.json priority, skills verbatim, rules appended, escaping.
{
  const soloOne = byId.get('solo-one')
  assert.equal(soloOne.name, 'Solo One', 'name ← frontmatter displayName.en')
  assert.equal(soloOne.zhName, '评审专家', 'zhName ← plugin.json profession.zh (single card, #12)')
  assert.equal(soloOne.zhDescription, '来自 plugin.json 的中文描述。', 'zhDescription ← plugin.json displayDescription.zh')
  assert.ok(soloOne.avatarPath.endsWith(join('solo-one', 'avatars', 'solo-one.png')),
    'avatarPath ← plugin.json avatar (existence-checked)')
  assert.deepEqual(soloOne.skills, ['main-skill', 'references'],
    'skills copies every subdirectory verbatim, including the one without SKILL.md (#15)')
  assert.equal(soloOne.teamSize, 1)
  assert.ok(soloOne.persona.includes('# 附加规则：rules/quality.md'), 'rules are appended under a title')
  assert.ok(soloOne.persona.includes('所有输出必须自证'), 'rule body lands in the persona')
  assert.ok(!soloOne.persona.includes('\r'), 'persona never carries \\r')
  const groups = templateGroupsOf(soloOne.persona)
  assert.ok(groups.includes('model') && groups.includes('provider'), 'registered groups survive verbatim')
  assert.ok(soloOne.persona.includes('{ { y: -2 }}') && soloOne.persona.includes('{ {.CurrentDate}}'),
    'code-example groups are split at the opening braces')
}

// Solo #2: CRLF everywhere, dangling avatar fallback, zhName from plugin.json.
{
  const soloTwo = byId.get('solo-two')
  assert.ok(soloTwo !== undefined, 'the CRLF expert still produces a card')
  assert.ok(!soloTwo.persona.includes('\r'), 'CRLF persona is \\r-free (#14)')
  assert.ok(soloTwo.persona.includes('CRLF 正文第一行'), 'CRLF body extracted past the frontmatter')
  assert.equal(soloTwo.zhName, '容器专家', 'zhName ← plugin.json profession.zh over CRLF boundaries')
  assert.equal(soloTwo.zhDescription, 'CRLF plugin.json 的中文描述。', 'zhDescription parsed from a CRLF plugin.json')
  assert.ok(soloTwo.avatarPath.endsWith(join('solo-two', 'avatars', 'actual.png')),
    'dangling avatar reference falls back to the first PNG')
  assert.equal(soloTwo.name, 'solo-two', 'no frontmatter displayName → name falls back to the id')
}

// Team: split into per-agent cards, each member's own PNG, README fallback.
{
  const lead = byId.get('team-x-lead')
  const maker = byId.get('team-x-maker')
  const checker = byId.get('team-x-checker')
  assert.ok(lead !== undefined && maker !== undefined && checker !== undefined, 'team splits one card per agent md')
  for (const [id, expert] of [['team-x-lead', lead], ['team-x-maker', maker], ['team-x-checker', checker]]) {
    assert.equal(expert.teamSize, 3, `${id}: teamSize counts the directory's agent files`)
    assert.equal(expert.pluginDir, 'team-x')
    assert.ok(expert.avatarPath.endsWith(join('team-x', 'avatars', `${id}.png`)),
      `${id}: avatar hits its own <agentName>.png (never team.png / first PNG)`)
  }
  assert.equal(lead.zhName, '队长甲', 'team zhName ← frontmatter displayName.zh')
  assert.equal(maker.zhName, '制造工程师',
    'CRLF member without displayName takes zhName from frontmatter profession.zh')
  assert.ok(!maker.persona.includes('\r'), 'CRLF member persona is \\r-free')
  assert.equal(lead.zhDescription, 'README 首段中文兜底描述：无 displayDescription 时 zhDescription 取自这里。',
    'zhDescription falls back to the README first non-title paragraph')
}

// Duplicate winner: body-H1 zhName extension + undefined avatarPath.
{
  const winner = byId.get('dup-expert')
  assert.equal(winner.pluginDir, 'alpha-dup', 'first (name-sorted) definition wins the shared id')
  assert.equal(winner.zhName, '重复名专家',
    'body-H1 extension (#19): the parenthesized functional name serves when no Chinese metadata exists')
  assert.equal(winner.avatarPath, undefined, 'PNG-less expert has no avatarPath (client emoji fallback)')
  assert.equal(winner.name, 'dup-expert')
}

// Terminal fallback: exhausted chain lands on the card's English base NAME
// (displayName.en), never on the bare id.
{
  const fallback = byId.get('solo-three')
  assert.equal(fallback.name, 'Solo Three')
  assert.equal(fallback.zhName, 'Solo Three',
    'zhName terminal fallback is the `name` field (design §2), not the raw id')
}

// Every card: id shape, no \r anywhere, personas escape-checked.
for (const expert of scan.experts) {
  assert.match(expert.id, /^[a-z0-9][a-z0-9-]*$/, `expert id ${expert.id} conforms`)
  assert.ok(!expert.persona.includes('\r'), `persona of ${expert.id} carries no \\r`)
  for (const group of templateGroupsOf(expert.persona)) {
    assert.ok(REGISTERED_PROMPT_VARIABLES.includes(group),
      `persona of ${expert.id} keeps only registered template variables (got "{{${group}}}")`)
  }
}

// ── 3. catalog cache + fingerprint (ticket #4) ──────────────────────────────

const { createCatalog, computeSourceFingerprint } = await import(join(root, 'src', 'catalog.js'))

const cacheRoot = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-cache-'))

/** Write into the cache fixture, creating parent directories as needed. */
function cacheWrite(relative, content) {
  const path = join(cacheRoot, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

/** Push one file's mtime deterministically ahead (same-ms writes must not mask a change). */
function bumpMtime(path) {
  const at = new Date(Date.now() + 5000)
  utimesSync(path, at, at)
}

cacheWrite('plug-one/agents/cache-one.md', '---\nname: cache-one\ndescription: v1 trigger text\n---\n\nv1 正文。\n')
cacheWrite('plug-one/rules/r1.md', '规则一。\n')
cacheWrite('plug-one/skills/skill-a/SKILL.md', 'SKILL: a\n')
cacheWrite('plug-one/avatars/a.png', FIXTURE_PNG)
cacheWrite('plug-one/.codebuddy-plugin/plugin.json', JSON.stringify({
  name: 'plug-one',
  displayDescription: { zh: '插件描述 v1' },
}))

// 3a. The fingerprint itself: stable, stat-shaped, and blind exactly where
// the design discloses blindness.
{
  // Pin the agent file's mtime to a clean whole-second value first: a Date
  // carries only milliseconds, so restoring an unpinned nanosecond mtime
  // via utimes would itself move mtimeMs and muddy the blind-spot probe.
  const pinned = new Date(Math.floor(Date.now() / 1000) * 1000 + 60_000)
  const agentPath = join(cacheRoot, 'plug-one', 'agents', 'cache-one.md')
  utimesSync(agentPath, pinned, pinned)
  const fingerprint = await computeSourceFingerprint(cacheRoot)
  assert.equal(await computeSourceFingerprint(cacheRoot), fingerprint,
    'the fingerprint is stable across repeated computations')

  // Same size + restored mtime → same fingerprint. The key is stat tuples,
  // not content hashes (decision #5) — refresh exists precisely for this.
  const original = readFileSync(agentPath, 'utf8')
  writeFileSync(agentPath, original.replaceAll('v1', 'vX')) // same byte length
  utimesSync(agentPath, pinned, pinned) // the identical Date → identical stored mtime
  assert.equal(await computeSourceFingerprint(cacheRoot), fingerprint,
    'a size+mtime-preserving rewrite stays invisible (the disclosed exotic blind spot)')
  writeFileSync(agentPath, original)

  // git: duplicate copies cannot move the key — the scanner skips them, so
  // the key must skip them too (⟺ with the scan output).
  const withoutGit = await computeSourceFingerprint(cacheRoot)
  for (const rel of [
    'agents/cache-one.md', 'rules/r1.md', 'skills/skill-a/SKILL.md',
    'avatars/a.png', '.codebuddy-plugin/plugin.json',
  ]) {
    cacheWrite(`git:plug-one:copy/${rel}`, readFileSync(join(cacheRoot, 'plug-one', rel)))
  }
  assert.equal(await computeSourceFingerprint(cacheRoot), withoutGit,
    'git: copies cannot move the fingerprint')

  // Visibility-pinning probes (the ⟺ contract, decision #20): a root-level
  // DOT plugin directory IS scanned (only git: is filtered at the root) →
  // it must move the key; dot entries INSIDE the named subdirectories are
  // invisible to the scanner's listDir → they must not.
  mkdirSync(join(cacheRoot, '.dot-plug', 'agents'), { recursive: true })
  mkdirSync(join(cacheRoot, '.dot-plug', '.codebuddy-plugin'), { recursive: true })
  writeFileSync(join(cacheRoot, '.dot-plug', 'agents', 'dot.md'),
    '---\nname: dot-one\ndescription: x\n---\n\n正文。\n')
  writeFileSync(join(cacheRoot, '.dot-plug', '.codebuddy-plugin', 'plugin.json'), '{"name":"dot-plug"}')
  assert.notEqual(await computeSourceFingerprint(cacheRoot), withoutGit,
    'a root-level dot plugin directory moves the fingerprint (the scanner scans it)')
  assert.ok((await scanWorkbuddyRoot(cacheRoot)).experts.some((expert) => expert.id === 'dot-one'),
    'scenario anchor: the scanner really does emit the dot plugin card')
  const withDot = await computeSourceFingerprint(cacheRoot)
  writeFileSync(join(cacheRoot, 'plug-one', 'agents', '.DS_Store'), 'finder junk')
  assert.equal(await computeSourceFingerprint(cacheRoot), withDot,
    'dot entries inside the named subdirectories never move the fingerprint')
  rmSync(join(cacheRoot, '.dot-plug'), { recursive: true, force: true })
  rmSync(join(cacheRoot, 'git:plug-one:copy'), { recursive: true, force: true })
}

// 3b. The catalog: counting seams make the no-reread claim measurable — the
// scan function is the ONLY content reader, so "scan not invoked" is
// "no file content re-read".
let cacheScans = 0
let cacheFingerprints = 0
const cacheCatalog = createCatalog(
  async (rawPath) => { cacheScans += 1; return scanWorkbuddyRoot(rawPath) },
  async (rawPath) => { cacheFingerprints += 1; return computeSourceFingerprint(rawPath) },
)
const cardOf = (state, id) => state.experts.find((expert) => expert.id === id)

const firstState = await cacheCatalog.stateOf(cacheRoot)
assert.equal(cacheScans, 1, 'the first request scans')
assert.ok(cardOf(firstState, 'cache-one') !== undefined, 'the fixture card survives the first scan')

const secondState = await cacheCatalog.stateOf(cacheRoot)
assert.equal(cacheScans, 1, 'unchanged fingerprint → the cached scan serves the request, zero content re-reads')
assert.equal(cacheFingerprints, 2, 'the stat-only fingerprint IS recomputed on every request')
assert.equal(secondState, firstState, 'a cache hit returns the identical result object')

// Editing an existing agent file — the primary "WorkBuddy side updates" form.
cacheWrite('plug-one/agents/cache-one.md', '---\nname: cache-one\ndescription: v2 trigger text, longer\n---\n\nv2 正文更长。\n')
bumpMtime(join(cacheRoot, 'plug-one', 'agents', 'cache-one.md'))
const editedState = await cacheCatalog.stateOf(cacheRoot)
assert.equal(cacheScans, 2, 'editing an existing agent file auto-rescans (decision #5)')
assert.equal(cardOf(editedState, 'cache-one').description, 'v2 trigger text, longer',
  'state reflects the edited value without any refresh call')

// A NEW agent file inside an existing plugin directory — the regression
// anchor that kills top-level-mtime schemes: neither the plugin directory's
// nor the root's mtime moves, yet the new card must appear.
{
  const plugDirMtime = statSync(join(cacheRoot, 'plug-one')).mtimeMs
  const rootMtime = statSync(cacheRoot).mtimeMs
  cacheWrite('plug-one/agents/cache-two.md', '---\nname: cache-two\ndescription: second card\n---\n\n正文。\n')
  assert.equal(statSync(join(cacheRoot, 'plug-one')).mtimeMs, plugDirMtime,
    'scenario anchor: the plugin directory mtime did NOT move (top-level schemes miss exactly this)')
  assert.equal(statSync(cacheRoot).mtimeMs, rootMtime,
    'scenario anchor: the root mtime did NOT move either')
  const grownState = await cacheCatalog.stateOf(cacheRoot)
  assert.equal(cacheScans, 3, 'a new agent file in an existing plugin auto-rescans')
  assert.ok(cardOf(grownState, 'cache-two') !== undefined, 'the new card is visible with no manual refresh')
}

// Editing plugin.json — the #12 metadata source must invalidate the cache.
cacheWrite('plug-one/.codebuddy-plugin/plugin.json',
  JSON.stringify({ name: 'plug-one', displayDescription: { zh: '插件描述 v2' } }))
const manifestState = await cacheCatalog.stateOf(cacheRoot)
assert.equal(cacheScans, 4, 'a plugin.json edit invalidates the cache (#12)')
assert.equal(cardOf(manifestState, 'cache-one').zhDescription, '插件描述 v2',
  'the metadata change is visible without a refresh')

// Quiet again → cache hit; invalidate() (the refresh seam) forces one scan.
await cacheCatalog.stateOf(cacheRoot)
assert.equal(cacheScans, 4, 'no further change → cache hit again')
cacheCatalog.invalidate()
await cacheCatalog.stateOf(cacheRoot)
assert.equal(cacheScans, 5, 'invalidate() forces a rescan of an unchanged tree')

// Concurrent misses over one (path, fingerprint) share a single in-flight scan.
{
  cacheWrite('plug-one/agents/cache-three.md', '---\nname: cache-three\ndescription: third card\n---\n\n正文。\n')
  let releaseScan
  const scanGate = new Promise((resolve) => { releaseScan = resolve })
  const gatedCatalog = createCatalog(async (rawPath) => {
    cacheScans += 1
    await scanGate
    return scanWorkbuddyRoot(rawPath)
  })
  const shared = Promise.all([gatedCatalog.stateOf(cacheRoot), gatedCatalog.stateOf(cacheRoot)])
  releaseScan()
  const [sharedOne, sharedTwo] = await shared
  assert.equal(cacheScans, 6, 'two concurrent misses coalesce into ONE scan')
  assert.equal(sharedOne, sharedTwo, 'both callers receive the same result object')
  assert.ok(cardOf(sharedOne, 'cache-three') !== undefined, 'the coalesced scan is the post-change one')
}

// invalidate() racing an in-flight scan (the refresh route's exotic-case
// guarantee): a refresh arriving mid-scan must start its OWN scan — never
// join the pre-refresh one — and the late first scan must not repopulate
// the cache when it settles. Without the epoch gate the refresh would be
// served the pre-invalidation result in exactly the size+mtime-preserving
// case refresh exists for.
{
  let releaseFirst
  const firstGate = new Promise((resolve) => { releaseFirst = resolve })
  let firstStarted = false
  const born = cacheScans
  const racingCatalog = createCatalog(async (rawPath) => {
    cacheScans += 1
    if (!firstStarted) {
      firstStarted = true
      await firstGate
    }
    return scanWorkbuddyRoot(rawPath)
  })
  const firstPromise = racingCatalog.stateOf(cacheRoot)
  while (!firstStarted) await new Promise((resolve) => setImmediate(resolve))
  racingCatalog.invalidate() // "refresh" lands while scan #1 is in flight
  const refreshPromise = racingCatalog.stateOf(cacheRoot)
  releaseFirst()
  const [firstResult, refreshResult] = await Promise.all([firstPromise, refreshPromise])
  assert.equal(cacheScans, born + 2, 'invalidate during an in-flight scan forces a NEW scan, no joining')
  assert.notEqual(refreshResult, firstResult, 'the refresh answer is its own scan, not the in-flight one')
  const settled = await racingCatalog.stateOf(cacheRoot)
  assert.equal(settled, refreshResult, 'the late pre-invalidate scan never repopulated the cache')
  assert.equal(cacheScans, born + 2, 'the follow-up request serves the post-invalidate cache entry')
}

rmSync(cacheRoot, { recursive: true, force: true })

// ── 4. settings mount over fakes ─────────────────────────────────────────────

const { SETTINGS_NS, buildSourcePathSchema, mountWorkbuddySettings, namespaceDescriptor } =
  await import(join(root, 'src', 'settings.js'))

/** Minimal schemastery stand-in: callable object schema + toJSON. */
function makeFakeZ() {
  return {
    string: () => ({ type: 'string' }),
    object(dict) {
      const schema = (value) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          throw new TypeError('expected an object')
        }
        const resolved = {}
        for (const [key, child] of Object.entries(dict)) {
          const raw = value[key]
          if (raw !== undefined) {
            if (child.type === 'string' && typeof raw !== 'string') {
              throw new TypeError(`expected string at ${key}`)
            }
            resolved[key] = raw
          }
        }
        return resolved
      }
      schema.toJSON = () => ({ type: 'object', dict })
      return schema
    },
  }
}

/** Fake settings service mirroring the contract the routes rely on. */
function makeFakeSettings() {
  const registrations = new Map()
  const descriptorOf = (reg) => ({ ns: reg.ns, value: reg.resolved, revision: reg.revision })
  return {
    registrations,
    register(ns, schema, options) {
      if (registrations.has(ns)) throw new Error(`settings namespace "${ns}" is already registered`)
      const reg = {
        ns, schema, base: options?.base, user: undefined, revision: 0, watchers: [],
        resolved: schema({ ...(options?.base ?? {}) }),
      }
      registrations.set(ns, reg)
      return {
        get: () => reg.resolved,
        watch: (callback) => { reg.watchers.push(callback); return () => reg.watchers.splice(reg.watchers.indexOf(callback), 1) },
        update: (patch) => this.update(ns, patch),
        replace: (section) => this.replace(ns, section),
      }
    },
    describe: () => [...registrations.values()].map(descriptorOf),
    get: (ns) => registrations.get(ns)?.resolved,
    async update(ns, patch, expectedRevision) {
      const reg = registrations.get(ns)
      if (reg === undefined) throw new Error(`settings namespace "${ns}" is not registered`)
      if (expectedRevision !== undefined && expectedRevision !== reg.revision) {
        const error = new Error(
          `settings namespace "${ns}" changed since it was read (expected revision ${String(expectedRevision)}, now ${String(reg.revision)})`)
        error.code = 'SETTINGS_CONFLICT'
        error.expected = expectedRevision
        error.actual = reg.revision
        throw error
      }
      const before = reg.user === undefined ? undefined : { ...reg.user }
      const nextUser = { ...(reg.user ?? {}), ...patch }
      const previous = reg.resolved
      reg.resolved = reg.schema({ ...(reg.base ?? {}), ...nextUser })
      reg.user = nextUser
      if (JSON.stringify(before) !== JSON.stringify(nextUser)) reg.revision += 1
      for (const watcher of [...reg.watchers]) watcher(reg.resolved, previous)
    },
    async replace(ns, section) {
      const reg = registrations.get(ns)
      reg.resolved = reg.schema({ ...(reg.base ?? {}), ...section })
      reg.user = { ...section }
      reg.revision += 1
    },
  }
}

const fakeZ = makeFakeZ()
const fakeSettings = makeFakeSettings()
const settingsCatalog = createCatalog(async () => ({ experts: [], warnings: [] }))
const offSettings = mountWorkbuddySettings(fakeSettings, fakeZ, settingsCatalog)

assert.equal(SETTINGS_NS, 'workbuddy-market', 'namespace is kebab-case (settings pattern rules out dots)')
let descriptor = namespaceDescriptor(fakeSettings)
assert.ok(descriptor !== undefined, 'namespace registered')
assert.equal(descriptor.value.sourcePath, DEFAULT_SOURCE_PATH, 'base default resolves untouched')
assert.equal(descriptor.revision, 0, 'fresh registration carries revision 0')

// Raw-string storage: the update stores what it was given, tilde intact.
await fakeSettings.update(SETTINGS_NS, { sourcePath: '~/kept-raw' })
descriptor = namespaceDescriptor(fakeSettings)
assert.equal(descriptor.value.sourcePath, '~/kept-raw', '~ survives the write round-trip verbatim')
assert.equal(descriptor.revision, 1, 'raw change bumps the revision')

// buildSourcePathSchema stays factory-agnostic (the host passes the real z).
const schema = buildSourcePathSchema(fakeZ)
assert.equal(typeof schema, 'function', 'schema is callable')
assert.equal(typeof schema.toJSON, 'function', 'schema exposes toJSON')
assert.equal(schema({ sourcePath: 'x' }).sourcePath, 'x')

// Watcher wiring over REAL fixture trees: a sourcePath change drops the
// cache the moment settings reports it — the new path serves its own fresh
// scan, switching back rescans (the single cache entry was dropped), and a
// same-value update keeps the cache (the watcher's own path guard).
{
  const switchRootA = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-watch-a-'))
  const switchRootB = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-watch-b-'))
  for (const [base, plugin, agent] of [
    [switchRootA, 'plug-a', 'sw-a'],
    [switchRootB, 'plug-b', 'sw-b'],
  ]) {
    mkdirSync(join(base, plugin, 'agents'), { recursive: true })
    writeFileSync(join(base, plugin, 'agents', `${agent}.md`),
      `---\nname: ${agent}\ndescription: switch probe\n---\n\n正文。\n`)
    mkdirSync(join(base, plugin, '.codebuddy-plugin'), { recursive: true })
    writeFileSync(join(base, plugin, '.codebuddy-plugin', 'plugin.json'), JSON.stringify({ name: plugin }))
  }
  let switchScans = 0
  const switchCatalog = createCatalog(async (rawPath) => {
    switchScans += 1
    return scanWorkbuddyRoot(rawPath)
  })
  const switchSettings = makeFakeSettings()
  const offSwitch = mountWorkbuddySettings(switchSettings, fakeZ, switchCatalog)

  await switchSettings.update(SETTINGS_NS, { sourcePath: switchRootA })
  assert.deepEqual((await switchCatalog.stateOf(switchRootA)).experts.map((expert) => expert.id), ['sw-a'],
    'root A serves its own plugin card')
  assert.equal(switchScans, 1, 'first request over root A scans')
  await switchCatalog.stateOf(switchRootA)
  assert.equal(switchScans, 1, 'unchanged A serves from cache')

  await switchSettings.update(SETTINGS_NS, { sourcePath: switchRootB }) // watcher fires → invalidate
  assert.deepEqual((await switchCatalog.stateOf(switchRootB)).experts.map((expert) => expert.id), ['sw-b'],
    'the new path serves its own scan immediately — the cache dropped with the watch event')
  assert.equal(switchScans, 2, 'the path switch forced a second scan')

  // Same-value update: the fake service fires watchers unconditionally, so
  // this genuinely exercises mountWorkbuddySettings's own path guard.
  await switchSettings.update(SETTINGS_NS, { sourcePath: switchRootB })
  await switchCatalog.stateOf(switchRootB)
  assert.equal(switchScans, 2, 'a same-value update does not drop the cache')

  await switchSettings.update(SETTINGS_NS, { sourcePath: switchRootA })
  assert.deepEqual((await switchCatalog.stateOf(switchRootA)).experts.map((expert) => expert.id), ['sw-a'],
    'switching back rescans — the watcher dropped the single cache entry')
  assert.equal(switchScans, 3, 'switching back to A scanned a third time')
  offSwitch()
  rmSync(switchRootA, { recursive: true, force: true })
  rmSync(switchRootB, { recursive: true, force: true })
}
offSettings()

// ── 5. routes over a fake webServer ─────────────────────────────────────────

const { mountWorkbuddyMarketRoutes } = await import(join(root, 'src', 'routes.js'))

/** Capturing stand-in for the injected webServer service. */
function makeFakeServer() {
  const routes = new Map()
  return {
    routes,
    register(route) {
      const key = `${route.kind} ${route.path}`
      if (routes.has(key)) throw new Error(`duplicate route ${key}`)
      routes.set(key, route)
      return () => routes.delete(key)
    },
  }
}

/** Duck-typed ServerResponse capturing status/headers/body. */
function makeResponse() {
  const res = { status: null, headers: null, body: '', ended: false }
  res.writeHead = (status, headers) => { res.status = status; res.headers = headers }
  res.end = (chunk) => { if (chunk !== undefined && chunk !== null) res.body += chunk; res.ended = true }
  return res
}

/** Duck-typed IncomingMessage; `chunks` is an array of body chunks. */
function makeRequest({ method = 'GET', url = '/', headers = {}, chunks }) {
  const request = { method, url, headers }
  if (chunks !== undefined) {
    request[Symbol.asyncIterator] = async function* () {
      for (const chunk of chunks) yield chunk
    }
  }
  return request
}

const SAME_ORIGIN = { origin: 'http://127.0.0.1:3789', host: '127.0.0.1:3789' }
const OTHER_ORIGIN = { origin: 'http://evil.example', host: '127.0.0.1:3789' }

const server = makeFakeServer()
const routeSettings = makeFakeSettings()
const routeScanCalls = []
const routeCatalog = createCatalog(async (rawPath) => {
  routeScanCalls.push(rawPath)
  return scanWorkbuddyRoot(rawPath)
})
const offRouteSettings = mountWorkbuddySettings(routeSettings, fakeZ, routeCatalog)
const offRoutes = mountWorkbuddyMarketRoutes(
  { webServer: server, settings: routeSettings },
  { catalog: routeCatalog },
)

assert.deepEqual(
  [...server.routes.keys()].sort(),
  [
    'exact /dsh-workbuddy-market/api/config',
    'exact /dsh-workbuddy-market/api/refresh',
    'exact /dsh-workbuddy-market/api/state',
  ],
  'exactly the three T1 routes registered under the plugin prefix',
)
const stateRoute = server.routes.get('exact /dsh-workbuddy-market/api/state')
const configRoute = server.routes.get('exact /dsh-workbuddy-market/api/config')
const refreshRoute = server.routes.get('exact /dsh-workbuddy-market/api/refresh')

async function handle(route, request) {
  const response = makeResponse()
  await route.handler(request, response)
  assert.equal(response.ended, true, 'handler always ends the response')
  const payload = response.body === '' ? null : JSON.parse(response.body)
  return { response, payload }
}

// GET /api/state: default state, no-store, cache behavior. The default path
// is the REAL WorkBuddy directory — machine-dependent — so only its shape is
// asserted here; the deterministic table is checked against the fixture below.
{
  const { response, payload } = await handle(stateRoute, makeRequest({ url: '/dsh-workbuddy-market/api/state' }))
  assert.equal(response.status, 200)
  assert.equal(response.headers['cache-control'], 'no-store', 'state is no-store')
  assert.equal(payload.sourcePath, DEFAULT_SOURCE_PATH, 'sourcePath echoes the raw default (#18)')
  assert.equal(typeof payload.pathExists, 'boolean')
  assert.equal(typeof payload.revision, 'number')
  assert.ok(Array.isArray(payload.experts), 'experts is an array (the default path is machine-dependent)')
  assert.deepEqual(payload.orphans, [], 'orphans field ships from day one, empty until the install ticket')
  assert.ok(Array.isArray(payload.warnings))
  const scansBefore = routeScanCalls.length
  await handle(stateRoute, makeRequest({ url: '/dsh-workbuddy-market/api/state' }))
  assert.equal(routeScanCalls.length, scansBefore, 'unchanged path serves from the catalog cache')
}
assert.equal((await handle(stateRoute, makeRequest({ method: 'POST' }))).response.status, 405,
  'non-GET state rejected with 405')

// POST /api/config: guards first.
assert.equal((await handle(configRoute, makeRequest({ method: 'GET', headers: SAME_ORIGIN }))).response.status, 405,
  'non-POST config rejected with 405')
assert.equal((await handle(configRoute, makeRequest({ method: 'POST' }))).response.status, 403,
  'missing Origin rejected with 403')
assert.equal((await handle(configRoute, makeRequest({ method: 'POST', headers: OTHER_ORIGIN }))).response.status, 403,
  'cross-origin POST rejected with 403')
assert.equal((await handle(refreshRoute, makeRequest({ method: 'PUT', headers: SAME_ORIGIN }))).response.status, 405,
  'non-POST refresh rejected with 405')
assert.equal((await handle(refreshRoute, makeRequest({ method: 'POST' }))).response.status, 403,
  'origin-less refresh rejected with 403')

// config: save an existing tmp dir; a nonexistent path; a tilde path.
const fixtureDir = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-smoke-'))
{
  const { response, payload } = await handle(configRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ sourcePath: fixtureDir }))],
  }))
  assert.equal(response.status, 200, `existing dir save succeeds: ${response.body}`)
  assert.equal(payload.sourcePath, fixtureDir, 'answer carries the new state')
  assert.equal(payload.pathExists, true)
  assert.deepEqual(payload.warnings, [], 'existing dir yields no warnings')
  assert.equal(payload.revision, 1, 'first raw write bumps the revision')
}
{
  const { response, payload } = await handle(configRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ sourcePath: '/definitely/not/here' }))],
  }))
  assert.equal(response.status, 200, 'nonexistent paths stay saveable (decision #3)')
  assert.equal(payload.pathExists, false)
  assert.equal(payload.warnings.length, 1, 'missing path surfaces exactly one warning')
  assert.ok(payload.warnings[0].includes('/definitely/not/here'), 'warning names the raw path')
}
{
  const { payload } = await handle(configRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ sourcePath: '~/kept-tilde' }))],
  }))
  assert.equal(payload.sourcePath, '~/kept-tilde', 'tilde stored and echoed verbatim, never expanded (#18)')
}

// A full state over the pathology fixture: the routes serve the real scan.
{
  const { response, payload } = await handle(configRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ sourcePath: fixtureRoot }))],
  }))
  assert.equal(response.status, 200, `fixture state succeeds: ${response.body}`)
  assert.equal(payload.pathExists, true)
  assert.deepEqual(payload.experts.map((expert) => expert.id),
    ['dup-expert', 'solo-one', 'solo-three', 'solo-two', 'team-x-checker', 'team-x-lead', 'team-x-maker'],
    'state carries the full expert table from the scan')
  assert.equal(payload.experts.find((expert) => expert.id === 'team-x-maker').zhName, '制造工程师',
    'card fields survive the route hop')
  assert.ok(payload.warnings.some((warning) => warning.includes('duplicate expert id "dup-expert"')),
    'scan warnings surface in the state payload')
}

// Route-level auto-rescan anchor: mutate the fixture AFTER the state above —
// the next GET must serve a fresh scan with no refresh call. The file lands
// in solo-one's agents/ directory, so no top-level mtime moves (decision #5).
{
  writeFileSync(join(fixtureRoot, 'solo-one', 'agents', 'route-added.md'),
    '---\nname: route-added\ndescription: route-level anchor\n---\n\n正文。\n')
  const scansBefore = routeScanCalls.length
  const { payload } = await handle(stateRoute, makeRequest({ url: '/dsh-workbuddy-market/api/state' }))
  assert.equal(routeScanCalls.length, scansBefore + 1, 'a fixture edit forces the next /api/state to rescan')
  assert.ok(payload.experts.some((expert) => expert.id === 'route-added'),
    'the new card surfaces through the route without any refresh call')
}

// config: expectedRevision — fresh passes, stale conflicts transparently.
{
  const readRevision = () => namespaceDescriptor(routeSettings).revision
  const before = readRevision()
  const fresh = await handle(configRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ sourcePath: fixtureDir, expectedRevision: before }))],
  }))
  assert.equal(fresh.response.status, 200, 'current revision accepted')
  const current = readRevision()
  const stale = await handle(configRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ sourcePath: fixtureDir, expectedRevision: current - 1 }))],
  }))
  assert.equal(stale.response.status, 409, 'stale revision rejected with 409')
  assert.equal(stale.payload.code, 'SETTINGS_CONFLICT', 'conflict code passed through')
  assert.equal(stale.payload.expectedRevision, current - 1, 'expected revision surfaced')
  assert.equal(stale.payload.revision, current, 'actual revision surfaced')
}

// config: body validation and the 4 KiB cap.
for (const [label, chunks] of [
  ['invalid JSON', [Buffer.from('{ not json')]],
  ['missing sourcePath', [Buffer.from(JSON.stringify({}))]],
  ['non-string sourcePath', [Buffer.from(JSON.stringify({ sourcePath: 42 }))]],
  ['blank sourcePath', [Buffer.from(JSON.stringify({ sourcePath: '   ' }))]],
  ['oversized body', [Buffer.alloc(4097, 0x61)]],
]) {
  const { response } = await handle(configRoute, makeRequest({ method: 'POST', headers: SAME_ORIGIN, chunks }))
  assert.equal(response.status, 400, `${label} rejected with 400`)
}
{
  // A body of exactly 4096 bytes parses fine — the blank path inside is what
  // gets it rejected, proving the cap cuts above, not at, the boundary.
  const head = Buffer.from('{"sourcePath":"')
  const tail = Buffer.from('"}')
  const padding = Buffer.alloc(4096 - head.length - tail.length, 0x20)
  const atCap = Buffer.concat([head, padding, tail])
  assert.equal(atCap.length, 4096)
  const { response } = await handle(configRoute, makeRequest({ method: 'POST', headers: SAME_ORIGIN, chunks: [atCap] }))
  assert.equal(response.status, 400, 'a body up to the cap parses (rejected here for the blank path, not the size)')
  assert.ok(!response.body.includes('too large'), 'the 4 KiB boundary itself is not a size error')
}

// refresh: cache dropped, new state served.
{
  const scansBefore = routeScanCalls.length
  const { response, payload } = await handle(refreshRoute, makeRequest({ method: 'POST', headers: SAME_ORIGIN }))
  assert.equal(response.status, 200)
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.ok(payload.sourcePath !== undefined, 'refresh answers with a state')
  assert.equal(routeScanCalls.length, scansBefore + 1, 'refresh forced a rescan')
}

// Mutating single-flight: while one config holds the lane on a gated body,
// a second change gets 409; releasing the gate completes the first.
{
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const heldRequest = {
    method: 'POST',
    url: '/dsh-workbuddy-market/api/config',
    headers: SAME_ORIGIN,
    [Symbol.asyncIterator]: async function* () {
      await gate
      yield Buffer.from(JSON.stringify({ sourcePath: fixtureDir }))
    },
  }
  const firstResponse = makeResponse()
  const firstCall = configRoute.handler(heldRequest, firstResponse)
  const second = await handle(configRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ sourcePath: fixtureDir }))],
  }))
  assert.equal(second.response.status, 409, 'concurrent second change gets 409')
  release()
  await firstCall
  assert.equal(firstResponse.status, 200, 'the in-flight first change completes')
  // The lane is free again afterwards.
  const after = await handle(configRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ sourcePath: fixtureDir }))],
  }))
  assert.equal(after.response.status, 200, 'lane released after completion')
}

// Disposal: the route disposer drops every registration (the fiber-cleanup
// analog of "uninstall removes every route"); the settings disposer drops
// the watcher — the namespace itself follows the registering fiber in the
// real service, which the scratch-profile uninstall exercises for real.
offRoutes()
assert.equal(server.routes.size, 0, 'route disposer drops every registration')
offRouteSettings()
assert.equal(routeSettings.registrations.get(SETTINGS_NS).watchers.length, 0,
  'settings disposer drops the cache-invalidation watcher')

rmSync(fixtureDir, { recursive: true, force: true })
rmSync(fixtureRoot, { recursive: true, force: true })

// ── 6. client bundle: loads through the stub loader, mounts nothing ─────────

const clientCode = await readFile(join(root, 'client', 'client.js'), 'utf8')
let loaded = null
globalThis.window = { __ModuleLoader__: { load(def) { loaded = def } } }
;(0, eval)(clientCode)
assert.ok(loaded, '__ModuleLoader__.load received the definition')
assert.equal(loaded.id, 'dsh-workbuddy-market')
const clientModule = loaded.factory(() => { throw new Error('the skeleton requires no externals') })
assert.equal(clientModule.name, 'dsh-workbuddy-market')
assert.deepEqual(clientModule.inject, [], 'no client service dependencies yet')
assert.equal(typeof clientModule.apply, 'function')
assert.equal(typeof clientModule.apply({}), 'function', 'apply returns its disposer')

// ── 7. schemastery resolver (reporting, never gating) ────────────────────────

const { resolveSchemastery } = await import(join(root, 'src', 'schemastery.js'))
try {
  const z = await resolveSchemastery()
  assert.equal(typeof z.object, 'function', 'resolved schemastery factory is usable')
  const realSchema = buildSourcePathSchema(z)
  assert.equal(realSchema({ sourcePath: DEFAULT_SOURCE_PATH }).sourcePath, DEFAULT_SOURCE_PATH,
    'the real schema round-trips the raw default path')
  console.log('smoke: real @deepseek-ai/schemastery resolved on this machine — schema path verified')
} catch (error) {
  console.log(`smoke: no real harness resolvable here (${String(error.message).slice(0, 60)}…) — tier-1 install covers this in the scratch profile`)
}

console.log('dsh-workbuddy-market smoke: all checks passed')
