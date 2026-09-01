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
 *   3. catalog cache: cached per source path, invalidated explicitly;
 *   4. settings mount against a fake settings service + fake schemastery:
 *      base default, raw-string storage, watcher invalidates the catalog;
 *   5. routes over a fake webServer with duck-typed request/response:
 *      /api/state shape + no-store (including a full state over the
 *      pathology fixture), /api/config (save, tilde passthrough,
 *      nonexistent path allowed, revision conflict 409, validation),
 *      /api/refresh, 405/403 rejection, the 4 KiB body cap, the mutating
 *      single-flight lane (concurrent second change → 409), and full
 *      disposal;
 *   5b. install (ticket #5) against a mock roster over the same fixture
 *      (the sister plugin's mock approach): the §4 seven steps' full product
 *      set (preset.yml base fields, persona as a replaced single-line JSON
 *      scalar, skills copied — including an EMPTY skill directory,
 *      #15/#20 —, composition carrying customSkillDirs with the verbatim
 *      !!js expression, manifest fields + fingerprint, roster user-trust
 *      entry), the idempotent same-source reinstall (no diff, no
 *      misreports), the two anchor patches' unit idempotency (pristine /
 *      already-patched / extra-keys / CRLF forms, `$1`-safe replacers), the
 *      degrade paths (persona anchor miss → base persona + warning;
 *      skill-filesystem anchor miss → 「skills 未挂载」 warning + no skills
 *      copied), the three error scenarios (foreign source / manifest
 *      missing+corrupt / base missing), the post-copy-failure cleanup plus
 *      the interrupted-reinstall wording and retry (decision #20),
 *      route-level install (200/400/405/403, shared single-flight lane),
 *      and — when a real harness is resolvable on this machine — both
 *      anchors gated against the SHIPPED standard (pristine) and cordis
 *      (already-patched) compositions;
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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
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
// An EMPTY skill directory: copied verbatim per #15 (existence by stat, not
// by fingerprint rows), contributing zero manifest rows.
mkdirSync(join(fixtureRoot, 'solo-one', 'skills', 'empty-skill'), { recursive: true })
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
  assert.deepEqual(soloOne.skills, ['empty-skill', 'main-skill', 'references'],
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

// ── 3. catalog cache ─────────────────────────────────────────────────────────

const { createCatalog } = await import(join(root, 'src', 'catalog.js'))

const scanCalls = []
const catalog = createCatalog(async (rawPath) => {
  scanCalls.push(rawPath)
  return { experts: [], warnings: [] }
})
assert.deepEqual(await catalog.stateOf('~/one'), { experts: [], warnings: [] })
await catalog.stateOf('~/one')
assert.equal(scanCalls.length, 1, 'same path served from cache')
await catalog.stateOf('~/two')
assert.equal(scanCalls.length, 2, 'different path rescans')
catalog.invalidate()
await catalog.stateOf('~/two')
assert.equal(scanCalls.length, 3, 'invalidate forces a rescan')

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

// Watcher wiring: a sourcePath change invalidates the catalog.
let watchScans = 0
const watchCatalog = createCatalog(async () => { watchScans += 1; return { experts: [], warnings: [] } })
const offWatchSettings = mountWorkbuddySettings(makeFakeSettings(), fakeZ, watchCatalog)
await watchCatalog.stateOf('~/a')
await watchCatalog.stateOf('~/a')
assert.equal(watchScans, 1)
await fakeSettings.update(SETTINGS_NS, { sourcePath: '~/kept-raw' }) // same value: no watcher trip
assert.equal(watchScans, 1, 'deep-equal value change does not rescan')
offWatchSettings()
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
    'exact /dsh-workbuddy-market/api/install',
    'exact /dsh-workbuddy-market/api/refresh',
    'exact /dsh-workbuddy-market/api/state',
  ],
  'the four routes shipped so far (state/config/refresh + T4 install) under the plugin prefix',
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

// ── 5b. install (ticket #5): mock roster over the pathology fixture ─────────
//
// The mock roster mirrors the dsh-agent-presets contract the install flow
// uses: list() entries with id/trust/path, whole-directory copy() that
// writes the composition + preset.yml, remove() that deletes, and
// standingKeyFor() recording the mount validation.

const {
  BASE_PRESET_ID, MANIFEST_FILE, PRESET_ID_PREFIX, computeInstallFingerprint,
  installWorkbuddyExpert, patchPersonaText, patchSkillFilesystemRow, skillsManifestOf,
} = await import(join(root, 'src', 'presets.js'))

assert.equal(PRESET_ID_PREFIX, 'wb-', 'preset ids are namespaced under wb-')
assert.equal(BASE_PRESET_ID, 'standard', 'the copy base is the standard composition')

/** The composition a real standard copy lands as: persona row, other rows, PRISTINE skill-filesystem row. */
const SAMPLE_COMPOSITION = [
  '# comment header',
  '',
  "- id: persona",
  "  name: '@deepseek-ai/dsh-persona'",
  '  config:',
  '    text: >-',
  '      You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.',
  '',
  '- id: agent-instructions',
  "  name: '@deepseek-ai/dsh-agent-instructions'",
  '  config:',
  '    maxBytes: 65536',
  '',
  '- id: skill-filesystem',
  "  name: '@deepseek-ai/dsh-skill-filesystem'",
  '',
  '- id: tool-skill',
  "  name: '@deepseek-ai/dsh-tool-skill'",
  '',
].join('\n')

/** The two-line customSkillDirs entry every patched row carries (#18: verbatim !!js expression). */
const CUSTOM_DIRS_ENTRY_LINES = [
  '    customSkillDirs:',
  `      - !!js "process.getBuiltinModule('node:url').fileURLToPath(new URL('skills/', baseUrl))"`,
].join('\n')

/** The full three-line block a pristine patch appends (config: header included). */
const CUSTOM_DIRS_LINES = `  config:\n${CUSTOM_DIRS_ENTRY_LINES}`

/**
 * Mock roster (the sister plugin's approach). `composition` is what copy()
 * lands; `withBase: false` simulates a deployment without the standard base;
 * `failStanding` makes the mount validation throw (cleanup-path probe).
 */
function makeRoster({ composition = SAMPLE_COMPOSITION, withBase = true, failStanding = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-roster-'))
  const entries = new Map()
  const calls = { copy: [], remove: [], standing: [] }
  if (withBase) {
    entries.set('standard', { id: 'standard', trust: 'system', path: join(dir, 'standard', 'agent.cordis.yml') })
  }
  const roster = {
    dir, entries, calls,
    /** Flip mid-test to make the NEXT standingKeyFor throw (reinstall-interrupt probe). */
    failStanding,
    async list() { return [...entries.values()] },
    async copy(from, id, name) {
      assert.equal(from, BASE_PRESET_ID, 'copies always start from the standard base')
      calls.copy.push(id)
      const presetDir = join(dir, id)
      mkdirSync(presetDir, { recursive: true })
      writeFileSync(join(presetDir, 'agent.cordis.yml'), composition, 'utf8')
      writeFileSync(join(presetDir, 'preset.yml'), `name: ${JSON.stringify(name ?? id)}\ndescription: base\n`, 'utf8')
      entries.set(id, { id, trust: 'user', path: join(presetDir, 'agent.cordis.yml') })
    },
    async remove(id) {
      calls.remove.push(id)
      entries.delete(id)
      rmSync(join(dir, id), { recursive: true, force: true })
    },
    async standingKeyFor(id) {
      calls.standing.push(id)
      if (roster.failStanding) throw new Error('mock mount failure')
      return `scope:${id}`
    },
  }
  return roster
}

/** Recursive sorted listing of one directory tree: [relativePath, content] pairs. */
function treeOf(dir, prefix = '') {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.name.startsWith('.')) continue
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) out.push(...treeOf(join(dir, entry.name), relative))
    else out.push([relative, readFileSync(join(dir, entry.name), 'utf8')])
  }
  return out
}

/** Independent re-implementation of the fingerprint's skills slice (walk the SOURCE). */
function smokeSkillsRows(rawRoot, card) {
  const rows = []
  const walk = (abs, relative) => {
    for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name.startsWith('.')) continue
      const next = relative === '' ? entry.name : `${relative}/${entry.name}`
      if (entry.isDirectory()) walk(join(abs, entry.name), next)
      else {
        const info = statSync(join(abs, entry.name))
        rows.push([next, info.size, info.mtimeMs])
      }
    }
  }
  for (const name of card.skills) walk(join(rawRoot, card.pluginDir, 'skills', name), name)
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return rows
}

// 5b-1 · full seven-step install of a skills-carrying expert (solo-one).
const roster = makeRoster()
const soloOne = byId.get('solo-one')
assert.ok(soloOne !== undefined && soloOne.agentFile === 'solo-one.md' && soloOne.pluginDir === 'solo-one',
  'the scan card carries the install provenance fields')
const first = await installWorkbuddyExpert(roster, soloOne, fixtureRoot)

assert.equal(first.presetId, 'wb-solo-one')
assert.equal(first.base, 'standard')
assert.deepEqual(first.warnings, [], 'both anchors hit the sampled standard composition')
assert.equal(first.fingerprint, computeInstallFingerprint(soloOne, smokeSkillsRows(fixtureRoot, soloOne)),
  'fingerprint matches an independently walked skills manifest')
assert.deepEqual(roster.calls.standing, ['wb-solo-one'], 'step ⑥ mount-validated the installed preset')
{
  // Roster acceptance — the picker's own data source: a user-trust entry
  // with a locatable composition path, no broken reason.
  const entry = roster.entries.get('wb-solo-one')
  assert.equal(entry.trust, 'user', 'the installed preset is a roster user-trust entry')
  assert.equal(typeof entry.path, 'string')
  assert.equal(entry.broken, undefined)
}

const presetDir = join(roster.dir, 'wb-solo-one')
const installedComposition = readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8')
assert.ok(installedComposition.includes(`    text: ${JSON.stringify(soloOne.persona)}`),
  'persona landed as a single-line JSON scalar at the anchored row')
assert.ok(installedComposition.includes(`    text: ${JSON.stringify(soloOne.persona)}\n\n`),
  'the replaced row is a single-line scalar followed by a blank line (re-matchable anchor)')
assert.ok(!installedComposition.includes('You are a coding agent powered by'),
  'the base folded persona is gone')
assert.ok(installedComposition.includes(CUSTOM_DIRS_LINES),
  'composition carries customSkillDirs with the verbatim !!js expression')
assert.ok(!installedComposition.includes('customSkillDirs:\n      - /'),
  'no foreign customSkillDirs entry remains')

const installedYml = readFileSync(join(presetDir, 'preset.yml'), 'utf8')
assert.ok(installedYml.includes(`name: ${JSON.stringify(soloOne.name)}`), 'preset.yml carries the card base name')
assert.ok(installedYml.includes(`description: ${JSON.stringify(soloOne.description)}`),
  'preset.yml carries the card base description')

assert.deepEqual(
  treeOf(join(presetDir, 'skills')).map(([relative]) => relative),
  ['main-skill/SKILL.md', 'references/data.md'],
  'both file-carrying skill directories copied verbatim (references/ has no SKILL.md, #15)',
)
assert.equal(existsSync(join(presetDir, 'skills', 'empty-skill')), true,
  'the EMPTY skill directory copies too — existence by stat, never by fingerprint rows (#15/#20)')
assert.equal(readFileSync(join(presetDir, 'skills', 'references', 'data.md'), 'utf8'),
  'reference data with no SKILL.md\n', 'skill file content is byte-identical')
if (process.platform !== 'win32') {
  // Added paths keep the roster's owner-only posture (dsh-agent-presets
  // tightens its own copy the same way; our additions must not loosen it).
  assert.equal(statSync(join(presetDir, MANIFEST_FILE)).mode & 0o777, 0o600,
    'manifest is owner-only')
  assert.equal(statSync(join(presetDir, 'skills')).mode & 0o777, 0o700,
    'skills directories are owner-only')
  assert.equal(statSync(join(presetDir, 'skills', 'main-skill', 'SKILL.md')).mode & 0o777, 0o600,
    'skill files are owner-only')
}

const manifest = JSON.parse(readFileSync(join(presetDir, MANIFEST_FILE), 'utf8'))
assert.deepEqual(Object.keys(manifest).sort(),
  ['agentFile', 'fingerprint', 'importedAt', 'pluginDir', 'sourcePath'],
  'manifest carries exactly the designed fields')
assert.equal(manifest.sourcePath, fixtureRoot, 'manifest records the RAW source path')
assert.equal(manifest.pluginDir, 'solo-one')
assert.equal(manifest.agentFile, 'solo-one.md')
assert.equal(manifest.fingerprint, first.fingerprint, 'manifest fingerprint = the install fingerprint')
assert.ok(!Number.isNaN(Date.parse(manifest.importedAt)), 'importedAt is a parseable timestamp')

// 5b-2 · same-source reinstall is idempotent: identical products, no warnings.
const beforeTree = treeOf(presetDir).filter(([relative]) => relative !== MANIFEST_FILE)
const second = await installWorkbuddyExpert(roster, soloOne, fixtureRoot)
assert.deepEqual(second.warnings, [], 'reinstall raises no 「skills 未挂载」 false positive (already-patched branch)')
assert.equal(second.fingerprint, first.fingerprint, 'fingerprint stable across reinstalls')
assert.deepEqual(
  treeOf(presetDir).filter(([relative]) => relative !== MANIFEST_FILE),
  beforeTree,
  'reinstall leaves every persisted product byte-identical (manifest aside)',
)
assert.deepEqual(roster.calls.remove, ['wb-solo-one'], 'reinstall went remove → re-copy, never overwriting')
// A differently SPELLED but same directory source is still the same source.
const third = await installWorkbuddyExpert(roster, soloOne, `${fixtureRoot}/`)
assert.deepEqual(third.warnings, [], 'trailing-slash source spelling is the same source (path normalization)')

// 5b-3 · anchor patch units: pristine / already-patched / extra keys / CRLF / $-safe.
{
  const pristine = patchSkillFilesystemRow(SAMPLE_COMPOSITION)
  assert.equal(pristine.form, 'pristine')
  assert.equal(pristine.changed, true)
  assert.ok(pristine.text.includes(CUSTOM_DIRS_LINES))
  const again = patchSkillFilesystemRow(pristine.text)
  assert.equal(again.form, 'patched')
  assert.equal(again.changed, false, 'second execution over our own output: no diff')
  assert.equal(again.text, pristine.text)

  // A row carrying OTHER config keys plus a foreign customSkillDirs: the
  // entry is replaced in place, the other key survives, rerun is stable.
  const foreignRow = SAMPLE_COMPOSITION.replace(
    "- id: skill-filesystem\n  name: '@deepseek-ai/dsh-skill-filesystem'\n",
    "- id: skill-filesystem\n  name: '@deepseek-ai/dsh-skill-filesystem'\n"
    + '  config:\n    someFutureKey: 1\n    customSkillDirs:\n      - /old/absolute/path\n',
  )
  const merged = patchSkillFilesystemRow(foreignRow)
  assert.equal(merged.form, 'patched')
  assert.equal(merged.changed, true)
  assert.ok(merged.text.includes('someFutureKey: 1'), 'foreign config keys survive the in-place replace')
  assert.ok(merged.text.includes(CUSTOM_DIRS_ENTRY_LINES), 'our entry replaced the foreign one in place')
  assert.ok(!merged.text.includes('/old/absolute/path'))
  assert.equal(patchSkillFilesystemRow(merged.text).changed, false, 'merged form reruns with no diff')

  // CRLF row form still anchors (the insert itself stays LF, like the persona patch).
  const crlfPatched = patchSkillFilesystemRow(SAMPLE_COMPOSITION.replace(/\n/g, '\r\n'))
  assert.ok(crlfPatched !== null && crlfPatched.changed)
  assert.ok(crlfPatched.text.includes(CUSTOM_DIRS_LINES))

  // `$1`-safety: a persona carrying replace metacharacters survives verbatim.
  const dollarPersona = 'Use $1, $&, $$ and $` carefully in SQL and regex examples.'
  const dollarPatched = patchPersonaText(SAMPLE_COMPOSITION, dollarPersona)
  assert.ok(dollarPatched !== null && dollarPatched.includes(`    text: ${JSON.stringify(dollarPersona)}\n\n`),
    'persona $-sequences are never interpreted as replacement patterns')

  // Anchor misses degrade to null (composition drift), never a broken patch.
  assert.equal(patchPersonaText(SAMPLE_COMPOSITION.replace('- id: persona', '- id: persona-x'), 'p'), null)
  assert.equal(patchSkillFilesystemRow(SAMPLE_COMPOSITION.replace('- id: skill-filesystem', '- id: nope')), null)
}

// 5b-4 · persona anchor miss → warning + base persona, preset still installs.
{
  const driftRoster = makeRoster({ composition: SAMPLE_COMPOSITION.replace('- id: persona', '- id: persona-x') })
  const drifted = await installWorkbuddyExpert(driftRoster, soloOne, fixtureRoot)
  assert.deepEqual(drifted.warnings.filter((warning) => warning.includes('persona row not found')).length, 1,
    'persona anchor miss degrades to exactly one warning')
  const kept = readFileSync(join(driftRoster.dir, 'wb-solo-one', 'agent.cordis.yml'), 'utf8')
  assert.ok(kept.includes('You are a coding agent powered by'),
    'the base persona stays in place — the preset is never broken')
  assert.ok(!kept.includes(JSON.stringify(soloOne.persona)), 'the unmatched persona was not written')
  assert.equal(drifted.fingerprint, first.fingerprint,
    'fingerprint stays source-true even on the degraded persona path')
  rmSync(driftRoster.dir, { recursive: true, force: true })
}

// 5b-5 · skill-filesystem anchor miss → warning + no skills copied.
{
  const noRowRoster = makeRoster({ composition: SAMPLE_COMPOSITION.replace(/- id: skill-filesystem\n.+\n/, '') })
  const noRow = await installWorkbuddyExpert(noRowRoster, soloOne, fixtureRoot)
  assert.deepEqual(noRow.warnings.filter((warning) => warning.includes('skills 未挂载')).length, 1,
    'skills anchor miss degrades to the designed 「skills 未挂载」 warning')
  assert.equal(existsSync(join(noRowRoster.dir, 'wb-solo-one', 'skills')), false,
    'unmounted skills are not copied into the preset')
  assert.equal(noRow.fingerprint, first.fingerprint,
    'the fingerprint still covers the card skills (source-true updatable semantics)')
  rmSync(noRowRoster.dir, { recursive: true, force: true })
}

// 5b-6 · foreign source / manifest missing / manifest corrupt.
{
  // A second source carrying the same expert id under a different plugin dir.
  const sourceB = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-srcb-'))
  const writeB = (relative, content) => {
    const path = join(sourceB, relative)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  writeB('other-origin/agents/other-origin.md', [
    '---',
    'name: solo-one',
    'description: Same id from a different source.',
    '---',
    '',
    'Different persona entirely.',
    '',
  ].join('\n'))
  writeB('other-origin/.codebuddy-plugin/plugin.json', JSON.stringify({ name: 'other-origin' }))
  const cardB = (await scanWorkbuddyRoot(sourceB)).experts.find((expert) => expert.id === 'solo-one')
  assert.ok(cardB !== undefined, 'source B scans the shared id')
  await assert.rejects(
    () => installWorkbuddyExpert(roster, cardB, sourceB),
    /该专家已从别的源目录安装/,
    'foreign-source collision reports the designed error',
  )
  assert.ok(roster.entries.has('wb-solo-one'), 'the collision leaves the installed preset untouched')
  rmSync(sourceB, { recursive: true, force: true })

  const manifestPath = join(presetDir, MANIFEST_FILE)
  const savedManifest = readFileSync(manifestPath, 'utf8')
  const removesBeforeErrors = roster.calls.remove.length
  rmSync(manifestPath)
  await assert.rejects(() => installWorkbuddyExpert(roster, soloOne, fixtureRoot), /清单缺失，请卸载重装/,
    'missing manifest is the designed error')
  writeFileSync(manifestPath, '{ not json')
  await assert.rejects(() => installWorkbuddyExpert(roster, soloOne, fixtureRoot), /清单缺失，请卸载重装/,
    'corrupt manifest is the same designed error')
  writeFileSync(manifestPath, savedManifest)
  assert.equal(roster.calls.remove.length, removesBeforeErrors,
    'none of the error paths removed or replaced the installed preset')
}

// 5b-7 · base missing → error, no half products; post-copy failure → cleanup.
{
  const noBase = makeRoster({ withBase: false })
  await assert.rejects(() => installWorkbuddyExpert(noBase, soloOne, fixtureRoot), /base preset not found: standard/,
    'missing base is reported before anything is created')
  assert.deepEqual(noBase.calls.copy, [], 'copy never ran')
  assert.deepEqual(readdirSync(noBase.dir).filter((name) => name.startsWith('wb-')), [],
    'no half-made preset directory remains')

  const failStanding = makeRoster({ failStanding: true })
  await assert.rejects(() => installWorkbuddyExpert(failStanding, soloOne, fixtureRoot), /mock mount failure/,
    'a mount-validation failure propagates')
  assert.equal(existsSync(join(failStanding.dir, 'wb-solo-one')), false,
    'the failed install removed the preset it had created (no half products)')
  assert.equal(failStanding.entries.has('wb-solo-one'), false, 'roster no longer reports it')

  // A failed REINSTALL reports that the previous install was removed at its
  // start (decision #20) — and a retry restores the working install.
  roster.failStanding = true
  await assert.rejects(
    () => installWorkbuddyExpert(roster, soloOne, fixtureRoot),
    (error) => /mock mount failure/.test(error.message) && /重装中断/.test(error.message),
    'an interrupted reinstall keeps the original cause and says the old install is gone',
  )
  assert.equal(roster.entries.has('wb-solo-one'), false, 'the interrupted reinstall left no half product')
  roster.failStanding = false
  const restored = await installWorkbuddyExpert(roster, soloOne, fixtureRoot)
  assert.equal(restored.presetId, 'wb-solo-one')
  assert.equal(restored.fingerprint, first.fingerprint, 'the retry restores the identical install')
  rmSync(noBase.dir, { recursive: true, force: true })
  rmSync(failStanding.dir, { recursive: true, force: true })
}

// 5b-8 · route-level install through the fake webServer: guards, lane, shapes.
{
  const server2 = makeFakeServer()
  const roster2 = makeRoster()
  const settings2 = makeFakeSettings()
  const catalog2 = createCatalog(async () => ({ experts: [soloOne], warnings: [] }))
  const offSettings2 = mountWorkbuddySettings(settings2, fakeZ, catalog2)
  // Pin the namespace to the fixture BEFORE any install runs through the
  // route — the registered base is the machine-dependent real corpus path.
  await settings2.update(SETTINGS_NS, { sourcePath: fixtureRoot })
  const offRoutes2 = mountWorkbuddyMarketRoutes(
    { webServer: server2, settings: settings2, agentPresets: roster2 },
    { catalog: catalog2 },
  )
  const installRoute = server2.routes.get('exact /dsh-workbuddy-market/api/install')
  assert.ok(installRoute !== undefined, 'install route registered under the plugin prefix')
  assert.equal((await handle(installRoute, makeRequest({ method: 'GET', headers: SAME_ORIGIN }))).response.status, 405,
    'non-POST install rejected with 405')
  assert.equal((await handle(installRoute, makeRequest({ method: 'POST' }))).response.status, 403,
    'origin-less install rejected with 403')

  const ok = await handle(installRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ id: 'solo-one' }))],
  }))
  assert.equal(ok.response.status, 200, `route install succeeds: ${ok.response.body}`)
  assert.equal(ok.response.headers['cache-control'], 'no-store')
  assert.equal(ok.payload.ok, true)
  assert.equal(ok.payload.presetId, 'wb-solo-one')

  const unknown = await handle(installRoute, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ id: 'no-such-expert' }))],
  }))
  assert.equal(unknown.response.status, 400)
  assert.match(unknown.payload.error, /unknown expert id/)
  for (const chunks of [[Buffer.from('{ not json')], [Buffer.from(JSON.stringify({}))]]) {
    const bad = await handle(installRoute, makeRequest({ method: 'POST', headers: SAME_ORIGIN, chunks }))
    assert.equal(bad.response.status, 400, 'bodies without an id string are rejected')
  }

  // The install route shares the mutating single-flight lane with config.
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const heldRequest = {
    method: 'POST',
    url: '/dsh-workbuddy-market/api/install',
    headers: SAME_ORIGIN,
    [Symbol.asyncIterator]: async function* () {
      await gate
      yield Buffer.from(JSON.stringify({ id: 'solo-one' }))
    },
  }
  const heldResponse = makeResponse()
  const heldCall = installRoute.handler(heldRequest, heldResponse)
  const configRoute2 = server2.routes.get('exact /dsh-workbuddy-market/api/config')
  const during = await handle(configRoute2, makeRequest({
    method: 'POST', headers: SAME_ORIGIN,
    chunks: [Buffer.from(JSON.stringify({ sourcePath: fixtureRoot }))],
  }))
  assert.equal(during.response.status, 409, 'an in-flight install holds the shared mutation lane')
  release()
  await heldCall
  assert.equal(heldResponse.status, 200, 'the held install completed after release')

  offRoutes2()
  assert.equal(server2.routes.size, 0)
  offSettings2()
  rmSync(roster2.dir, { recursive: true, force: true })
}

// 5b-9 · gate both anchors against the SHIPPED compositions when a real
// harness is resolvable on this machine (skipped with a note otherwise).
{
  const require = (() => {
    const anchors = []
    if (typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== '') {
      anchors.push(join(process.env.DSH_HOME, 'profiles', 'package.json'))
    }
    anchors.push(join(homedir(), '.dsh', 'profiles', 'package.json'))
    for (const anchor of anchors) {
      try {
        return createRequire(anchor)
      } catch {
        // try the next anchor
      }
    }
    return null
  })()
  let dshRoot = null
  if (require !== null) {
    try {
      dshRoot = dirname(require.resolve('@deepseek-ai/dsh/package.json'))
    } catch {
      dshRoot = null
    }
  }
  if (dshRoot === null) {
    console.log('smoke: no resolvable dsh install here — shipped-preset anchor gate skipped (covered by the scratch-profile run)')
  } else {
    const standardText = readFileSync(join(dshRoot, 'config', 'agent-presets', 'standard', 'agent.cordis.yml'), 'utf8')
    const cordisText = readFileSync(join(dshRoot, 'config', 'agent-presets', 'cordis', 'agent.cordis.yml'), 'utf8')
    const personaGate = patchPersonaText(standardText, '锚定冒烟专家')
    assert.ok(personaGate !== null, 'persona anchor hits the REAL shipped standard composition')
    assert.ok(personaGate.includes('锚定冒烟专家'))
    const standardGate = patchSkillFilesystemRow(standardText)
    assert.ok(standardGate !== null && standardGate.form === 'pristine',
      'skill-filesystem anchor hits the real standard row in its pristine form')
    assert.ok(standardGate.text.includes(CUSTOM_DIRS_LINES),
      'our produced block is byte-identical to the shipped cordis preset lines')
    assert.ok(cordisText.includes(CUSTOM_DIRS_LINES),
      'the shipped cordis preset carries exactly those lines (verbatim #18 source)')
    const cordisGate = patchSkillFilesystemRow(cordisText)
    assert.equal(cordisGate.form, 'patched')
    assert.equal(cordisGate.changed, false, 'the shipped cordis form (already patched) reruns with NO diff')
    assert.equal(cordisGate.text, cordisText)
    console.log('smoke: both anchors gated against the shipped standard/cordis compositions — verbatim forms confirmed')
  }
}

rmSync(join(roster.dir), { recursive: true, force: true })

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
