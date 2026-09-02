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
 *      body-H1 zhName extension) — and the category extraction (#23:
 *      plugin.json categoryId verbatim on every card, team members
 *      included, CRLF-parsed, absent when the manifest has none);
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
 *   5b. install (ticket #5) against a mock roster over the same fixture
 *      (the sister plugin's mock approach): the §4 seven steps' full product
 *      set (preset.yml base fields, persona as a replaced single-line JSON
 *      scalar, skills copied — including an EMPTY skill directory,
 *      #15/#21 —, composition carrying customSkillDirs with the verbatim
 *      !!js expression, manifest fields + fingerprint, roster user-trust
 *      entry), the idempotent same-source reinstall (no diff, no
 *      misreports), the two anchor patches' unit idempotency (pristine /
 *      already-patched / extra-keys / CRLF forms, `$1`-safe replacers), the
 *      degrade paths (persona anchor miss → base persona + warning;
 *      skill-filesystem anchor miss → 「skills 未挂载」 warning + no skills
 *      copied), the three error scenarios (foreign source / manifest
 *      missing+corrupt / base missing), the post-copy-failure cleanup plus
 *      the interrupted-reinstall wording and retry (decision #21),
 *      route-level install (200/400/405/403, shared single-flight lane),
 *      and — when a real harness is resolvable on this machine — both
 *      anchors gated against the SHIPPED standard (pristine) and cordis
 *      (already-patched) compositions;
 *      update/uninstall/orphans (ticket #6, same mock roster): the in-place
 *      re-stamp over a live fixture edit (persona swapped + a NEW skill
 *      copied + a source-deleted skill directory removed — no copy/remove,
 *      no 「skills 未挂载」 misreport, mount re-validated, manifest
 *      refreshed → not updatable), the frontmatter-description-only edit
 *      flipping updatable (#8), the disclosed touch-only false positive
 *      (#18) with a harmless idempotent re-stamp, update's error matrix
 *      (not installed / trust ≠ user / #17 manifest missing+corrupt+
 *      fingerprint-less / #9 foreign source), uninstall (whole directory
 *      gone, roster entry gone, trust refusal, orphan-by-id cleanup), and
 *      the /api/state overlay through the routes (installed/updatable/
 *      broken on every card, source switch → orphans reported but never
 *      auto-uninstalled, broken manifest → card broken + the #17 warning
 *      with install AND update refusing the same way);
 *   5c. avatar route (ticket #7): byte-exact PNG streams off the pathology
 *      fixture (a declared plugin.json avatar + a team member's own PNG)
 *      with image/png + max-age=60 + content-length, the uniform-404
 *      matrix (unknown id, ID_RE rejects of every spelling, missing/empty
 *      id param, PNG-less expert) answering ONE identical no-detail body,
 *      state cards carrying avatarUrl only for PNG-bearing experts (the
 *      internal absolute avatarPath never leaks), and — over a dedicated
 *      escape fixture whose DECLARED plugin.json avatars (a `..` relative
 *      path; a symlink where the platform has them) really resolve outside
 *      the source root — both escapes 404 while an innocent avatar in the
 *      same tree still serves byte-identical bytes;
 *   6. client bundle (ticket #8) through a stub __ModuleLoader__ with a
 *      functional document stub and a React stub whose useState actually
 *      stores: bundle loads, settings.section registers (label/order/id),
 *      the zh/en dictionaries stay key-aligned, the pure filter/search/
 *      localization derivations hold (five chip states, cross-language
 *      search where the base fields always hit, zh↔en name/description
 *      chains), real component renders run (avatar img + onError → static
 *      emoji with no second request, PNG-less card emoji, badges, tolerant
 *      ✓/↑/⚠ marks, pathExists=false banner appearing and clearing,
 *      collapsed-by-default warnings fold, locale-following cards), and
 *      the apply disposer releases the slot entry AND the scoped style
 *      tag (a re-apply after dispose re-injects idempotently) — plus the
 *      category dimension (#23: label localization with the unknown-id
 *      prefix-stripped fallback, chip derivation with the uncategorized
 *      sentinel last, the 4-argument filterExperts, category haystack
 *      spellings, the card badge, the census count, and the chip-row
 *      click machine on the page);
 *   6c. the summon entry points (ticket #11) over the same storing React
 *      stub and scripted fetch: the zh/en instruction drafts (tool
 *      wording per src/summon.js — the draft asks the model to call
 *      summon_workbuddy_expert; a non-blank composer draft rides along as
 *      the task), one apply() registering BOTH seats (settings.section +
 *      conversation.input.left) plus the '@' source with the inputTriggers
 *      service, the trigger's installed-only candidates (broken installs
 *      stay, id + localized name on every row), zh/en/id query filtering,
 *      the { text } pick arm, the never-rejecting fetch-failure path, the
 *      REAL button machine (click → fetch → popover → pick → setDraft
 *      with the draft and nothing else — no send seam exists; healthy
 *      zero-installs opens the settings section instead of the popover;
 *      a failed route still opens the popover with empty-state copy), and
 *      one disposer releasing both registrations with the style tag;
 *   6d. the P4 interactions (ticket #12) over the same storing React stub
 *      and scripted fetch: the team group view (groupCardsByPlugin/
 *      groupExpanded/groupStatsOf derivations; a page where the team
 *      renders as ONE collapsed-by-default group header with aggregated
 *      marks while solo cards stay flat; click-to-expand; the auto-expand
 *      under an active query and the explicit fold that overrides it; the
 *      census/chips/matchline still counting expert cards), the serial
 *      bulk update (strictly one /api/update at a time with a state
 *      refetch after EVERY completion; the lane held while walking; the
 *      mid-run failure parking the walk with the host error and the
 *      failed card keeping its own row button; 继续更新剩余 resuming the
 *      remaining queue; 收起 returning the idle entry), and the orphan
 *      panel coexisting with a live market grid;
 *   8. summon tools (ticket #10) against a mocked tools/subagents/prompt
 *      seam over a dedicated scan fixture (the sister plugin's mock
 *      approach, this ticket's new build): the four-name deny list and its
 *      registry intersection (sister names dropped when absent — the
 *      core's tools.restrict throws on unknown names), expert resolution
 *      over the CURRENT scan table through the shared catalog (exact /
 *      case-insensitive / en / zh / substring / ambiguous / missing),
 *      task validation, the summonable set = the install overlay's
 *      installed set (hand-written wb-* roster manifests), start
 *      parameters (label, prompt blocks, parent, signal, the COMPLETE
 *      scan-card persona verbatim, the deny list), failure mapping
 *      (stopReason + diagnostic + partial output, run still disposed),
 *      provider capability gates, both tool descriptions guiding
 *      list-first, the zh/en message dicts aligned, child sessions
 *      getting an empty prompt section, and the mount disposer dropping
 *      every registration — plus the list tool's optional category
 *      filter (#23: verbatim raw-id matching, the category echo, and the
 *      dedicated miss guidance in both host locales);
 *   9. the schemastery resolver, when a real harness is present on this
 *      machine, hands back a usable factory (skipped silently otherwise —
 *      this section reports, it never gates).
 *
 * The real install/boot/curl matrix runs in a scratch profile (design doc
 * P5); everything offline-coverable from that list lives here.
 */

import assert from 'node:assert/strict'
import { existsSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
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
assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale') &&
  pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'),
  'client inject composes the locale service and the settings.section declaring owner (ticket #8)')
assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-input-trigger'),
  'client inject composes the inputTriggers service owner for the @ source (ticket #11, restored)')
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
assert.ok(indexText.includes("ctx.inject(['tools', 'subagents', 'systemPrompt', 'agentPresets']"),
  'summon segment declared with its four services (ticket #10)')
assert.ok(indexText.includes("from './summon.js'"), 'summon segment wired to src/summon.js')

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
  // An unknown-to-the-client category shape: the chip row must degrade to
  // its prefix-stripped raw name (#23), never drop or crash.
  categoryId: '77-Future-Tech',
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
  categoryId: '01-ProductDesign',
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
  assert.equal(soloOne.category, '02-Engineering', 'category ← plugin.json categoryId VERBATIM (#23)')
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
  assert.equal(soloTwo.category, '77-Future-Tech', 'category parses from a CRLF plugin.json (#14 × #23)')
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
    assert.equal(expert.category, '01-ProductDesign', `${id}: the plugin-level category reaches every team member (#23)`)
    assert.ok(expert.avatarPath.endsWith(join('team-x', 'avatars', `${id}.png`)),
      `${id}: avatar hits its own <agentName>.png (never team.png / first PNG)`)
  }
  assert.equal(lead.zhName, '队长', 'team zhName ← frontmatter profession.zh first (#22)')
  assert.equal(checker.zhName, '质检乙',
    'member with displayName.zh only → displayName.zh still serves as the fallback')
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
  assert.equal(fallback.category, undefined,
    'a plugin.json without categoryId leaves the card uncategorized (#23: absent, never faked)')
  assert.equal(byId.get('dup-expert').category, undefined,
    'the duplicate winner\'s plugin.json carries no category either')
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

/**
 * Duck-typed ServerResponse capturing status/headers/body. Chunks keep
 * their kind: string chunks feed the `body` text view (JSON payloads, so
 * `handle` keeps parsing), while `buffer` concatenates every chunk's bytes
 * in order — the avatar route's binary bodies are asserted byte-exactly
 * through it (an implicit toString would silently corrupt them).
 */
function makeResponse() {
  const res = { status: null, headers: null, chunks: [], ended: false }
  res.writeHead = (status, headers) => { res.status = status; res.headers = headers }
  res.end = (chunk) => { if (chunk !== undefined && chunk !== null) res.chunks.push(chunk); res.ended = true }
  Object.defineProperty(res, 'body', {
    get: () => res.chunks.map((chunk) => (typeof chunk === 'string' ? chunk : '')).join(''),
  })
  Object.defineProperty(res, 'buffer', {
    get: () => Buffer.concat(res.chunks.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8')))),
  })
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
  {
    webServer: server,
    settings: routeSettings,
    // A roster-shaped stub with nothing installed: buildState classifies
    // against the roster on every state, and an empty one exercises the
    // all-false overlay (the install/update paths get real rosters in 5b).
    agentPresets: { async list() { return [] } },
  },
  { catalog: routeCatalog },
)

assert.deepEqual(
  [...server.routes.keys()].sort(),
  [
    'exact /dsh-workbuddy-market/api/avatar',
    'exact /dsh-workbuddy-market/api/config',
    'exact /dsh-workbuddy-market/api/install',
    'exact /dsh-workbuddy-market/api/refresh',
    'exact /dsh-workbuddy-market/api/state',
    'exact /dsh-workbuddy-market/api/uninstall',
    'exact /dsh-workbuddy-market/api/update',
  ],
  'the seven routes shipped so far (state/avatar/config/refresh + T4 install + T5 update/uninstall) under the plugin prefix',
)
const stateRoute = server.routes.get('exact /dsh-workbuddy-market/api/state')
const avatarRoute = server.routes.get('exact /dsh-workbuddy-market/api/avatar')
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
  assert.ok(payload.experts.every((expert) => expert.installed === false && expert.updatable === false && expert.broken === false),
    'every card carries the three install booleans, all false against an empty roster')
  assert.deepEqual(payload.orphans, [], 'an empty roster reports no orphans')
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

// T6 avatar over the pathology fixture (sourcePath still points here): byte
// streams, the uniform-404 matrix, and the state card's avatarUrl shape.
{
  // 200 hits: a declared plugin.json avatar (solo-one) and a team member's
  // own PNG (team-x-maker, never team.png/first PNG) both serve bytes
  // byte-identical to the source files, with the designed headers.
  for (const [id, sourceRelative] of [
    ['solo-one', join('solo-one', 'avatars', 'solo-one.png')],
    ['team-x-maker', join('team-x', 'avatars', 'team-x-maker.png')],
  ]) {
    const source = readFileSync(join(fixtureRoot, sourceRelative))
    const { response } = await handle(avatarRoute,
      makeRequest({ url: `/dsh-workbuddy-market/api/avatar?id=${id}` }))
    assert.equal(response.status, 200, `${id}: known id with a PNG is a hit`)
    assert.equal(response.headers['content-type'], 'image/png', `${id}: content-type is image/png`)
    assert.equal(response.headers['cache-control'], 'max-age=60',
      `${id}: the design's sole caching exception (every JSON route is no-store)`)
    assert.equal(response.headers['content-length'], String(source.length), `${id}: content-length matches`)
    assert.ok(response.buffer.equals(source), `${id}: served bytes are identical to the source file`)
  }

  // One uniform 404 — unknown id, every ID_RE reject spelling, missing or
  // empty id param, PNG-less expert — and ONE identical body, so the route
  // leaks nothing about which ids exist.
  for (const [label, url] of [
    ['unknown id', '/dsh-workbuddy-market/api/avatar?id=no-such-expert'],
    ['uppercase id', '/dsh-workbuddy-market/api/avatar?id=SOLO-ONE'],
    ['dotdot id', '/dsh-workbuddy-market/api/avatar?id=../solo-one'],
    ['encoded-slash id', '/dsh-workbuddy-market/api/avatar?id=solo%2Fone'],
    ['id with a space', '/dsh-workbuddy-market/api/avatar?id=solo%20one'],
    ['id with a plus', '/dsh-workbuddy-market/api/avatar?id=solo+one'],
    ['empty id', '/dsh-workbuddy-market/api/avatar?id='],
    ['missing id param', '/dsh-workbuddy-market/api/avatar'],
    ['PNG-less expert', '/dsh-workbuddy-market/api/avatar?id=dup-expert'],
  ]) {
    const { response, payload } = await handle(avatarRoute, makeRequest({ url }))
    assert.equal(response.status, 404, `${label} → 404`)
    assert.deepEqual(payload, { error: 'not found' }, `${label}: the uniform body carries no distinguishing detail`)
  }
  assert.equal((await handle(avatarRoute,
    makeRequest({ method: 'POST', url: '/dsh-workbuddy-market/api/avatar?id=solo-one' }))).response.status, 405,
    'non-GET avatar rejected with 405 (state-route parity)')

  // State shape: avatarUrl only where the scan found a PNG; the internal
  // absolute avatarPath never reaches the client payload.
  const { payload } = await handle(stateRoute, makeRequest({ url: '/dsh-workbuddy-market/api/state' }))
  const soloOneCard = payload.experts.find((expert) => expert.id === 'solo-one')
  assert.equal(soloOneCard.avatarUrl, '/dsh-workbuddy-market/api/avatar?id=solo-one',
    'an avatared expert carries its avatarUrl')
  assert.equal('avatarPath' in soloOneCard, false, 'avatarPath is internal — state exposes avatarUrl only')
  for (const id of ['dup-expert', 'solo-three']) {
    const card = payload.experts.find((expert) => expert.id === id)
    assert.equal('avatarUrl' in card, false, `${id}: PNG-less expert carries NO avatarUrl field`)
    assert.equal('avatarPath' in card, false, `${id}: no avatarPath key either (client emoji fallback is #8)`)
  }
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
  installWorkbuddyExpert, installedMarketState, patchPersonaText, patchSkillFilesystemRow,
  skillsManifestOf, uninstallWorkbuddyExpert, updateWorkbuddyExpert,
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
  'the EMPTY skill directory copies too — existence by stat, never by fingerprint rows (#15/#21)')
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
  // start (decision #21) — and a retry restores the working install.
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

// 5b-10 · update (ticket #6): the in-place re-stamp over a live fixture edit.
// The `roster` still carries the restored wb-solo-one install from 5b-7.
{
  const agentMd = join(fixtureRoot, 'solo-one', 'agents', 'solo-one.md')
  const originalMd = readFileSync(agentMd, 'utf8')

  // The trio in ONE edit: changed persona + a NEW skill directory + a
  // DELETED skill directory.
  writeFileSync(agentMd, `${originalMd}\n重打后的 persona：更新闭环专用标记。\n`)
  fixtureWrite('solo-one/skills/added-skill/SKILL.md', 'SKILL: added\n')
  rmSync(join(fixtureRoot, 'solo-one', 'skills', 'main-skill'), { recursive: true, force: true })

  const trioScan = await scanWorkbuddyRoot(fixtureRoot)
  const trioCard = trioScan.experts.find((expert) => expert.id === 'solo-one')
  assert.ok(trioCard !== undefined && trioCard.persona.includes('重打后的 persona'),
    'the edited fixture scans a new persona')
  assert.deepEqual([...trioCard.skills].sort(), ['added-skill', 'empty-skill', 'references'],
    'the scan sees the added skill and no longer lists the deleted one')

  // The overlay classifies BEFORE the update: installed + updatable, not
  // broken, no orphans, no warnings.
  const preState = await installedMarketState(roster, fixtureRoot, trioScan.experts)
  assert.deepEqual(preState.byId.get('solo-one'), { installed: true, updatable: true, broken: false },
    'the manifest fingerprint ≠ the fresh scan fingerprint → updatable')
  assert.deepEqual(preState.orphans, [])
  assert.deepEqual(preState.warnings, [])

  const copiesBefore = roster.calls.copy.length
  const removesBefore = roster.calls.remove.length
  const standingsBefore = roster.calls.standing.length
  const updated = await updateWorkbuddyExpert(roster, trioCard, fixtureRoot)
  assert.equal(updated.presetId, 'wb-solo-one')
  assert.deepEqual(updated.warnings, [],
    'the already-patched composition re-patches without a 「skills 未挂载」 misreport (#7)')
  assert.equal(roster.calls.copy.length, copiesBefore, 'update NEVER re-copies — the directory is rewritten in place')
  assert.equal(roster.calls.remove.length, removesBefore, 'update never removes the preset')
  assert.equal(roster.calls.standing.length, standingsBefore + 1, 'update re-runs the standing mount validation (⑥)')

  const trioComposition = readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8')
  assert.ok(trioComposition.includes(`    text: ${JSON.stringify(trioCard.persona)}`),
    'the updated persona landed as the single-line JSON scalar at the anchored row')
  assert.deepEqual(
    treeOf(join(presetDir, 'skills')).map(([relative]) => relative),
    ['added-skill/SKILL.md', 'references/data.md'],
    'the new skill copied, the source-deleted directory removed, the survivor kept (empty-skill contributes no files)',
  )
  assert.equal(existsSync(join(presetDir, 'skills', 'empty-skill')), true,
    'the EMPTY skill directory still syncs by stat-existence (#15/#21)')
  assert.equal(updated.fingerprint, computeInstallFingerprint(trioCard, smokeSkillsRows(fixtureRoot, trioCard)),
    'the refreshed manifest fingerprint matches an independent source walk')
  const postTrio = await installedMarketState(roster, fixtureRoot, (await scanWorkbuddyRoot(fixtureRoot)).experts)
  assert.deepEqual(postTrio.byId.get('solo-one'), { installed: true, updatable: false, broken: false },
    'after the update the install fingerprint matches the scan again')

  // Description-only edit: the fingerprint covers every persisted field, so
  // a frontmatter description tweak alone flips updatable (#8).
  writeFileSync(agentMd, readFileSync(agentMd, 'utf8').replace(
    'description: Use when asked to review code paths end to end.',
    'description: Edited trigger description for the fingerprint probe.',
  ))
  const descScan = await scanWorkbuddyRoot(fixtureRoot)
  const descCard = descScan.experts.find((expert) => expert.id === 'solo-one')
  const descState = await installedMarketState(roster, fixtureRoot, descScan.experts)
  assert.equal(descState.byId.get('solo-one').updatable, true,
    'a frontmatter description edit alone flips updatable (decision #8)')
  await updateWorkbuddyExpert(roster, descCard, fixtureRoot)
  assert.ok(readFileSync(join(presetDir, 'preset.yml'), 'utf8').includes(JSON.stringify(descCard.description)),
    'preset.yml carries the edited description after the update')
  const postDesc = await installedMarketState(roster, fixtureRoot, (await scanWorkbuddyRoot(fixtureRoot)).experts)
  assert.equal(postDesc.byId.get('solo-one').updatable, false)

  // Touch-only mtime change with NO content change: the disclosed false
  // positive (#18) — updatable reports, and the update is harmless.
  bumpMtime(join(fixtureRoot, 'solo-one', 'skills', 'references', 'data.md'))
  const touchScan = await scanWorkbuddyRoot(fixtureRoot)
  const touchState = await installedMarketState(roster, fixtureRoot, touchScan.experts)
  assert.equal(touchState.byId.get('solo-one').updatable, true,
    'a touch with no content change still reports updatable (disclosed, accepted #18)')
  const compositionBeforeTouch = readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8')
  const treeBeforeTouch = treeOf(presetDir).filter(([relative]) => relative !== MANIFEST_FILE)
  await updateWorkbuddyExpert(roster, touchScan.experts.find((expert) => expert.id === 'solo-one'), fixtureRoot)
  assert.equal(readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8'), compositionBeforeTouch,
    'the touch-triggered update rewrites byte-identical composition (idempotent, harmless)')
  assert.deepEqual(treeOf(presetDir).filter(([relative]) => relative !== MANIFEST_FILE), treeBeforeTouch,
    'and byte-identical products all around (manifest aside)')
  const postTouch = await installedMarketState(roster, fixtureRoot, (await scanWorkbuddyRoot(fixtureRoot)).experts)
  assert.equal(postTouch.byId.get('solo-one').updatable, false,
    'the update stamps the touched fingerprint — no updatable loop')

  // A second update with NOTHING changed: still fine, still no warnings.
  const quietScan = await scanWorkbuddyRoot(fixtureRoot)
  const quietCard = quietScan.experts.find((expert) => expert.id === 'solo-one')
  const again = await updateWorkbuddyExpert(roster, quietCard, fixtureRoot)
  assert.deepEqual(again.warnings, [])
  assert.equal(again.fingerprint, computeInstallFingerprint(quietCard, smokeSkillsRows(fixtureRoot, quietCard)),
    'the quiet re-stamp converges on the same source fingerprint')

  // Update error matrix.
  const bareRoster = makeRoster()
  await assert.rejects(
    () => updateWorkbuddyExpert(bareRoster, soloOne, fixtureRoot),
    /未安装：wb-solo-one/,
    'updating a never-installed expert reports the not-installed error',
  )
  rmSync(bareRoster.dir, { recursive: true, force: true })

  const manifestPath = join(presetDir, MANIFEST_FILE)
  const savedManifest = readFileSync(manifestPath, 'utf8')
  rmSync(manifestPath)
  await assert.rejects(() => updateWorkbuddyExpert(roster, soloOne, fixtureRoot), /清单缺失，请卸载重装/,
    'update over a MISSING manifest reports the #17 error (same wording as install)')
  writeFileSync(manifestPath, '{ not json')
  await assert.rejects(() => updateWorkbuddyExpert(roster, soloOne, fixtureRoot), /清单缺失，请卸载重装/,
    'update over a CORRUPT manifest reports the same #17 error')
  writeFileSync(manifestPath, JSON.stringify({ sourcePath: fixtureRoot }))
  await assert.rejects(() => updateWorkbuddyExpert(roster, soloOne, fixtureRoot), /清单缺失，请卸载重装/,
    'a manifest without a fingerprint is just as unusable (#17 — no guessing)')
  writeFileSync(manifestPath, savedManifest)
  await assert.rejects(
    () => updateWorkbuddyExpert(roster, soloOne, '/definitely/another/source'),
    /该专家已从别的源目录安装/,
    'updating against a different source is refused like a foreign-source install (#9)',
  )
  roster.entries.get('wb-solo-one').trust = 'system'
  await assert.rejects(() => updateWorkbuddyExpert(roster, soloOne, fixtureRoot), /拒绝更新/,
    'a deployment-owned preset is never rewritten in place by the market')
  roster.entries.get('wb-solo-one').trust = 'user'

  // A failed update restores what it rewrote: standingKeyFor throwing after
  // the writes leaves the pre-update texts in place.
  roster.failStanding = true
  await assert.rejects(
    () => updateWorkbuddyExpert(roster, quietScan.experts.find((expert) => expert.id === 'solo-one'), fixtureRoot),
    (error) => /mock mount failure/.test(error.message) && /更新中断/.test(error.message),
    'a mid-update mount failure keeps the original cause and says the update was interrupted',
  )
  assert.equal(readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8'), compositionBeforeTouch,
    'the composition was restored to its pre-update content')
  roster.failStanding = false

  // Restore the fixture to its canonical shape for the blocks below.
  writeFileSync(agentMd, originalMd)
  rmSync(join(fixtureRoot, 'solo-one', 'skills', 'added-skill'), { recursive: true, force: true })
  fixtureWrite('solo-one/skills/main-skill/SKILL.md', 'SKILL: main\n')
}

// 5b-11 · uninstall (ticket #6): the whole directory goes, the roster entry
// goes with it, and nothing the deployment owns is ever removed.
{
  await assert.rejects(() => uninstallWorkbuddyExpert(roster, 'solo-two'), /未安装：wb-solo-two/,
    'uninstalling an expert that was never installed reports the clear error')

  roster.entries.get('wb-solo-one').trust = 'system'
  await assert.rejects(() => uninstallWorkbuddyExpert(roster, 'solo-one'), /拒绝卸载/,
    'a non-user-trust entry is refused (the roster owns system presets)')
  assert.equal(existsSync(presetDir), true, 'the refused uninstall deleted nothing')
  roster.entries.get('wb-solo-one').trust = 'user'

  assert.ok(roster.entries.has('wb-solo-one'), 'scenario anchor: the install exists before uninstalling')
  const removed = await uninstallWorkbuddyExpert(roster, 'solo-one')
  assert.deepEqual(removed, { presetId: 'wb-solo-one' })
  assert.equal(existsSync(presetDir), false,
    'the preset directory is gone WHOLE — skills tree and manifest with it')
  assert.equal(roster.entries.has('wb-solo-one'), false, 'the roster no longer lists it')
  assert.ok(roster.calls.remove.includes('wb-solo-one'), 'the removal went through agentPresets.remove')

  const after = await installedMarketState(roster, fixtureRoot, (await scanWorkbuddyRoot(fixtureRoot)).experts)
  assert.equal(after.byId.size, 0, 'no install flags remain')
  assert.deepEqual(after.orphans, [], 'uninstalling is NOT orphaning — nothing lingers')
  assert.deepEqual(after.warnings, [])
}

// 5b-12 · the routes end to end (ticket #6): state flags through /api/state
// with the real catalog (auto-rescan on fixture edits), the update/uninstall
// routes in the shared lane, source-switch orphans, and broken manifests.
{
  const server4 = makeFakeServer()
  const roster4 = makeRoster()
  const settings4 = makeFakeSettings()
  const catalog4 = createCatalog()
  const offSettings4 = mountWorkbuddySettings(settings4, fakeZ, catalog4)
  await settings4.update(SETTINGS_NS, { sourcePath: fixtureRoot })
  const offRoutes4 = mountWorkbuddyMarketRoutes(
    { webServer: server4, settings: settings4, agentPresets: roster4 },
    { catalog: catalog4 },
  )
  const stateRoute4 = server4.routes.get('exact /dsh-workbuddy-market/api/state')
  const installRoute4 = server4.routes.get('exact /dsh-workbuddy-market/api/install')
  const updateRoute4 = server4.routes.get('exact /dsh-workbuddy-market/api/update')
  const uninstallRoute4 = server4.routes.get('exact /dsh-workbuddy-market/api/uninstall')
  const configRoute4 = server4.routes.get('exact /dsh-workbuddy-market/api/config')
  const getState4 = async () => (await handle(stateRoute4, makeRequest({ url: '/dsh-workbuddy-market/api/state' }))).payload
  const post4 = (route, body) => handle(route, makeRequest({
    method: 'POST', headers: SAME_ORIGIN, chunks: [Buffer.from(JSON.stringify(body))],
  }))

  // Guards on both new routes: 405/403 like every mutating route.
  for (const [label, route] of [['update', updateRoute4], ['uninstall', uninstallRoute4]]) {
    assert.equal((await handle(route, makeRequest({ method: 'GET', headers: SAME_ORIGIN }))).response.status, 405,
      `non-POST ${label} rejected with 405`)
    assert.equal((await handle(route, makeRequest({ method: 'POST' }))).response.status, 403,
      `origin-less ${label} rejected with 403`)
  }

  // The lane is shared: an update held on a gated body holds config to 409.
  {
    let release
    const gate = new Promise((resolve) => { release = resolve })
    const heldRequest = {
      method: 'POST',
      url: '/dsh-workbuddy-market/api/update',
      headers: SAME_ORIGIN,
      [Symbol.asyncIterator]: async function* () {
        await gate
        yield Buffer.from(JSON.stringify({ id: 'solo-one' }))
      },
    }
    const heldResponse = makeResponse()
    const heldCall = updateRoute4.handler(heldRequest, heldResponse)
    const during = await post4(configRoute4, { sourcePath: fixtureRoot })
    assert.equal(during.response.status, 409, 'an in-flight update holds the shared mutation lane')
    release()
    await heldCall
    assert.equal(heldResponse.status, 400, 'the held update ran (and failed: nothing installed yet)')
    assert.match(JSON.parse(heldResponse.body).error, /未安装/)
  }

  // install → state flags installed, not updatable, not broken.
  const installed4 = await post4(installRoute4, { id: 'solo-one' })
  assert.equal(installed4.response.status, 200, `route install succeeds: ${installed4.response.body}`)
  let state4 = await getState4()
  let card4 = state4.experts.find((expert) => expert.id === 'solo-one')
  assert.deepEqual(
    { installed: card4.installed, updatable: card4.updatable, broken: card4.broken },
    { installed: true, updatable: false, broken: false },
    'the state card reports the fresh install',
  )
  assert.ok(state4.experts.every((expert) => expert.id === 'solo-one'
    || (expert.installed === false && expert.updatable === false && expert.broken === false)),
    'every OTHER card carries the all-false overlay')
  assert.deepEqual(state4.orphans, [])

  // A roster-reported broken preset (its own discovery reason) also flags
  // the card broken — design §5: broken 兼指 roster 挂载失败与 manifest 丢失.
  roster4.entries.get('wb-solo-one').broken = 'composition not parsable'
  state4 = await getState4()
  card4 = state4.experts.find((expert) => expert.id === 'solo-one')
  assert.deepEqual(
    { installed: card4.installed, updatable: card4.updatable, broken: card4.broken },
    { installed: true, updatable: false, broken: true },
    'a roster-mount failure marks the card broken (never updatable alongside)',
  )
  assert.ok(state4.warnings.some((warning) => warning.includes('preset 无法挂载')),
    "the roster's own reason surfaces as a warning")
  roster4.entries.get('wb-solo-one').broken = undefined
  state4 = await getState4()
  assert.equal(state4.experts.find((expert) => expert.id === 'solo-one').broken, false,
    'clearing the roster reason clears the flag')

  // Fixture edit → the NEXT state auto-rescans (catalog fingerprint) and
  // flips updatable: the source-update detection loop, closed.
  writeFileSync(join(fixtureRoot, 'solo-one', 'agents', 'solo-one.md'),
    `${readFileSync(join(fixtureRoot, 'solo-one', 'agents', 'solo-one.md'), 'utf8')}\n路由级更新标记。\n`)
  state4 = await getState4()
  assert.equal(state4.experts.find((expert) => expert.id === 'solo-one').updatable, true,
    'a source edit flips updatable through /api/state with no refresh call')

  const upd4 = await post4(updateRoute4, { id: 'solo-one' })
  assert.equal(upd4.response.status, 200, `route update succeeds: ${upd4.response.body}`)
  assert.equal(upd4.payload.ok, true)
  assert.equal(upd4.payload.presetId, 'wb-solo-one')
  assert.deepEqual(upd4.payload.warnings, [])
  state4 = await getState4()
  assert.equal(state4.experts.find((expert) => expert.id === 'solo-one').updatable, false,
    'the update cleared the flag')

  // Source switch → the install becomes an orphan: reported with its
  // provenance, never auto-uninstalled.
  const sourceAlt = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-alt-'))
  const altWrite = (relative, content) => {
    const path = join(sourceAlt, relative)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  altWrite('alt-plugin/agents/alt-expert.md',
    '---\nname: alt-expert\ndescription: The other source\'s expert.\n---\n\n另一源的正主。\n')
  altWrite('alt-plugin/.codebuddy-plugin/plugin.json', JSON.stringify({ name: 'alt-plugin' }))

  const switched = await post4(configRoute4, { sourcePath: sourceAlt })
  assert.equal(switched.response.status, 200)
  state4 = switched.payload
  assert.deepEqual(state4.experts.map((expert) => expert.id), ['alt-expert'],
    'the new source serves its own (uninstalled) expert')
  assert.equal(state4.experts[0].installed, false)
  assert.equal(state4.orphans.length, 1, 'the old install surfaces as exactly one orphan')
  const orphan4 = state4.orphans[0]
  assert.equal(orphan4.id, 'solo-one')
  assert.equal(orphan4.presetId, 'wb-solo-one')
  assert.equal(orphan4.name, 'wb-solo-one', 'name falls back to the preset id when the roster publishes none')
  assert.equal(orphan4.sourcePath, fixtureRoot, 'the orphan records the source it was installed from')
  assert.equal(orphan4.pluginDir, 'solo-one')
  assert.equal(orphan4.agentFile, 'solo-one.md')
  assert.equal(orphan4.broken, false)
  // NEVER auto-uninstalled: roster entry and directory both survive.
  assert.ok(roster4.entries.has('wb-solo-one'), 'the orphaned preset stays on the roster')
  assert.equal(existsSync(join(roster4.dir, 'wb-solo-one')), true, '…and its directory stays on disk')

  // An orphan is uninstallable BY ID — the designed cleanup path (#9),
  // no scan-table membership required.
  const un4 = await post4(uninstallRoute4, { id: 'solo-one' })
  assert.equal(un4.response.status, 200, `orphan uninstall succeeds: ${un4.response.body}`)
  assert.equal(un4.payload.presetId, 'wb-solo-one')
  assert.equal(roster4.entries.has('wb-solo-one'), false)
  state4 = await getState4()
  assert.deepEqual(state4.orphans, [], 'the orphan is gone after the explicit uninstall')

  // Switching BACK restores the expert table; nothing is installed now.
  await post4(configRoute4, { sourcePath: fixtureRoot })
  state4 = await getState4()
  card4 = state4.experts.find((expert) => expert.id === 'solo-one')
  assert.deepEqual(
    { installed: card4.installed, updatable: card4.updatable, broken: card4.broken },
    { installed: false, updatable: false, broken: false },
    'switching back shows the expert uninstalled (the uninstall really removed it)',
  )

  // Broken manifest: the card goes broken + the #17 warning; install AND
  // update refuse with the same wording; uninstall remains the recovery.
  const reinstalled4 = await post4(installRoute4, { id: 'solo-one' })
  assert.equal(reinstalled4.response.status, 200)
  writeFileSync(join(roster4.dir, 'wb-solo-one', MANIFEST_FILE), '{ not json')
  state4 = await getState4()
  card4 = state4.experts.find((expert) => expert.id === 'solo-one')
  assert.deepEqual(
    { installed: card4.installed, updatable: card4.updatable, broken: card4.broken },
    { installed: true, updatable: false, broken: true },
    'a corrupt manifest marks the card broken (never updatable alongside)',
  )
  assert.ok(state4.warnings.some((warning) => warning.includes('清单缺失，请卸载重装')),
    'the state surfaces the #17 warning text')
  const badInstall4 = await post4(installRoute4, { id: 'solo-one' })
  assert.equal(badInstall4.response.status, 400)
  assert.match(badInstall4.payload.error, /清单缺失，请卸载重装/, 'install over the broken manifest reports the #17 error')
  const badUpdate4 = await post4(updateRoute4, { id: 'solo-one' })
  assert.equal(badUpdate4.response.status, 400)
  assert.match(badUpdate4.payload.error, /清单缺失，请卸载重装/, 'update over the broken manifest reports the same error')
  const recover4 = await post4(uninstallRoute4, { id: 'solo-one' })
  assert.equal(recover4.response.status, 200, 'uninstall is the designed recovery and needs no manifest')
  state4 = await getState4()
  assert.ok(!state4.warnings.some((warning) => warning.includes('清单缺失')),
    'the #17 warning disappears with the uninstalled preset')

  // Uninstall route validation: unknown ids and non-ID_RE shapes.
  for (const id of ['no-such-expert', '../etc', 'SOLO-ONE', 'solo one']) {
    const res = await post4(uninstallRoute4, { id })
    assert.equal(res.response.status, 400, `uninstall id "${id}" rejected with 400`)
  }

  offRoutes4()
  assert.equal(server4.routes.size, 0)
  offSettings4()
  rmSync(roster4.dir, { recursive: true, force: true })
  rmSync(sourceAlt, { recursive: true, force: true })
}

// ── 5c. avatar traversal armor (ticket #7) over a dedicated escape fixture ───
//
// The scanner existence-checks a DECLARED plugin.json avatar with stat —
// which normalizes `..` and follows symlinks — so the scan table itself can
// legitimately carry an avatarPath resolving outside the source root. The
// route's realpath-both-sides containment must 404 those however they are
// spelled, while an innocent avatar in the very same tree still serves.
{
  const escapeRoot = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-avatar-'))
  const outsidePath = join(tmpdir(), 'dsh-workbuddy-market-avatar-outside.png')
  writeFileSync(outsidePath, Buffer.from('89504e470d0a1a0a-outside-png'))
  const escapeWrite = (relativePath, content) => {
    const path = join(escapeRoot, relativePath)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }

  // Innocent plugin: a plain avatars/ PNG inside the root.
  escapeWrite('honest/agents/honest.md', '---\nname: honest\ndescription: innocent probe\n---\n\n正文。\n')
  escapeWrite('honest/avatars/honest.png', Buffer.from('89504e470d0a1a0a-honest-png'))
  escapeWrite('honest/.codebuddy-plugin/plugin.json', JSON.stringify({ name: 'honest' }))

  // `..` escape: the declared avatar is a relative path walking out of the
  // root to a REAL file (so the scanner's existence check accepts it).
  escapeWrite('dotdot/agents/dotdot.md', '---\nname: dotdot\ndescription: escape probe one\n---\n\n正文。\n')
  escapeWrite('dotdot/.codebuddy-plugin/plugin.json', JSON.stringify({
    name: 'dotdot',
    avatar: relative(join(escapeRoot, 'dotdot'), outsidePath),
  }))

  // Symlink escape: same outside file, reached through a link inside the
  // plugin (stat follows links, so the scanner accepts this one too).
  const escapees = ['dotdot']
  if (process.platform !== 'win32') {
    escapeWrite('linker/agents/linker.md', '---\nname: linker\ndescription: escape probe two\n---\n\n正文。\n')
    mkdirSync(join(escapeRoot, 'linker', 'avatars'), { recursive: true })
    symlinkSync(outsidePath, join(escapeRoot, 'linker', 'avatars', 'link.png'))
    escapeWrite('linker/.codebuddy-plugin/plugin.json', JSON.stringify({ name: 'linker', avatar: 'avatars/link.png' }))
    escapees.push('linker')
  }

  // Scenario anchors — the escapes are REAL: both cards carry an avatarPath
  // whose realpath sits outside the (realpath'd) source root, so the guard
  // below is exercised against an actual traversal, not a vacuous miss.
  const escapeScan = await scanWorkbuddyRoot(escapeRoot)
  const realEscapeRoot = realpathSync(escapeRoot)
  const realOutside = realpathSync(outsidePath)
  assert.ok(relative(realEscapeRoot, realOutside).startsWith('..'),
    'scenario anchor: the outside file truly lies outside the source root')
  for (const id of escapees) {
    const card = escapeScan.experts.find((expert) => expert.id === id)
    assert.ok(card !== undefined && typeof card.avatarPath === 'string', `${id}: the scan emitted a card with a declared avatar`)
    assert.equal(realpathSync(card.avatarPath), realOutside,
      `${id}: the declared avatar really resolves to the outside file (traversal is live)`)
  }

  const server3 = makeFakeServer()
  const settings3 = makeFakeSettings()
  const catalog3 = createCatalog()
  const offSettings3 = mountWorkbuddySettings(settings3, fakeZ, catalog3)
  await settings3.update(SETTINGS_NS, { sourcePath: escapeRoot })
  const offRoutes3 = mountWorkbuddyMarketRoutes(
    { webServer: server3, settings: settings3, agentPresets: { async list() { return [] } } },
    { catalog: catalog3 },
  )
  const avatarRoute3 = server3.routes.get('exact /dsh-workbuddy-market/api/avatar')
  const stateRoute3 = server3.routes.get('exact /dsh-workbuddy-market/api/state')

  const hit = await handle(avatarRoute3, makeRequest({ url: '/dsh-workbuddy-market/api/avatar?id=honest' }))
  assert.equal(hit.response.status, 200, 'the innocent avatar in the same tree is a hit')
  assert.ok(hit.response.buffer.equals(readFileSync(join(escapeRoot, 'honest', 'avatars', 'honest.png'))),
    '…and serves byte-identical bytes')

  for (const id of escapees) {
    const miss = await handle(avatarRoute3, makeRequest({ url: `/dsh-workbuddy-market/api/avatar?id=${id}` }))
    assert.equal(miss.response.status, 404, `${id}: an avatar resolving outside the root 404s`)
    assert.deepEqual(miss.payload, { error: 'not found' }, `${id}: same uniform body as every other miss`)
  }

  // A read failing AFTER containment (unix, non-root: an unreadable file)
  // answers the same uniform 404 — never a 500 leaking filesystem detail.
  if (process.platform !== 'win32' && (typeof process.getuid === 'function' ? process.getuid() !== 0 : true)) {
    const lockedPath = join(escapeRoot, 'honest', 'avatars', 'honest.png')
    chmodSync(lockedPath, 0o000)
    const denied = await handle(avatarRoute3, makeRequest({ url: '/dsh-workbuddy-market/api/avatar?id=honest' }))
    assert.equal(denied.response.status, 404, 'a post-containment read failure 404s (no 500)')
    assert.deepEqual(denied.payload, { error: 'not found' }, '…with the same no-detail body')
    chmodSync(lockedPath, 0o644)
  }

  // State still offers avatarUrl for the escapees — the ROUTE is the guard
  // (#13's client onError → emoji fallback, ticket #8, covers the display).
  const escapeState = await handle(stateRoute3, makeRequest({ url: '/dsh-workbuddy-market/api/state' }))
  assert.equal(escapeState.payload.experts.find((expert) => expert.id === 'dotdot').avatarUrl,
    '/dsh-workbuddy-market/api/avatar?id=dotdot',
    'state shape is untouched by the escape (the route answers 404 for it)')

  offRoutes3()
  offSettings3()
  rmSync(escapeRoot, { recursive: true, force: true })
  rmSync(outsidePath, { force: true })
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

// ── 6. client bundle (ticket #8): load, register, render, dispose ───────────
//
// The stub module loader reprises the sister plugin's technique — a fake
// __ModuleLoader__ captures the definition — with two upgrades this section
// needs: the document stub is FUNCTIONAL (querySelector really finds the
// injected style tags, tag.remove() really detaches them) so the disposer
// assertions are honest, and the React stub's useState actually stores, so
// driving onError and re-rendering runs real component logic rather than
// first-paint shapes only.

const clientCode = await readFile(join(root, 'client', 'client.js'), 'utf8')
let loaded = null
globalThis.window = { __ModuleLoader__: { load(def) { loaded = def } } }
const styleTags = []
globalThis.document = {
  querySelector: (selector) => {
    const match = /^style\[data-plugin-css="(.+)"\]$/.exec(selector)
    if (match === null) return null
    return styleTags.find((tag) => tag.dataset.pluginCss === match[1]) ?? null
  },
  // The summon button's healthy-empty path walks the settings dialog's nav
  // (openMarketSettings); under this stub it finds nothing and stays inert.
  querySelectorAll: () => [],
  createElement: () => ({
    dataset: {},
    textContent: '',
    remove () {
      const at = styleTags.indexOf(this)
      if (at >= 0) styleTags.splice(at, 1)
    },
  }),
  head: { appendChild: (tag) => styleTags.push(tag) },
}
;(0, eval)(clientCode)

assert.ok(loaded, '__ModuleLoader__.load received the definition')
assert.equal(loaded.id, 'dsh-workbuddy-market')

// React stub: createElement produces plain trees; useState AND useRef store
// per hook slot so a later render of the same "mount" observes setter
// mutations AND a stable ref identity (a fresh object per render would break
// exactly the async draft flows this section drives). resetMount() starts a
// fresh mount; render() just rewinds the hook cursor.
let hookIndex = 0
const hookStates = []
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => {
    const at = hookIndex++
    if (hookStates.length <= at) hookStates[at] = typeof initial === 'function' ? initial() : initial
    return [hookStates[at], (next) => {
      hookStates[at] = typeof next === 'function' ? next(hookStates[at]) : next
    }]
  },
  useEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (value) => {
    const at = hookIndex++
    if (hookStates.length <= at) hookStates[at] = { current: value }
    return hookStates[at]
  },
}
const resetMount = () => { hookStates.length = 0 }
const render = (component, props) => { hookIndex = 0; return component(props) }

// Resolve function components in a freshly rendered tree ONCE, in tree
// order — the same discipline React follows, so the cards' useState slots
// line up behind the page's own hooks on the shared stub.
function expandTree (node) {
  if (Array.isArray(node)) return node.map(expandTree)
  if (node === null || node === undefined) return node
  if (typeof node === 'object' && typeof node.type !== 'undefined') {
    if (typeof node.type === 'function') return expandTree(node.type(node.props))
    return { ...node, children: expandTree(node.children) }
  }
  return node
}

const clientModule = loaded.factory((id) => {
  if (id === 'react') return reactStub
  throw new Error('unexpected require: ' + id)
})
assert.equal(clientModule.name, 'dsh-workbuddy-market')
assert.deepEqual(clientModule.inject, ['slots', 'locale'], 'services declared before property access')
assert.equal(typeof clientModule.apply, 'function')
assert.equal(styleTags.length, 0, 'the scoped style waits for apply (the disposer owns it)')

// Dictionaries stay zh/en aligned, every market-page key present on both sides.
assert.deepEqual(
  Object.keys(clientModule.DICTS.zh).sort(),
  Object.keys(clientModule.DICTS.en).sort(),
  'zh/en key sets aligned',
)
for (const key of ['nav', 'title', 'subtitle', 'censusExperts', 'censusPlugins', 'censusCategories', 'search',
  'filterAll', 'filterInstalled', 'filterUpdatable', 'filterSkills', 'filterTeam',
  'categoryAll', 'categoryNone', 'categoryRowLabel',
  'matchesPlain', 'matchesEcho', 'emptyHint', 'emptyTip', 'clearFilters',
  'bannerMissingPath', 'bannerMissingHint', 'warningsToggle', 'loadFailed', 'retry', 'busy',
  'installedStamp', 'updatableStamp', 'brokenStamp', 'skillsBadge', 'teamBadge',
  // #9: the mutating half
  'pathLabel', 'apply', 'applying', 'refreshBtn', 'pathApplied', 'configFailed', 'refreshFailed',
  'conflictTitle', 'conflictDetail', 'conflictRetry', 'laneBusy',
  'installBtn', 'updateBtn', 'uninstallBtn',
  'confirmInstall', 'confirmUpdate', 'confirmUninstall', 'cancel', 'actionBusy',
  'installDone', 'updateDone', 'uninstallDone',
  'installFailed', 'updateFailed', 'uninstallFailed',
  'orphansTitle', 'orphansHint', 'orphanBroken', 'orphanImported',
  // #12 (P4): team group view + bulk update
  'groupExpand', 'groupCollapse', 'groupMembers', 'installedCount', 'updatableCount', 'brokenCount',
  'bulkUpdateBtn', 'bulkRunning', 'bulkFailedBody', 'bulkContinue', 'bulkDismiss', 'bulkDoneNotice',
  // #11: the summon entry points
  'summonButtonTitle', 'summonButtonLabel', 'summonMenuTitle', 'summonMenuEmpty',
  'summonFilter', 'summonFootnote', 'summonInstruction', 'summonInstructionWithTask',
  'triggerSection']) {
  assert.ok(clientModule.DICTS.zh[key] !== undefined, `zh dict has ${key}`)
  assert.ok(clientModule.DICTS.en[key] !== undefined, `en dict has ${key}`)
}

// Stub-tree walkers: every element node, and the concatenated text.
function treeNodes (node) {
  const out = []
  const walk = (current) => {
    if (Array.isArray(current)) { current.forEach(walk); return }
    if (current === null || current === undefined) return
    if (typeof current === 'object' && typeof current.type !== 'undefined') {
      out.push(current)
      walk(current.children)
    }
  }
  walk(node)
  return out
}
function treeText (node) {
  let text = ''
  const walk = (current) => {
    if (Array.isArray(current)) { current.forEach(walk); return }
    if (typeof current === 'string') { text += current; return }
    if (typeof current === 'number') { text += String(current); return }
    if (current !== null && typeof current === 'object' && typeof current.type !== 'undefined') {
      walk(current.children)
    }
  }
  walk(node)
  return text
}
const interp = (template, params) =>
  (params ? template.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m)) : template)
const tZh = (key, params) => interp(clientModule.DICTS.zh[key] ?? key, params)
const tEn = (key, params) => interp(clientModule.DICTS.en[key] ?? key, params)

// The fixture cards the derivations and renders run against.
const cardAvatar = {
  id: 'backend-architect', name: 'Backend Architect', zhName: '后端架构师',
  description: 'Use when designing APIs.', zhDescription: '设计后端接口时使用。',
  skills: [], pluginDir: 'backend-architect', teamSize: 1, category: '02-Engineering',
  avatarUrl: '/dsh-workbuddy-market/api/avatar?id=backend-architect',
}
const cardTeam = {
  id: 'team-lead', name: 'Team Lead', zhName: '队长',
  description: 'Leads the team.', zhDescription: '带队交付。',
  skills: ['main-skill', 'references'], pluginDir: 'mvp-dev-team', teamSize: 8,
  category: '06-ContentCreative', installed: true, updatable: true,
}
const cardBroken = {
  id: 'gone', name: 'Gone', zhName: '消失的', description: 'Manifest missing.', zhDescription: '清单缺失。',
  skills: [], pluginDir: 'gone-plugin', teamSize: 1, broken: true,
}
const CARDS = [cardAvatar, cardTeam, cardBroken]
const idsOf = (cards) => cards.map((card) => card.id)

// Pure filter derivations: the five chip states.
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '')), ['backend-architect', 'team-lead', 'gone'])
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'installed', '')), ['team-lead'],
  'installed chip filters on installed === true (absent fields simply never match)')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'updatable', '')), ['team-lead'])
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'skills', '')), ['team-lead'])
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'team', '')), ['team-lead'])

// Bilingual search: zh hits zh fields, en hits base fields, and the BASE
// fields stay in the haystack under every query (cross-language invariant).
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '后端')), ['backend-architect'],
  'a Chinese query hits the zhName')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', 'architect')), ['backend-architect'],
  'an English query hits the base name')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '设计后端')), ['backend-architect'],
  'a Chinese query hits the zhDescription')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', 'manifest')), ['gone'],
  'the BASE description always matches — even under a zh-shaped corpus entry')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'team', '带队')), ['team-lead'],
  'query and chip filter compose')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', 'mvp-dev-team')), ['team-lead'],
  'the source plugin dir is searchable')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', 'main-skill')), ['team-lead'],
  'skill names are searchable')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '  GONE  ')), ['gone'],
  'the query is trimmed and case-folded')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '不存在')),
  [], 'a non-matching query yields nothing')

// ── the category dimension (#23) ─────────────────────────────────────────────

// Labels: the known map localizes, an unknown id degrades to its
// prefix-stripped raw name in BOTH languages, absent stays ''.
assert.equal(clientModule.categoryOf(cardAvatar), '02-Engineering', 'categoryOf reads the raw card field')
assert.equal(clientModule.categoryOf(cardBroken), '', 'an uncategorized card reads as empty')
assert.equal(clientModule.categoryLabelOf('02-Engineering', 'zh'), '工程开发', 'known id localizes (zh)')
assert.equal(clientModule.categoryLabelOf('02-Engineering', 'en'), 'Engineering', 'known id localizes (en)')
assert.equal(clientModule.categoryLabelOf('77-Future-Tech', 'zh'), 'Future-Tech',
  'unknown id falls back to the prefix-stripped raw name (zh)')
assert.equal(clientModule.categoryLabelOf('77-Future-Tech', 'en'), 'Future-Tech',
  'unknown id falls back to the prefix-stripped raw name (en)')
assert.equal(clientModule.categoryLabelOf('06-ContentCreative', 'zh'), '内容创作')
assert.equal(clientModule.categoryLabelOf('', 'zh'), '', 'no category, no label')

// Chip derivation: raw ids in marketplace order with live counts, the
// uncategorized sentinel LAST — and only when some card lacks a category.
assert.deepEqual(clientModule.categoryChipsOf(CARDS), [
  { id: '02-Engineering', count: 1 },
  { id: '06-ContentCreative', count: 1 },
  { id: clientModule.NO_CATEGORY, count: 1 },
], 'chips derive from the table: sorted raw ids, uncategorized last')
assert.deepEqual(clientModule.categoryChipsOf([cardAvatar, { ...cardTeam, category: '02-Engineering' }]),
  [{ id: '02-Engineering', count: 2 }],
  'no uncategorized cards → no sentinel chip')

// The 4th filterExperts dimension: raw id and sentinel keys, composing with
// the status chips and the free-text query; omitted → everything.
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '')), ['backend-architect', 'team-lead', 'gone'],
  'no category argument keeps the whole table (backward-compatible default)')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '', 'all')),
  ['backend-architect', 'team-lead', 'gone'], "the 'all' chip keeps everything")
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '', '02-Engineering')),
  ['backend-architect'], 'a raw categoryId chip narrows to its cards')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '', clientModule.NO_CATEGORY)),
  ['gone'], 'the uncategorized chip catches category-less cards only')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'installed', '', '06-ContentCreative')),
  ['team-lead'], 'category composes with the status chips')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'installed', '', '02-Engineering')),
  [], 'status × category compose to nothing when they disagree')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '架构', '06-ContentCreative')),
  [], 'a non-matching query stays empty inside a category')

// The category joins the search haystack under every spelling: raw id, the
// zh label, the en label — cross-language, like the name fields.
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', 'engineering')), ['backend-architect'],
  'the en category label is searchable')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '工程开发')), ['backend-architect'],
  'the zh category label is searchable')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '02-engineering')), ['backend-architect'],
  'the raw category id is searchable (case-folded)')
assert.deepEqual(idsOf(clientModule.filterExperts(CARDS, 'all', '内容创作')), ['team-lead'],
  'another zh label matches only its own cards')

// Localization chains: localized field first, base field as fallback.
assert.equal(clientModule.localeNameOf(cardAvatar, 'zh'), '后端架构师')
assert.equal(clientModule.localeNameOf(cardAvatar, 'en'), 'Backend Architect')
assert.equal(clientModule.localeDescriptionOf(cardAvatar, 'zh'), '设计后端接口时使用。')
assert.equal(clientModule.localeDescriptionOf(cardAvatar, 'en'), 'Use when designing APIs.')
{
  const enOnly = { ...cardAvatar, zhDescription: undefined }
  assert.equal(clientModule.localeDescriptionOf(enOnly, 'zh'), 'Use when designing APIs.',
    'a missing zhDescription falls back to the base description under zh')
  const noZhName = { ...cardAvatar, zhName: undefined }
  assert.equal(clientModule.localeNameOf(noZhName, 'zh'), 'Backend Architect',
    'a missing zhName falls back to the base name under zh')
}

// Card renders — avatared card: a real <img> with the route URL and an
// onError hook; zh locale names/descriptions; badges; NO status marks for a
// card that carries no install state (the tolerant #8 contract).
resetMount()
let cardTree = expandTree(render(clientModule.ExpertCard, { t: tZh, expert: cardAvatar, localeId: 'zh' }))
let imgNode = treeNodes(cardTree).find((node) => node.type === 'img')
assert.ok(imgNode !== undefined, 'an avatared card renders an img')
assert.equal(imgNode.props.src, cardAvatar.avatarUrl, 'the img src is the avatar route URL')
assert.equal(typeof imgNode.props.onError, 'function', 'the img carries the onError hook')
{
  const text = treeText(cardTree)
  assert.ok(text.includes('后端架构师'), 'zh card shows the zhName')
  assert.ok(text.includes('设计后端接口时使用。'), 'zh card shows the zhDescription')
  assert.ok(text.includes('backend-architect'), 'the source plugin dir badge is present')
  assert.ok(text.includes('工程开发'), 'the category badge shows the localized label (#23)')
  assert.ok(treeNodes(cardTree).some((node) =>
    node.type === 'span' && node.props.className === 'wbm-badge' && node.props['data-kind'] === 'category'),
    'the category badge is its own badge kind')
  assert.ok(!text.includes('技能'), 'a zero-skills card carries no skills badge')
  assert.ok(!text.includes('团队'), 'a solo card carries no team badge')
}
assert.equal(treeNodes(cardTree).find((node) => node.props && node.props.className === 'wbm-status'),
  undefined, 'a card without install-state fields shows NO status marks')

// onError → the static emoji, and the img (its request) is gone entirely —
// the fallback never issues a second network request.
imgNode.props.onError()
cardTree = expandTree(render(clientModule.ExpertCard, { t: tZh, expert: cardAvatar, localeId: 'zh' }))
assert.equal(treeNodes(cardTree).find((node) => node.type === 'img'), undefined,
  'after onError the img is unmounted (no placeholder request can follow)')
assert.ok(treeText(cardTree).includes(clientModule.AVATAR_EMOJI), 'the static emoji takes over')
assert.equal(clientModule.AVATAR_EMOJI, '🧑‍💻', 'the fallback is the designed static glyph')

// A PNG-less card (scan found no avatar) starts at the emoji.
resetMount()
cardTree = expandTree(render(clientModule.ExpertCard, { t: tZh, expert: { ...cardBroken, avatarUrl: undefined }, localeId: 'zh' }))
assert.equal(treeNodes(cardTree).find((node) => node.type === 'img'), undefined)
assert.ok(treeText(cardTree).includes(clientModule.AVATAR_EMOJI))

// Team card: skills + team badges and the tolerant ✓ / ↑ marks.
resetMount()
cardTree = render(clientModule.ExpertCard, { t: tZh, expert: cardTeam, localeId: 'zh' })
{
  const text = treeText(cardTree)
  assert.ok(text.includes('技能 2'), 'skills badge counts the scan-card skills')
  assert.ok(text.includes('团队 ·8'), 'team badge carries the team size')
  assert.ok(text.includes('✓ 已装'), 'installed mark renders when the field is true')
  assert.ok(text.includes('↑ 可更新'), 'updatable mark renders when the field is true')
  assert.ok(!text.includes('⚠'), 'no broken mark without a broken field')
}

// Broken card: the ⚠ mark and nothing else.
resetMount()
cardTree = render(clientModule.ExpertCard, { t: tZh, expert: cardBroken, localeId: 'zh' })
{
  const text = treeText(cardTree)
  assert.ok(text.includes('⚠ 预设损坏'), 'broken mark renders when the field is true')
  assert.ok(!text.includes('✓'), 'no installed mark without the field')
  assert.ok(!text.includes('↑'), 'no updatable mark without the field')
  assert.ok(!treeNodes(cardTree).some((node) =>
    node.props && node.props.className === 'wbm-badge' && node.props['data-kind'] === 'category'),
    'an uncategorized card carries no category badge (absent, never 未分类)')
}

// The page over an injected snapshot (the initialState seam): the yellow
// banner appears when pathExists=false and clears once the path is fixed;
// warnings fold collapsed by default; census counts; cards render.
const missingState = {
  sourcePath: '/definitely/not/here', pathExists: false, revision: 3,
  experts: CARDS, orphans: [], warnings: ['broken-one: plugin skipped (plugin.json corrupt)', 'another warning'],
}
resetMount()
let pageTree = expandTree(render(clientModule.MarketPage, { t: tZh, getLocale: () => 'zh', initialState: missingState }))
{
  const nodes = treeNodes(pageTree)
  const banner = nodes.find((node) => node.props && node.props.className === 'wbm-banner')
  assert.ok(banner !== undefined, 'pathExists=false renders the yellow banner')
  assert.equal(banner.props.role, 'alert', 'the banner is an alert')
  const text = treeText(pageTree)
  assert.ok(text.includes('源路径不存在：'), 'banner headline text')
  assert.ok(text.includes('/definitely/not/here'), 'banner names the raw stored path')
  assert.ok(text.includes('专家 3'), 'census counts the experts')
  assert.ok(text.includes('来源插件 3'), 'census counts the source plugins')
  assert.ok(text.includes('分类 2'), 'census counts the distinct non-empty categories (#23)')
  assert.ok(text.includes('后端架构师'), 'the solo card renders from the snapshot')
  assert.ok(text.includes('mvp-dev-team') && text.includes('团队 ·8'),
    'the team member renders as its collapsed group header (#12: members fold behind it)')
  assert.ok(!text.includes('带队交付'), 'a collapsed group hides its member card bodies')
  assert.ok(text.includes('扫描警告 2 条'), 'the warnings fold announces its count')
  assert.equal(nodes.find((node) => node.props && node.props.className === 'wbm-warns-list'), undefined,
    'warnings are collapsed by default')

  // The category chip row (#23): the all chip leads with the table total,
  // then per-category chips with live counts, uncategorized last.
  const catRow = nodes.find((node) => node.props && node.props.className === 'wbm-catrow')
  assert.ok(catRow !== undefined, 'the category chip row renders when any category exists')
  assert.equal(catRow.props.role, 'group', 'the row is a labeled group')
  const catButtons = treeNodes(catRow).filter((node) => node.type === 'button')
  assert.deepEqual(catButtons.map((button) => treeText(button)),
    ['全部分类3', '工程开发1', '内容创作1', '未分类1'],
    'chips: all + localized categories + uncategorized last, each with its live count')
  assert.equal(catButtons[1].props.title, '02-Engineering',
    'a category chip titles with its raw id (the verbatim filter key)')
  assert.equal(catButtons[3].props.title, undefined, 'the uncategorized chip carries no raw-id title')
  assert.equal(catButtons[0].props['aria-pressed'], 'true', 'the all chip starts pressed')

  // Click 工程开发 → only that category's cards stay, matchline follows,
  // and the team group auto-expands under the now-active filter — the same
  // fold rule as the status chips.
  catButtons[1].props.onClick()
  let filteredTree = expandTree(render(clientModule.MarketPage, { t: tZh, getLocale: () => 'zh', initialState: missingState }))
  let filteredText = treeText(filteredTree)
  assert.ok(filteredText.includes('后端架构师'), 'the engineering card survives its own chip')
  assert.ok(!filteredText.includes('消失的'), 'an uncategorized card is filtered out')
  assert.ok(!filteredText.includes('mvp-dev-team'), 'another category\'s cards are filtered out')
  assert.ok(filteredText.includes('共 1 位'), 'the matchline counts the category-filtered table (plain form: no query)')
  let rerenderedButtons = treeNodes(treeNodes(filteredTree).find((node) =>
    node.props && node.props.className === 'wbm-catrow')).filter((node) => node.type === 'button')
  assert.equal(rerenderedButtons[1].props['aria-pressed'], 'true', 'the clicked chip announces its pressed state')
  assert.equal(rerenderedButtons[0].props['aria-pressed'], 'false', 'the all chip releases')

  // Click 全部分类 → the whole table returns.
  rerenderedButtons[0].props.onClick()
  filteredTree = expandTree(render(clientModule.MarketPage, { t: tZh, getLocale: () => 'zh', initialState: missingState }))
  filteredText = treeText(filteredTree)
  assert.ok(filteredText.includes('消失的') && filteredText.includes('mvp-dev-team'),
    'the all chip restores every card')
}

// Path fixed → the banner is gone from the very same page.
resetMount()
pageTree = expandTree(render(clientModule.MarketPage, {
  t: tZh, getLocale: () => 'zh',
  initialState: { ...missingState, sourcePath: '/now/it/exists', pathExists: true, warnings: [] },
}))
assert.equal(treeNodes(pageTree).find((node) => node.props && node.props.className === 'wbm-banner'),
  undefined, 'a fixed path clears the banner')
assert.equal(treeNodes(pageTree).find((node) => node.props && node.props.className === 'wbm-warns'),
  undefined, 'no warnings fold without warnings')

// Locale follow: the same snapshot under en shows base-field names and
// descriptions (the dictionary-driven switch of the acceptance list).
resetMount()
pageTree = expandTree(render(clientModule.MarketPage, { t: tEn, getLocale: () => 'en', initialState: missingState }))
{
  const text = treeText(pageTree)
  assert.ok(text.includes('WorkBuddy Expert Market'), 'en title from the dictionary')
  assert.ok(text.includes('Backend Architect') && text.includes('Use when designing APIs.'),
    'en cards show base-field names/descriptions')
  assert.ok(!text.includes('后端架构师'), 'the zhName is not rendered under en')
  assert.ok(text.includes('Source path does not exist:'), 'banner follows the language too')
  assert.ok(text.includes('Engineering'), 'the category chip label localizes under en (#23)')
}

// Empty source: the actionable empty state, not the banner's blame.
resetMount()
pageTree = expandTree(render(clientModule.MarketPage, {
  t: tZh, getLocale: () => 'zh',
  initialState: { sourcePath: '/empty/dir', pathExists: true, revision: 0, experts: [], orphans: [], warnings: [] },
}))
{
  const text = treeText(pageTree)
  assert.ok(text.includes('没有匹配的专家'), 'empty state headline')
  assert.ok(text.includes('清除筛选'), 'empty state offers the clear-filters action')
  assert.equal(treeNodes(pageTree).find((node) => node.props && node.props.className === 'wbm-catrow'),
    undefined, 'a table with no category at all hides the chip row entirely (#23)')
}

// apply(): the settings-section entry plus the input button's seat, style
// owned by the disposer. (The @ source needs the inputTriggers service —
// §6c drives apply() with one; this call has no ctx.get, so only the two
// slot entries register, proving the degradation.)
const injectedSlots = []
const slotEntries = []
const slotsStub = {
  inject(slot, register) {
    injectedSlots.push(slot)
    return register()
  },
  register(meta, renderer) {
    const entry = { meta, renderer }
    slotEntries.push(entry)
    return () => {
      const at = slotEntries.indexOf(entry)
      if (at >= 0) slotEntries.splice(at, 1)
    }
  },
}
const offApply = clientModule.apply({ slots: slotsStub })
assert.equal(typeof offApply, 'function', 'apply returns a disposer')
assert.deepEqual(injectedSlots, ['settings.section', 'conversation.input.left'],
  'both slot entries injected: the market page and the input button (#11)')
assert.equal(styleTags.length, 1, 'the scoped style tag is injected alongside the registration')
assert.equal(styleTags[0].dataset.plugin, 'dsh-workbuddy-market', 'the tag is plugin-owned')
assert.ok(String(styleTags[0].textContent).includes('.wbm-card'), 'CSS actually attached')
assert.ok(String(styleTags[0].textContent).includes('.wbm-banner'), 'banner CSS attached')
assert.ok(String(styleTags[0].textContent).includes('.wbm-pathbar'), 'path topbar CSS attached')
assert.ok(String(styleTags[0].textContent).includes('.wbm-spin'), 'refresh spinner CSS attached')
assert.ok(String(styleTags[0].textContent).includes('.wbm-conflict'), 'revision conflict CSS attached')
assert.ok(String(styleTags[0].textContent).includes('.wbm-orphans'), 'orphans CSS attached')
assert.ok(String(styleTags[0].textContent).includes('.wbm-catrow'), 'category chip row CSS attached (#23)')
assert.ok(String(styleTags[0].textContent).includes('.wbm-summon-menu'), 'summon popover CSS attached (#11)')
assert.ok(String(styleTags[0].textContent).includes('.wbm-summon-btn'), 'summon button CSS attached (#11)')
assert.ok(String(styleTags[0].textContent).includes('@keyframes wbm-spin'), 'the spin keyframes exist')

const settingsEntry = slotEntries.find((entry) => entry.meta.name === 'settings.section')
assert.equal(settingsEntry.meta.id, 'workbuddy-market')
assert.equal(settingsEntry.meta.order, 46)
assert.equal(settingsEntry.meta.label(), 'WorkBuddy 专家', 'zh nav label without the locale service')
const pageElement = settingsEntry.renderer()
assert.equal(typeof pageElement.type, 'function', 'render produces a MarketPage element')
assert.equal(pageElement.props.getLocale(), 'zh', 'locale id threaded into the page (zh without the locale service)')

// The disposer releases the slot entry AND the style tag; a re-apply after
// disposal re-injects idempotently (same module instance, fresh fiber).
offApply()
assert.equal(slotEntries.length, 0, 'slot entries released by the apply disposer')
assert.equal(styleTags.length, 0, 'scoped style tag removed by the apply disposer')
const offAgain = clientModule.apply({ slots: slotsStub })
assert.equal(styleTags.length, 1, 're-apply re-injects the style tag (single, not duplicated)')
assert.equal(slotEntries.length, 2, 're-apply registers both slot entries again')
offAgain()
assert.equal(slotEntries.length, 0)
assert.equal(styleTags.length, 0)

// ── 6b. the mutating half (ticket #9): state machines over the stub React ───
//
// The React stub's setters store, so driving real onClick/onChange handlers
// and re-rendering runs the page's ACTUAL state machines: the inline
// confirm → busy → notice flow of install/update/uninstall, the single-
// flight 409 recovery, the revision-conflict box and its retry, the refresh
// spinner's disabled window, and the orphans panel — with fetch scripted
// per call so every request shape (method/body/expectedRevision) is
// asserted, not assumed.

const realFetch = globalThis.fetch
const fetchLog = []
let fetchScript = []
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
const gate = () => {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}
// Scripted fetch: each entry is consumed in call order. A plain object is
// answered immediately; a function returns the response promise itself
// (pair with gate() to hold a flight open mid-assertion).
globalThis.fetch = (path, init) => {
  const entry = {
    path: String(path),
    method: (init && init.method) || 'GET',
    body: init && typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
  }
  fetchLog.push(entry)
  const step = fetchScript.shift()
  if (step === undefined) return Promise.reject(new Error('smoke: unexpected fetch ' + path))
  if (typeof step === 'function') return step(entry)
  return Promise.resolve({ ok: step.status < 400, status: step.status, json: async () => step.body })
}
const reply = (status, body) => () => Promise.resolve({ ok: status < 400, status, json: async () => body })
const held = (status, body) => {
  const g = gate()
  fetchScript.push(() => g.promise.then(() => ({ ok: status < 400, status, json: async () => body })))
  return g
}

const pageOf = (initialState) => ({ t: tZh, getLocale: () => 'zh', initialState })
const drawPage = (props) => expandTree(render(clientModule.MarketPage, props))
const buttonsOf = (tree) => treeNodes(tree).filter((node) => node.type === 'button')
const buttonByExact = (tree, label) =>
  buttonsOf(tree).find((node) => treeText(node).trim() === label)
const noticeOf = (tree) => treeNodes(tree).find((node) =>
  node.props && node.props.className === 'wbm-notice')
const click = (tree, label) => {
  const button = buttonByExact(tree, label)
  assert.ok(button !== undefined, `button "${label}" present`)
  assert.notEqual(button.props.disabled, true, `button "${label}" clickable`)
  button.props.onClick()
}

// The experts every mutating scenario runs against (stable count/order so
// the stub's hook slots line up across re-renders).
const mutFresh = { id: 'backend-architect', name: 'Backend Architect', zhName: '后端架构师',
  description: 'Use when designing APIs.', zhDescription: '设计后端接口时使用。',
  skills: [], pluginDir: 'backend-architect', teamSize: 1, installed: false, updatable: false, broken: false }
const mutOther = { ...mutFresh, id: 'dockerfile-gen', name: 'Dockerfile Gen', zhName: 'Dockerfile 生成',
  pluginDir: 'dockerfile-gen', installed: false, updatable: false, broken: false }
const mutState = (experts, rest = {}) => ({
  sourcePath: '/old/source', pathExists: true, revision: 5, experts, orphans: [], warnings: [],
  ...rest,
})

// cardActionsOf: the per-card action table driving the buttons.
assert.deepEqual(clientModule.cardActionsOf({ installed: false }), ['install'])
assert.deepEqual(clientModule.cardActionsOf({ installed: true }), ['uninstall'])
assert.deepEqual(clientModule.cardActionsOf({ installed: true, updatable: true }), ['update', 'uninstall'])
assert.deepEqual(clientModule.cardActionsOf({ installed: true, updatable: true, broken: true }), ['uninstall'],
  'a broken card offers uninstall only — its fix is 卸载重装')

// formatWhen: locale-aware import stamps, raw passthrough for junk.
assert.ok(clientModule.formatWhen('2025-09-01T10:00:00.000Z', 'zh').includes('2025'))
assert.ok(clientModule.formatWhen('2025-09-01T10:00:00.000Z', 'en').includes('2025'))
assert.equal(clientModule.formatWhen('not-a-date', 'zh'), 'not-a-date')
assert.equal(clientModule.formatWhen(undefined, 'zh'), '')

// ── install state machine: 安装 → 确认安装？/取消 → confirm → busy → done ──
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const props = pageOf(mutState([mutFresh, mutOther]))
  let tree = drawPage(props)
  // Both uninstalled cards offer a primary 安装; nothing is busy yet.
  let installs = buttonsOf(tree).filter((node) => treeText(node).trim() === '安装')
  assert.equal(installs.length, 2, 'each uninstalled card carries an install button')
  assert.equal(installs[0].props['data-variant'], 'primary', 'install is the primary action')
  assert.notEqual(installs[0].props.disabled, true, 'idle lane leaves buttons enabled')

  // Click 安装 → the row swaps to the confirm/cancel pair (sister pattern).
  installs[0].props.onClick()
  tree = drawPage(props)
  assert.ok(buttonByExact(tree, '确认安装？') !== undefined, 'the inline confirm appears')
  assert.ok(buttonByExact(tree, '取消') !== undefined, 'cancel joins the pair')
  const actingCard = () => treeNodes(tree).filter((node) =>
    node.props && node.props.className === 'wbm-card')[0]
  assert.ok(buttonsOf(actingCard()).every((node) => treeText(node).trim() !== '安装'),
    'the plain install button is gone from the confirming card')

  // 取消 reverts to the plain button.
  click(tree, '取消')
  tree = drawPage(props)
  assert.ok(buttonByExact(tree, '安装') !== undefined, 'cancel reverts the confirm pair')

  // Confirm → busy window held open: this row shows 处理中…, the OTHER row
  // disables, the POST body is exactly { id }.
  const heldInstall = held(200, { ok: true, presetId: 'wb-backend-architect', warnings: ['w1'] })
  fetchScript.push(reply(200, mutState([{ ...mutFresh, installed: true }, mutOther])))
  click(tree, '安装')
  click(drawPage(props), '确认安装？')
  assert.equal(fetchLog[0].path, '/dsh-workbuddy-market/api/install', 'install posts to the lane route')
  assert.equal(fetchLog[0].method, 'POST')
  assert.deepEqual(fetchLog[0].body, { id: 'backend-architect' }, 'the install body is the expert id')
  tree = drawPage(props)
  assert.ok(buttonByExact(tree, '处理中…') !== undefined, 'the acting row shows the busy state')
  assert.equal(buttonByExact(tree, '确认安装？'), undefined, 'the confirm pair stepped aside for busy')
  const otherInstall = buttonsOf(tree).find((node) =>
    treeText(node).trim() === '安装' && node.props.disabled === true)
  assert.ok(otherInstall !== undefined, 'the sibling card disables while the lane is held')

  // Release: notice ok (host warnings appended), state refetched, the card
  // flips to ✓ 已装 with an 卸载 button.
  heldInstall.resolve()
  await flush()
  tree = drawPage(props)
  assert.equal(fetchLog[1].path, '/dsh-workbuddy-market/api/state', 'success refetches the state')
  const notice = noticeOf(tree)
  assert.ok(notice !== undefined && notice.props['data-kind'] === 'ok', 'an ok notice lands')
  assert.ok(treeText(notice).includes('已安装「后端架构师」'), 'the notice names the expert')
  assert.ok(treeText(notice).includes('（w1）'), 'host warnings ride the notice')
  const cardText = treeText(treeNodes(tree).find((node) =>
    node.props && node.props.className === 'wbm-card'))
  assert.ok(cardText.includes('✓ 已装'), 'the card flips to installed')
  assert.ok(buttonByExact(tree, '卸载') !== undefined, 'the installed card offers uninstall')
  assert.ok(buttonByExact(tree, '安装') !== undefined, 'the other card stays installable')
  assert.equal(buttonByExact(tree, '处理中…'), undefined, 'the busy state cleared')
}

// ── update: updatable → 更新 → confirm → updatable gone, content follows ────
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const updatable = { ...mutFresh, installed: true, updatable: true }
  const props = pageOf(mutState([updatable, mutOther]))
  let tree = drawPage(props)
  assert.ok(buttonByExact(tree, '更新') !== undefined && buttonByExact(tree, '卸载') !== undefined,
    'an updatable card offers update AND uninstall')
  click(tree, '更新')
  tree = drawPage(props)
  assert.ok(buttonByExact(tree, '确认更新？') !== undefined, 'update confirms inline too')
  fetchScript.push(reply(200, { ok: true, presetId: 'wb-backend-architect', warnings: [] }))
  fetchScript.push(reply(200, mutState([{ ...mutFresh, installed: true, updatable: false }, mutOther])))
  click(tree, '确认更新？')
  await flush()
  tree = drawPage(props)
  assert.equal(fetchLog[0].path, '/dsh-workbuddy-market/api/update')
  assert.deepEqual(fetchLog[0].body, { id: 'backend-architect' })
  const notice = noticeOf(tree)
  assert.ok(notice !== undefined && treeText(notice).includes('已更新「后端架构师」'), 'update notice')
  const cardText = treeText(treeNodes(tree).find((node) =>
    node.props && node.props.className === 'wbm-card'))
  assert.ok(cardText.includes('✓ 已装'), 'still installed')
  assert.ok(!cardText.includes('↑ 可更新'), 'the updatable mark is gone after the update')
  assert.equal(buttonByExact(tree, '更新'), undefined, 'the update button left with the flag')
}

// ── uninstall: installed → 卸载 → danger confirm → back to uninstalled ──────
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const props = pageOf(mutState([{ ...mutFresh, installed: true }, mutOther]))
  let tree = drawPage(props)
  click(tree, '卸载')
  tree = drawPage(props)
  const confirmBtn = buttonByExact(tree, '确认卸载？')
  assert.ok(confirmBtn !== undefined, 'uninstall confirms inline')
  assert.equal(confirmBtn.props['data-variant'], 'danger', 'the destructive confirm is danger-toned')
  fetchScript.push(reply(200, { ok: true, presetId: 'wb-backend-architect' }))
  fetchScript.push(reply(200, mutState([mutFresh, mutOther])))
  confirmBtn.props.onClick()
  await flush()
  tree = drawPage(props)
  assert.equal(fetchLog[0].path, '/dsh-workbuddy-market/api/uninstall')
  assert.deepEqual(fetchLog[0].body, { id: 'backend-architect' })
  const notice = noticeOf(tree)
  assert.ok(notice !== undefined && treeText(notice).includes('已卸载「后端架构师」'), 'uninstall notice')
  const cardText = treeText(treeNodes(tree).find((node) =>
    node.props && node.props.className === 'wbm-card'))
  assert.ok(!cardText.includes('✓ 已装'), 'the installed mark cleared')
  assert.ok(buttonByExact(tree, '安装') !== undefined, 'the card is installable again')
}

// ── single-flight 409: UI does not wedge, buttons recover and retry works ──
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const props = pageOf(mutState([mutFresh, mutOther]))
  let tree = drawPage(props)
  click(tree, '安装')
  tree = drawPage(props)
  fetchScript.push(reply(409, { error: 'another change is in progress' }))
  click(tree, '确认安装？')
  await flush()
  tree = drawPage(props)
  assert.equal(fetchLog.length, 1, 'a failed install does not refetch state')
  const notice = noticeOf(tree)
  assert.ok(notice !== undefined && notice.props['data-kind'] === 'error', 'the 409 lands as an error notice')
  assert.ok(treeText(notice).includes('另一个变更正在进行'), 'the localized lane hint appears')
  assert.ok(treeText(notice).includes('another change is in progress'), 'the host message rides along')
  assert.equal(buttonByExact(tree, '处理中…'), undefined, 'no busy state survives the 409')
  const retryInstall = buttonByExact(tree, '安装')
  assert.ok(retryInstall !== undefined && retryInstall.props.disabled !== true,
    'the install button is usable again right after the 409')
  // And the retry can succeed on the same page state.
  click(tree, '安装')
  tree = drawPage(props)
  fetchScript.push(reply(200, { ok: true, presetId: 'wb-backend-architect' }))
  fetchScript.push(reply(200, mutState([{ ...mutFresh, installed: true }, mutOther])))
  click(tree, '确认安装？')
  await flush()
  tree = drawPage(props)
  assert.ok(treeText(drawPage(props)).includes('✓ 已装'), 'the retried install succeeds')
}

// ── path editor: revision conflict box, retry success, banner recovery ─────
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const props = pageOf(mutState([mutFresh]))
  let tree = drawPage(props)
  const pathInput = treeNodes(tree).find((node) =>
    node.props && node.props.className === 'wbm-path-input')
  assert.ok(pathInput !== undefined, 'the path topbar renders an input')
  assert.equal(pathInput.props.value, '/old/source', 'the draft starts at the stored path')
  let applyBtn = buttonByExact(tree, '应用')
  assert.equal(applyBtn.props.disabled, true, 'apply is disabled while the draft is unchanged')

  // Edit the draft; apply fires the optimistic-locked config POST.
  pathInput.props.onChange({ target: { value: '/new/fixture' } })
  tree = drawPage(props)
  assert.equal(treeNodes(tree).find((node) =>
    node.props && node.props.className === 'wbm-path-input').props.value, '/new/fixture')
  applyBtn = buttonByExact(tree, '应用')
  assert.notEqual(applyBtn.props.disabled, true, 'editing the draft enables apply')

  // Empty draft disables apply again (the raw value, not the trimmed one).
  treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-path-input')
    .props.onChange({ target: { value: '   ' } })
  assert.equal(buttonByExact(drawPage(props), '应用').props.disabled, true, 'a blank draft disables apply')
  // Fresh mount for the conflict flow.
  resetMount()
  fetchLog.length = 0
  fetchScript = []
  const props2 = pageOf(mutState([mutFresh]))
  let tree2 = drawPage(props2)
  treeNodes(tree2).find((node) => node.props && node.props.className === 'wbm-path-input')
    .props.onChange({ target: { value: '/new/fixture' } })

  // Another tab got there first: 409 SETTINGS_CONFLICT carrying both sides.
  fetchScript.push(reply(409, {
    error: 'settings conflict', code: 'SETTINGS_CONFLICT', expectedRevision: 5, revision: 9,
  }))
  click(drawPage(props2), '应用')
  await flush()
  tree2 = drawPage(props2)
  const conflict = treeNodes(tree2).find((node) => node.props && node.props.className === 'wbm-conflict')
  assert.ok(conflict !== undefined, 'the conflict box renders on SETTINGS_CONFLICT')
  assert.equal(conflict.props.role, 'alert', 'the conflict box is an alert')
  const conflictText = treeText(conflict)
  assert.ok(conflictText.includes('设置冲突'), 'conflict headline')
  assert.ok(conflictText.includes('本页基于修订 5'), 'our expected revision is shown')
  assert.ok(conflictText.includes('当前已是修订 9'), 'the current revision is shown')
  assert.deepEqual(fetchLog[0].body, { sourcePath: '/new/fixture', expectedRevision: 5 },
    'the config POST carries the optimistic lock')

  // Retry: pull the fresh state (revision 9), replay the same draft, land.
  fetchScript.push(reply(200, mutState([mutFresh], { revision: 9 })))
  fetchScript.push(reply(200, mutState([mutFresh], { sourcePath: '/new/fixture', pathExists: false, revision: 10, warnings: ['source path does not exist: /new/fixture'] })))
  click(tree2, '拉取新修订并重试')
  await flush()
  tree2 = drawPage(props2)
  assert.equal(fetchLog[1].path, '/dsh-workbuddy-market/api/state', 'retry re-pulls the state first')
  assert.deepEqual(fetchLog[2].body, { sourcePath: '/new/fixture', expectedRevision: 9 },
    'retry replays the draft against the FRESH revision')
  assert.equal(treeNodes(tree2).find((node) => node.props && node.props.className === 'wbm-conflict'),
    undefined, 'the conflict box clears on retry success')
  const notice = noticeOf(tree2)
  assert.ok(notice !== undefined && treeText(notice).includes('源路径已更新：/new/fixture'), 'apply notice')
  const banner = treeNodes(tree2).find((node) => node.props && node.props.className === 'wbm-banner')
  assert.ok(banner !== undefined, 'a nonexistent applied path raises the yellow banner')
  assert.ok(treeText(banner).includes('/new/fixture'), 'the banner names the applied path')
  assert.equal(treeNodes(tree2).find((node) =>
    node.props && node.props.className === 'wbm-path-input').props.value, '/new/fixture',
    'the draft follows the applied path')

  // Fix the path: banner clears (改对 → 自动恢复).
  fetchScript.push(reply(200, mutState([mutFresh], { sourcePath: '/fixed', pathExists: true, revision: 11 })))
  treeNodes(tree2).find((node) => node.props && node.props.className === 'wbm-path-input')
    .props.onChange({ target: { value: '/fixed' } })
  click(drawPage(props2), '应用')
  await flush()
  tree2 = drawPage(props2)
  assert.equal(treeNodes(tree2).find((node) => node.props && node.props.className === 'wbm-banner'),
    undefined, 'fixing the path clears the banner')
}

// ── refresh: the spinner's disabled window + the forced rescan ─────────────
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const props = pageOf(mutState([mutFresh]))
  let tree = drawPage(props)
  const refreshBtn = treeNodes(tree).find((node) =>
    node.props && node.props.className && node.props.className.indexOf('wbm-refresh') !== -1)
  assert.ok(refreshBtn !== undefined, 'the refresh button renders')
  assert.notEqual(refreshBtn.props.disabled, true, 'idle refresh is enabled')

  // Hold the rescan open: disabled + aria-busy + the spinning icon class.
  const heldRefresh = held(200, mutState([mutFresh, mutOther], { revision: 6 }))
  refreshBtn.props.onClick()
  assert.equal(fetchLog[0].path, '/dsh-workbuddy-market/api/refresh')
  assert.equal(fetchLog[0].method, 'POST')
  tree = drawPage(props)
  const spinning = treeNodes(tree).find((node) =>
    node.props && node.props.className && node.props.className.indexOf('wbm-refresh') !== -1)
  assert.equal(spinning.props.disabled, true, 'the refresh button disables during its flight')
  assert.equal(spinning.props['aria-busy'], 'true', 'the flight is announced')
  assert.ok(treeNodes(tree).some((node) =>
    node.props && node.props.className === 'wbm-spin'), 'the icon spins while held')
  assert.equal(buttonByExact(tree, '应用').props.disabled, true, 'apply also waits out the lane')
  assert.equal(buttonByExact(tree, '安装').props.disabled, true,
    'card action buttons wait out a refresh flight too (shared lane)')
  assert.equal(buttonByExact(tree, '刷新') !== undefined && buttonByExact(tree, '刷新').props.disabled, true,
    'the refresh button itself stays disabled while held')

  // Release: button back, spinner gone, the fresh state lands.
  heldRefresh.resolve()
  await flush()
  tree = drawPage(props)
  const done = treeNodes(tree).find((node) =>
    node.props && node.props.className && node.props.className.indexOf('wbm-refresh') !== -1)
  assert.notEqual(done.props.disabled, true, 'refresh re-enables after the flight')
  assert.notEqual(done.props['aria-busy'], 'true', 'aria-busy clears')
  assert.ok(!treeNodes(tree).some((node) => node.props && node.props.className === 'wbm-spin'),
    'the spinner stops')
  assert.ok(treeText(tree).includes('专家 2'), 'the forced rescan state landed')
}

// ── orphans: provenance rows with confirmed uninstall by id ────────────────
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const orphanLeft = { id: 'lefty', presetId: 'wb-lefty', name: 'Lefty',
    sourcePath: '/other/source', pluginDir: 'other-plugin', agentFile: 'agents/lefty.md',
    importedAt: '2025-09-01T10:00:00.000Z', broken: false }
  const orphanDead = { id: 'dead', presetId: 'wb-dead', name: 'Dead', broken: true,
    warning: '清单缺失，请卸载重装：/presets/wb-dead/.workbuddy-market.json file missing' }
  const props = pageOf(mutState([mutFresh], { orphans: [orphanLeft, orphanDead] }))
  let tree = drawPage(props)
  const panel = treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-orphans')
  assert.ok(panel !== undefined, 'the orphans panel renders')
  const panelText = treeText(panel)
  assert.ok(panelText.includes('已安装但不在当前源'), 'panel title')
  assert.ok(panelText.includes('2'), 'panel count')
  assert.ok(panelText.includes('Lefty') && panelText.includes('wb-lefty'), 'name + preset id')
  assert.ok(panelText.includes('/other/source'), 'provenance carries the old source path')
  assert.ok(panelText.includes('other-plugin/agents/lefty.md'), 'provenance carries plugin dir + agent file')
  assert.ok(panelText.includes('安装于') && panelText.includes('2025'), 'the import stamp is localized')
  assert.ok(panelText.includes('清单异常'), 'a broken orphan is flagged')
  assert.ok(panelText.includes('清单缺失，请卸载重装'), 'the broken orphan surfaces its host warning as provenance')
  const orphanRows = treeNodes(panel).filter((node) =>
    node.props && node.props.className === 'wbm-orphan')
  assert.equal(orphanRows.length, 2, 'one row per orphan')
  assert.equal(orphanRows[1].props['data-broken'], 'true', 'the broken row is marked')
  assert.ok(treeNodes(tree).some((node) => node.props && node.props.className === 'wbm-card'),
    'the market grid renders alongside the orphans panel — the orphan region never blocks the market (#12)')

  // Uninstall the healthy orphan through the same confirm machine.
  const orphanUninstall = buttonsOf(orphanRows[0]).find((node) => treeText(node).trim() === '卸载')
  assert.ok(orphanUninstall !== undefined, 'an orphan row carries an uninstall button')
  orphanUninstall.props.onClick()
  tree = drawPage(props)
  assert.ok(buttonByExact(tree, '确认卸载？') !== undefined, 'orphan uninstall confirms inline')
  fetchScript.push(reply(200, { ok: true, presetId: 'wb-lefty' }))
  fetchScript.push(reply(200, mutState([mutFresh], { orphans: [orphanDead] })))
  click(tree, '确认卸载？')
  await flush()
  tree = drawPage(props)
  assert.equal(fetchLog[0].path, '/dsh-workbuddy-market/api/uninstall')
  assert.deepEqual(fetchLog[0].body, { id: 'lefty' }, 'orphan uninstall posts the expert id (roster authority)')
  const panelAfter = treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-orphans')
  assert.ok(treeText(panelAfter).includes('Dead'), 'the remaining orphan stays')
  assert.ok(!treeText(panelAfter).includes('wb-lefty'), 'the uninstalled orphan left the panel')
}

// ── 6d. the P4 interactions (ticket #12): team groups + bulk update ─────────
//
// The same storing React stub and scripted fetch drive the two #12 machines:
// the group view (a pure grouping pass + the fold state machine) and the
// serial bulk update (strict ordering, per-completion refetch, failure park
// + continue). The pure derivations run first so the page assertions can
// lean on them as ground truth.

// The team fixture: three members of one plugin with mixed install states.
const grpLead = { id: 'team-a-lead', name: 'Team A Lead', zhName: 'A 队长',
  description: 'Leads team A.', zhDescription: '带队 A。', skills: [], pluginDir: 'team-a',
  teamSize: 3, installed: true, updatable: false, broken: false }
const grpMaker = { ...grpLead, id: 'team-a-maker', name: 'Team A Maker', zhName: 'A 制造',
  description: 'Makes things.', zhDescription: '制造 A。', installed: true, updatable: true }
const grpChecker = { ...grpLead, id: 'team-a-checker', name: 'Team A Checker', zhName: 'A 质检',
  description: 'Checks things.', zhDescription: '质检 A。', installed: false, updatable: false }

// groupCardsByPlugin: solo cards stay lone, teams collapse into one group in
// first-card order; a filtered team still groups on the single survivor.
{
  const groups = clientModule.groupCardsByPlugin([mutFresh, grpLead, grpMaker, grpChecker])
  assert.equal(groups.length, 2, 'one solo group + one team group')
  assert.equal(groups[0].team, false, 'a lone solo card is not a group header candidate')
  assert.deepEqual(groups[0].members.map((card) => card.id), ['backend-architect'])
  assert.equal(groups[1].team, true)
  assert.equal(groups[1].pluginDir, 'team-a')
  assert.deepEqual(groups[1].members.map((card) => card.id), ['team-a-lead', 'team-a-maker', 'team-a-checker'],
    'members keep the table order inside the group')
  const filtered = clientModule.groupCardsByPlugin([grpMaker])
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].team, true, 'one surviving member of a filtered team still renders as its group')
}
// groupExpanded: undefined follows the filter mode; an explicit choice wins.
assert.equal(clientModule.groupExpanded({}, 'team-a', false), false,
  'default on the plain browse: collapsed')
assert.equal(clientModule.groupExpanded({}, 'team-a', true), true,
  'default under an active filter: expanded (matched members visible)')
assert.equal(clientModule.groupExpanded({ 'team-a': false }, 'team-a', true), false,
  'an explicit collapse beats the filter default')
assert.equal(clientModule.groupExpanded({ 'team-a': true }, 'team-a', false), true,
  'an explicit expand beats the plain-browse default')
assert.equal(clientModule.groupExpanded(undefined, 'team-a', true), true, 'a null map degrades to the default')
// groupStatsOf / updatableQueueOf: aggregation and queue eligibility.
assert.deepEqual(clientModule.groupStatsOf([grpLead, grpMaker, grpChecker]),
  { installed: 2, updatable: 1, broken: 0 }, 'status counts aggregate over the given members')
assert.deepEqual(
  clientModule.updatableQueueOf([mutFresh, grpMaker, { ...grpLead, updatable: true, broken: true }, grpLead])
    .map((card) => card.id),
  ['team-a-maker'],
  'the bulk queue keeps table order, skips the uninstalled/installed-quiet, and never takes broken cards')

// The page machine: collapsed by default, click expands, filter auto-expands,
// explicit fold overrides — and the counting surfaces never changed caliber.
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const props = pageOf(mutState([grpLead, grpMaker, grpChecker, mutFresh]))
  let tree = drawPage(props)
  let text = treeText(tree)
  let head = treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-group-head')
  assert.ok(head !== undefined, 'the team renders one collapsible group header')
  assert.equal(head.props['aria-expanded'], 'false', 'collapsed by default on the plain browse')
  assert.ok(text.includes('团队 ·3'), 'the header badge carries the plugin size')
  assert.ok(text.includes('成员 3/3'), 'the header counts shown/total members')
  assert.ok(text.includes('✓ 已装 2') && text.includes('↑ 可更新 1'),
    'the header aggregates status counts over the shown members')
  assert.ok(!text.includes('A 队长') && !text.includes('带队 A。'),
    'a collapsed group renders none of its member cards')
  assert.ok(text.includes('后端架构师'), 'the solo card renders flat, no header of its own')
  assert.ok(text.includes('专家 4') && text.includes('来源插件 2'),
    'census still counts expert cards and plugin dirs, not rendered headers')

  // Click the header → members expand in place as ordinary cards.
  head.props.onClick()
  tree = drawPage(props)
  text = treeText(tree)
  head = treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-group-head')
  assert.equal(head.props['aria-expanded'], 'true', 'the header announces the expanded state')
  assert.ok(text.includes('A 队长') && text.includes('A 质检'),
    'the expanded group renders its member cards')

  // A fresh mount under an active query: the group auto-expands (matched
  // members visible without a second click) while the matchline keeps its
  // expert-card caliber; an explicit fold then overrides the default.
  resetMount()
  let tree2 = drawPage(props)
  treeNodes(tree2).find((node) => node.props && node.props.className === 'wbm-search')
    .props.onChange({ target: { value: 'team-a' } })
  tree2 = drawPage(props)
  let text2 = treeText(tree2)
  assert.ok(text2.includes('A 队长'), 'under an active query the group auto-expands')
  assert.ok(text2.includes('匹配 3 位'), 'the matchline counts expert cards (three members hit)')
  assert.ok(!text2.includes('后端架构师'), 'the non-matching solo card is filtered out')
  treeNodes(tree2).find((node) => node.props && node.props.className === 'wbm-group-head')
    .props.onClick() // effective state was open → the explicit choice is closed
  tree2 = drawPage(props)
  text2 = treeText(tree2)
  assert.ok(!text2.includes('A 队长'), 'the explicit user fold wins over the filter default')
  assert.ok(text2.includes('成员 3/3'), 'the collapsed header still shows the match shape')
}

// TeamGroup rendered directly over a FILTERED member set: shown/total split,
// the full-size badge, stacked faces with the emoji fallback.
{
  resetMount()
  const groupTree = expandTree(render(clientModule.TeamGroup, {
    t: tZh, group: clientModule.groupCardsByPlugin([grpMaker])[0], expanded: false,
    onToggle: () => {},
  }))
  const gtext = treeText(groupTree)
  assert.ok(gtext.includes('团队 ·3'), 'the badge carries the plugin\'s FULL size, not the shown count')
  assert.ok(gtext.includes('成员 1/3'), 'the shown side follows whatever filter is active')
  assert.ok(gtext.includes('↑ 可更新 1'), 'marks aggregate over the SHOWN members only')
  assert.ok(treeNodes(groupTree).some((node) =>
    node.type === 'span' && node.props.className === 'wbm-gavatar'),
    'the face stack renders (emoji fallback for a PNG-less member)')
}

// The bulk update: strictly serial, a state refetch after EVERY completion,
// the lane held while walking, and the run unwinding into an ok notice.
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const upA = { ...mutFresh, installed: true, updatable: true }
  const upB = { ...mutOther, installed: true, updatable: true }
  const props = pageOf(mutState([upA, upB]))
  let tree = drawPage(props)
  assert.ok(buttonByExact(tree, '一键更新 2 位') !== undefined, 'the entry appears while updatables exist')
  assert.equal(treeNodes(tree).filter((node) =>
    node.props && node.props.className === 'wbm-bulk').length, 1,
    'exactly one bulk bar renders (the idle entry)')

  // Hold the FIRST update open: nothing else may fly (serial), the bar shows
  // progress, and the shared lane disables refresh/apply/row buttons.
  const heldUpdate = held(200, { ok: true, presetId: 'wb-backend-architect', warnings: [] })
  fetchScript.push(reply(200, mutState([{ ...mutFresh, installed: true, updatable: false }, upB])))
  fetchScript.push(reply(200, { ok: true, presetId: 'wb-dockerfile-gen', warnings: [] }))
  fetchScript.push(reply(200, mutState([{ ...mutFresh, installed: true, updatable: false }, { ...mutOther, installed: true, updatable: false }])))
  click(tree, '一键更新 2 位')
  assert.equal(fetchLog[0].path, '/dsh-workbuddy-market/api/update', 'the walk starts with a POST update')
  assert.deepEqual(fetchLog[0].body, { id: 'backend-architect' }, 'table order: first updatable card first')
  assert.equal(fetchLog.length, 1, 'strictly serial — nothing else flies while update #1 is held')
  tree = drawPage(props)
  const bar = treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-bulk')
  assert.ok(bar !== undefined && bar.props['data-phase'] === 'running', 'the running bar shows')
  assert.equal(bar.props['aria-busy'], 'true', 'the walk is announced busy')
  assert.ok(treeText(bar).includes('正在更新 1/2：后端架构师'), 'progress names the current expert')
  assert.equal(buttonByExact(tree, '刷新').props.disabled, true, 'the bulk run holds the shared mutation lane')
  assert.equal(buttonByExact(tree, '应用').props.disabled, true, 'apply waits out the walk too')
  assert.equal(buttonByExact(tree, '卸载').props.disabled, true, 'row buttons disable while walking')
  assert.equal(buttonByExact(tree, '一键更新 2 位'), undefined, 'the idle entry is gone while running')

  // Release: update #1 → state refetch (the finished card flips) → update #2
  // → state refetch → done notice, bar gone.
  heldUpdate.resolve()
  await flush()
  tree = drawPage(props)
  assert.deepEqual(fetchLog.map((entry) => entry.path), [
    '/dsh-workbuddy-market/api/update',
    '/dsh-workbuddy-market/api/state',
    '/dsh-workbuddy-market/api/update',
    '/dsh-workbuddy-market/api/state',
  ], 'the run is exactly update → state → update → state (逐个翻新: a refetch after EVERY completion)')
  assert.deepEqual(fetchLog[2].body, { id: 'dockerfile-gen' }, 'the second entry walks only after the first landed')
  const notice = noticeOf(tree)
  assert.ok(notice !== undefined && notice.props['data-kind'] === 'ok' &&
    treeText(notice).includes('一键更新完成：成功 2 位'), 'completion lands as an ok notice')
  assert.equal(treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-bulk'),
    undefined, 'the bar is gone with no updatables left')
}

// The mid-run failure: the walk parks with the host error, releases the lane,
// keeps the failed card's own row button — and 继续更新剩余 resumes the
// REMAINING queue (the failed entry is never retried by the resume itself).
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const upA = { ...mutFresh, installed: true, updatable: true }
  const upB = { ...mutOther, installed: true, updatable: true }
  const props = pageOf(mutState([upA, upB]))
  let tree = drawPage(props)
  fetchScript.push(reply(500, { error: 'manifest corrupted on the way' }))
  fetchScript.push(reply(200, { ok: true, presetId: 'wb-dockerfile-gen', warnings: [] }))
  fetchScript.push(reply(200, mutState([upA, { ...mutOther, installed: true, updatable: false }])))
  click(tree, '一键更新 2 位')
  await flush()
  tree = drawPage(props)
  const bar = treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-bulk')
  assert.ok(bar !== undefined && bar.props['data-phase'] === 'failed' && bar.props.role === 'alert',
    'a failed entry parks the walk in a failure box')
  const barText = treeText(bar)
  assert.ok(barText.includes('一键更新中断：后端架构师'), 'the failure names the stopped entry')
  assert.ok(barText.includes('更新失败'), 'the localized failure prefix rides along')
  assert.ok(barText.includes('manifest corrupted on the way'), 'the host error rides along')
  assert.notEqual(buttonByExact(tree, '刷新').props.disabled, true, 'a failed run releases the mutation lane')
  const firstCard = treeNodes(tree).filter((node) =>
    node.props && node.props.className === 'wbm-card')[0]
  assert.ok(treeText(firstCard).includes('↑ 可更新'), 'the failed card stays updatable')
  assert.notEqual(buttonByExact(tree, '更新').props.disabled, true,
    'its own row update button is usable again right after the failure')

  click(tree, '继续更新剩余 1 位')
  await flush()
  tree = drawPage(props)
  assert.deepEqual(fetchLog.map((entry) => entry.path), [
    '/dsh-workbuddy-market/api/update',
    '/dsh-workbuddy-market/api/update',
    '/dsh-workbuddy-market/api/state',
  ], 'continue walks the REMAINING entry only — the failed one is skipped, and failure never refetched state')
  assert.deepEqual(fetchLog[1].body, { id: 'dockerfile-gen' }, 'the resume starts at the next entry')
  const notice = noticeOf(tree)
  assert.ok(notice !== undefined && treeText(notice).includes('一键更新完成：成功 1 位'),
    'the resumed run finishes counting its own successes')
  const barAfter = treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-bulk')
  assert.ok(barAfter !== undefined && barAfter.props['data-phase'] === 'idle',
    'the parked failure is gone — the bar is back to the idle entry')
  assert.ok(buttonByExact(tree, '一键更新 1 位') !== undefined,
    'the still-updatable failed card keeps the bulk entry available for another go')
}

// 收起 drops a parked failure: the bar returns to the idle entry, which now
// offers the still-updatable cards afresh.
{
  fetchLog.length = 0
  fetchScript = []
  resetMount()
  const upA = { ...mutFresh, installed: true, updatable: true }
  const upB = { ...mutOther, installed: true, updatable: true }
  const props = pageOf(mutState([upA, upB]))
  let tree = drawPage(props)
  fetchScript.push(reply(500, { error: 'boom' }))
  click(tree, '一键更新 2 位')
  await flush()
  click(drawPage(props), '收起')
  tree = drawPage(props)
  const bar = treeNodes(tree).find((node) => node.props && node.props.className === 'wbm-bulk')
  assert.equal(bar.props['data-phase'], 'idle', 'dismiss returns the bar to the idle entry')
  assert.ok(buttonByExact(tree, '一键更新 2 位') !== undefined,
    'the entry offers the full queue again after a dismissed run')
}

globalThis.fetch = realFetch

// ── 6c. the summon entry points (ticket #11): input button + '@' source ────
//
// The storing React stub and scripted fetch drive the REAL machines: the
// SummonButton click → /api/state → popover → pick → setDraft flow (and
// nothing else — no send seam is ever touched), and the '@' source's
// candidates/onPick against installed-only rosters. Both seats ride ONE
// apply(); the disposer releases them together with the style tag.

// Instruction drafts: zh/en × with/without (blank) draft — the tool wording
// follows src/summon.js (the draft asks the MODEL to call
// summon_workbuddy_expert; the client never calls the tool itself).
assert.equal(clientModule.buildSummonInstruction(tZh, '后端架构师', 'backend-architect', ''),
  '用 summon_workbuddy_expert 召唤专家「后端架构师」（backend-architect）处理以下任务：')
assert.equal(clientModule.buildSummonInstruction(tZh, '后端架构师', 'backend-architect', '   '),
  '用 summon_workbuddy_expert 召唤专家「后端架构师」（backend-architect）处理以下任务：',
  'blank draft behaves like empty')
assert.equal(clientModule.buildSummonInstruction(tZh, '后端架构师', 'backend-architect', '评审 src/foo.js'),
  '用 summon_workbuddy_expert 召唤专家「后端架构师」（backend-architect）处理以下任务：\n评审 src/foo.js',
  'a non-blank composer draft rides along as the task')
assert.equal(clientModule.buildSummonInstruction(tEn, 'Backend Architect', 'backend-architect', ''),
  'Summon expert "Backend Architect" (backend-architect) with summon_workbuddy_expert to handle the following task:')
assert.ok(clientModule.buildSummonInstruction(tEn, 'Backend Architect', 'backend-architect', 'review src/foo.js')
  .endsWith('\nreview src/foo.js'), 'english draft rides along as the task')

// One apply() with the inputTriggers service: BOTH slot entries plus the
// '@' source register, and the style tag rides the same disposers.
const triggerSources = []
injectedSlots.length = 0 // the earlier §6 applies already pushed theirs
const offSummonApply = clientModule.apply({
  slots: slotsStub,
  get: (name) => (name === 'inputTriggers'
    ? {
        registerSource(source) {
          triggerSources.push(source)
          return () => {
            const at = triggerSources.indexOf(source)
            if (at >= 0) triggerSources.splice(at, 1)
          }
        },
      }
    : undefined),
})
assert.equal(typeof offSummonApply, 'function', 'apply returns a disposer')
assert.deepEqual(injectedSlots, ['settings.section', 'conversation.input.left'],
  'both slot entries injected under one apply')
assert.equal(triggerSources.length, 1, 'one @ trigger source registered')
assert.equal(styleTags.length, 1, 'the scoped style tag rides the same apply')

const inputEntry = slotEntries.find((entry) => entry.meta.name === 'conversation.input.left')
assert.ok(inputEntry !== undefined, 'the input.left seat registered')
assert.equal(inputEntry.meta.id, 'workbuddy-market')
assert.equal(inputEntry.meta.order, 1)
assert.equal(inputEntry.meta.locale, 'dsh-workbuddy-market')
assert.equal(inputEntry.renderer({}), null, 'button degrades to hidden without inputActions')
assert.equal(inputEntry.renderer({ inputActions: {} }), null, 'button hides when setDraft is missing')
const summonDraftCalls = []
const summonButtonEl = inputEntry.renderer({
  input: { draft: '评审一下' },
  inputActions: { setDraft: (text) => summonDraftCalls.push(text) },
})
assert.equal(typeof summonButtonEl.type, 'function', 'render produces a SummonButton element')
assert.equal(summonButtonEl.props.input.draft, '评审一下')
assert.equal(typeof summonButtonEl.props.inputActions.setDraft, 'function')
assert.equal(summonButtonEl.props.t('summonButtonTitle'), '召唤专家', 'bound zh translator threaded through')
assert.equal(summonButtonEl.props.getLocale(), 'zh', 'locale id threaded into the summon button')

const triggerSource = triggerSources[0]
assert.equal(triggerSource.trigger, '@', 'the source binds the @ trigger')
assert.equal(triggerSource.name, 'workbuddy-market')
assert.equal(typeof triggerSource.order, 'number')

// candidates: the SAME state overlay the page reads — installed-only
// (broken installs stay summonable per design §6), id + localized name on
// every row, zh/en/id cross-language query filtering.
const summonStateBody = {
  experts: [
    { id: 'backend-architect', name: 'Backend Architect', zhName: '后端架构师',
      description: 'Use when designing APIs.', zhDescription: '设计后端接口时使用。',
      avatarUrl: '/dsh-workbuddy-market/api/avatar?id=backend-architect', installed: true },
    { id: 'api-dev', name: 'API Dev', zhName: '接口开发', installed: true, broken: true },
    { id: 'dockerfile-gen', name: 'Dockerfile Gen', zhName: 'Dockerfile 生成',
      description: 'Containerize workloads.', installed: false },
  ],
}
{
  fetchLog.length = 0
  globalThis.fetch = (path) => {
    fetchLog.push({ path: String(path), method: 'GET', body: undefined })
    return Promise.resolve({ ok: true, status: 200, json: async () => summonStateBody })
  }
  try {
    const all = await triggerSource.candidates({}, { query: '' })
    assert.deepEqual(all.map((candidate) => candidate.hint), ['backend-architect', 'api-dev'],
      'only installed experts offered (broken installs stay; uninstalled cards never appear)')
    assert.equal(all[0].name, '后端架构师', 'zh UI shows the zhName')
    assert.equal(all[0].description, 'backend-architect · 设计后端接口时使用。',
      'the description line leads with the mono id (id + zhName 展示)')
    assert.equal(all[0].icon, clientModule.AVATAR_EMOJI, 'the static glyph rides the icon seat')
    assert.equal(all[0].section, 'WorkBuddy 专家', 'localized section heading for the @ menu')
    assert.equal(all[1].description, 'api-dev', 'a description-less card still shows its id')
    assert.deepEqual((await triggerSource.candidates({}, { query: '后端' })).map((c) => c.hint),
      ['backend-architect'], 'zhName query filters')
    assert.deepEqual((await triggerSource.candidates({}, { query: 'architect' })).map((c) => c.hint),
      ['backend-architect'], 'base-name query filters too (cross-language haystack)')
    assert.deepEqual((await triggerSource.candidates({}, { query: 'api-' })).map((c) => c.hint),
      ['api-dev'], 'id query filters')
    assert.deepEqual(await triggerSource.candidates({}, { query: '不存在' }), [],
      'non-matching query yields nothing')
    assert.ok(fetchLog.length > 0 && fetchLog.every((entry) => entry.path === '/dsh-workbuddy-market/api/state'),
      'candidates hit the state route (bilingual payload — no locale parameter needed)')

    const outcome = triggerSource.onPick({ candidate: all[0] })
    assert.deepEqual(Object.keys(outcome), ['text'], 'onPick returns the plain-text arm')
    assert.equal(outcome.text,
      '用 summon_workbuddy_expert 召唤专家「后端架构师」（backend-architect）处理以下任务：')

    // A failing state route yields no candidates without ever rejecting.
    globalThis.fetch = () => Promise.reject(new Error('state route down'))
    assert.deepEqual(await triggerSource.candidates({}, { query: '' }), [],
      'fetch failure yields empty candidates without rejecting')
  } finally {
    globalThis.fetch = realFetch
  }
}

// The REAL button machine over the storing stub: click → fetch → popover →
// pick → setDraft(instruction) and NOTHING else (there is no send seam to
// call — drafting is the entire surface).
const pillOf = (props) => {
  const tree = expandTree(render(clientModule.SummonButton, props))
  const button = treeNodes(tree).find((node) =>
    node.type === 'button' && node.props.className === 'wbm-summon-btn')
  assert.ok(button !== undefined, 'the pill button renders')
  return { tree, button }
}
{
  fetchLog.length = 0
  resetMount()
  const calls = []
  const props = {
    t: tZh, getLocale: () => 'zh',
    input: { draft: '评审一下' },
    inputActions: { setDraft: (text) => calls.push(text) },
  }
  globalThis.fetch = (path) => {
    fetchLog.push({ path: String(path), method: 'GET', body: undefined })
    return Promise.resolve({ ok: true, status: 200, json: async () => summonStateBody })
  }
  try {
    const first = pillOf(props)
    assert.equal(treeText(first.button), '召唤专家', 'button label from the dictionary')
    assert.equal(treeNodes(first.tree).find((node) =>
      node.props && node.props.className === 'wbm-summon-menu'), undefined,
      'menu closed before the first click')
    assert.equal(fetchLog.length, 0, 'no fetch before the click')

    first.button.props.onClick()
    await flush()
    let tree = expandTree(render(clientModule.SummonButton, props))
    const menu = treeNodes(tree).find((node) =>
      node.props && node.props.className === 'wbm-summon-menu')
    assert.ok(menu !== undefined, 'the popover opens after the fetch lands')
    const menuText = treeText(menu)
    assert.ok(menuText.includes('已安装的 WorkBuddy 专家'), 'menu title')
    assert.ok(menuText.includes('后端架构师') && menuText.includes('接口开发'),
      'installed cards listed with their zhNames')
    assert.ok(menuText.includes('backend-architect'), 'the mono id rides every row')
    assert.ok(menuText.includes('选中后写入指令草稿，不会自动发送'), 'the footnote promises no auto-send')
    assert.ok(!menuText.includes('Dockerfile'), 'uninstalled cards never appear')
    const popoverImg = treeNodes(menu).find((node) =>
      node.type === 'img' && node.props.className === 'wbm-summon-emoji')
    assert.ok(popoverImg !== undefined && popoverImg.props.src === '/dsh-workbuddy-market/api/avatar?id=backend-architect',
      'an avatared card shows its PNG face in the popover (the market grid\'s face, not the static glyph)')
    assert.ok(treeNodes(menu).some((node) =>
      node.type === 'span' && node.props.className === 'wbm-summon-emoji'),
      'a PNG-less card falls back to the static glyph')
    assert.equal(fetchLog.length, 1, 'exactly one state fetch per click')

    // Pick the first item: the instruction lands through setDraft (the
    // existing draft rides along as the task), the menu closes, and no
    // further fetch happens.
    const item = treeNodes(menu).find((node) =>
      node.props && node.props.className === 'wbm-summon-item')
    assert.ok(item !== undefined, 'menu items render')
    item.props.onMouseDown({ preventDefault () {} })
    assert.deepEqual(calls,
      ['用 summon_workbuddy_expert 召唤专家「后端架构师」（backend-architect）处理以下任务：\n评审一下'],
      'picking writes the instruction draft — and only that (never a send)')
    tree = expandTree(render(clientModule.SummonButton, props))
    assert.equal(treeNodes(tree).find((node) =>
      node.props && node.props.className === 'wbm-summon-menu'), undefined,
      'the popover closes after the pick')
    assert.equal(fetchLog.length, 1, 'picking triggers no further fetch')
  } finally {
    globalThis.fetch = realFetch
  }
}

// Healthy zero-installs → the settings section opens instead of the popover
// (openMarketSettings degrades silently under the stub document — no dialog
// and no nav buttons to click).
{
  fetchLog.length = 0
  resetMount()
  const calls = []
  const props = {
    t: tZh, getLocale: () => 'zh', input: { draft: '' },
    inputActions: { setDraft: (text) => calls.push(text) },
  }
  globalThis.fetch = () => Promise.resolve({ ok: true, status: 200, json: async () => ({ experts: [] }) })
  try {
    pillOf(props).button.props.onClick()
    await flush()
    await new Promise((resolve) => setTimeout(resolve, 60)) // the helper's rAF fallback timers
    const tree = expandTree(render(clientModule.SummonButton, props))
    assert.equal(treeNodes(tree).find((node) =>
      node.props && node.props.className === 'wbm-summon-menu'), undefined,
      'a healthy empty roster opens the settings section, not the popover')
    assert.deepEqual(calls, [], 'no draft is written on the empty path')
  } finally {
    globalThis.fetch = realFetch
  }
}

// Failed route → the popover still opens, carrying the empty-state copy
// (fetch failure stays distinguishable from zero installs).
{
  resetMount()
  const props = { t: tZh, getLocale: () => 'zh', input: { draft: '' }, inputActions: { setDraft () {} } }
  globalThis.fetch = () => Promise.reject(new Error('state route down'))
  try {
    pillOf(props).button.props.onClick()
    await flush()
    const tree = expandTree(render(clientModule.SummonButton, props))
    const menu = treeNodes(tree).find((node) =>
      node.props && node.props.className === 'wbm-summon-menu')
    assert.ok(menu !== undefined, 'the popover opens even on a failed fetch')
    assert.ok(treeText(menu).includes('暂无可召唤的 WorkBuddy 专家'), 'empty-state copy shows')
  } finally {
    globalThis.fetch = realFetch
  }
}

// One disposer releases BOTH registrations together with the style tag.
offSummonApply()
assert.equal(triggerSources.length, 0, '@ source released by the apply disposer')
assert.equal(slotEntries.length, 0, 'slot entries released by the apply disposer')
assert.equal(styleTags.length, 0, 'scoped style tag removed by the same disposer')


// ── 8. summon tools (ticket #10) against mocked tools/subagents seams ───────
//
// The mock reprises the sister plugin's summon technique: a captured
// tools/systemPrompt registry, a recording subagents seam, and a roster of
// hand-written wb-* preset directories with REAL fingerprint manifests —
// so the summonable-set classification runs through the production
// installedMarketState, not a stub. The scan table itself is REAL: a
// dedicated fixture scanned through a real catalog cache.

const {
  LIST_TOOL, SUMMON_TOOL, SUMMON_TOOL_NAMES, TASK_MAX_CHARS,
  currentRawSourcePath, mountWorkbuddySummon, normalizeTask, resolveSummonExpert,
  summonableCards,
} = await import(join(root, 'src', 'summon.js'))

assert.equal(LIST_TOOL, 'workbuddy_experts')
assert.equal(SUMMON_TOOL, 'summon_workbuddy_expert')
assert.deepEqual(SUMMON_TOOL_NAMES,
  ['workbuddy_experts', 'summon_workbuddy_expert', 'market_experts', 'summon_market_expert'],
  'the deny list names BOTH markets (design §6 recursion guard)')
assert.equal(TASK_MAX_CHARS, 8000)

// zh/en message parity is proven behaviorally: every failure path below
// asserts its zh wording, and the en-locale list render exercises the EN
// dict end to end.

// Dedicated scan fixture: four solo experts with distinct zh names — two
// share the 架构 substring (the ambiguity probe).
const summonRoot = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-summon-'))
const summonWrite = (relative, content) => {
  const path = join(summonRoot, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}
const summonExpert = (plugin, id, zhName, description, personaMark, enName, categoryId) => {
  summonWrite(`${plugin}/agents/${id}.md`, [
    '---',
    `name: ${id}`,
    `description: ${description}`,
    ...(enName === undefined ? [] : ['displayName:', `  en: "${enName}"`]),
    '---',
    '',
    `${personaMark}`,
    '',
  ].join('\n'))
  summonWrite(`${plugin}/.codebuddy-plugin/plugin.json`, JSON.stringify({
    name: plugin, profession: { zh: zhName }, ...(categoryId === undefined ? {} : { categoryId }),
  }))
}
// alpha+delta share 02-Engineering (the category-filter probe), beta is
// 06-ContentCreative, gamma carries no category at all.
summonExpert('alpha-plugin', 'alpha-solo', '后端架构师', 'Use when designing APIs.', '阿尔法专家正文标记。', 'Alpha Solo', '02-Engineering')
summonExpert('beta-plugin', 'beta-solo', '容器专家', 'Use when containerizing workloads.', '贝塔专家正文标记。', undefined, '06-ContentCreative')
summonExpert('gamma-plugin', 'gamma-solo', '前端架构师', 'Use when building UI.', '伽马专家正文标记。')
summonExpert('delta-plugin', 'delta-solo', '数据专家', 'Use when modeling data.', '德尔塔专家正文标记。', undefined, '02-Engineering')

const summonScan = await scanWorkbuddyRoot(summonRoot)
assert.deepEqual(summonScan.experts.map((expert) => expert.id),
  ['alpha-solo', 'beta-solo', 'delta-solo', 'gamma-solo'],
  'the summon fixture scans four cards (scenario anchor)')
assert.equal(summonScan.experts.find((expert) => expert.id === 'alpha-solo').zhName, '后端架构师')

// The summon-side roster: hand-written wb-* preset directories with real
// fingerprint manifests naming THIS source (installedMarketState reads
// them for the classification), plus foreign-prefix entries that must be
// ignored. alpha installed; beta/gamma/delta not.
const summonRosterDir = mkdtempSync(join(tmpdir(), 'dsh-workbuddy-market-summon-roster-'))
function makeSummonRoster(ids) {
  const entries = [{ id: 'standard', trust: 'system', path: join(summonRosterDir, 'standard', 'agent.cordis.yml') }]
  for (const id of ids) {
    const dir = join(summonRosterDir, `wb-${id}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'agent.cordis.yml'), '# composition\n')
    writeFileSync(join(dir, MANIFEST_FILE), JSON.stringify({
      sourcePath: summonRoot, pluginDir: `${id}-plugin`, agentFile: `${id}.md`,
      fingerprint: '0'.repeat(64), importedAt: '2025-01-01T00:00:00.000Z',
    }))
    entries.push({ id: `wb-${id}`, trust: 'user', path: join(dir, 'agent.cordis.yml') })
  }
  entries.push({ id: 'expert-alpha-solo', trust: 'user', path: '/nowhere/agent.cordis.yml' })
  return { async list() { return entries } }
}
const alphaRoster = makeSummonRoster(['alpha-solo'])

// summonableCards: exactly the overlay's installed set — foreign prefixes
// ignored, uninstalled experts out, broken/manifest-less nuance documented
// in the module comment.
{
  const cards = await summonableCards(alphaRoster, summonRoot, summonScan.experts)
  assert.deepEqual(cards.map((card) => card.id), ['alpha-solo'],
    'summonable set = roster wb-* installed from THIS source (overlay byId)')
}

// Resolution unit checks over the real scan table.
assert.equal(resolveSummonExpert(summonScan.experts, 'alpha-solo').id, 'alpha-solo', 'exact id resolves')
assert.equal(resolveSummonExpert(summonScan.experts, 'ALPHA-SOLO').id, 'alpha-solo',
  'id match is case-insensitive')
assert.equal(resolveSummonExpert(summonScan.experts, '后端架构师').id, 'alpha-solo',
  'exact zhName resolves (zh users paste the card title)')
assert.equal(resolveSummonExpert(summonScan.experts, 'Alpha Solo').id, 'alpha-solo',
  'exact English display name resolves')
assert.equal(resolveSummonExpert(summonScan.experts, 'alpha solo').id, 'alpha-solo',
  'name match is case-insensitive')
assert.equal(resolveSummonExpert(summonScan.experts, 'beta').id, 'beta-solo',
  'unique id substring resolves')
assert.equal(resolveSummonExpert(summonScan.experts, '容器').id, 'beta-solo',
  'unique zhName substring resolves (fuzzy Chinese match)')
assert.equal(resolveSummonExpert(summonScan.experts, '数据专家').id, 'delta-solo', 'another exact zhName')
// resolveSummonExpert and normalizeTask throw SYNCHRONOUSLY: capture without
// await (one shared trampoline, used by the blocks below).
const capture = (fn) => { try { fn(); return null } catch (error) { return error } }
{
  const ambiguous = capture(() => resolveSummonExpert(summonScan.experts, '架构'))
  assert.ok(ambiguous !== null && /歧义/.test(ambiguous.message),
    'ambiguous zh substring rejected')
  assert.ok(ambiguous.message.includes('alpha-solo') && ambiguous.message.includes('gamma-solo'),
    'the ambiguity error lists the candidate ids')
  const missing = capture(() => resolveSummonExpert(summonScan.experts, 'no-such-expert'))
  assert.ok(missing !== null && missing.message.includes('workbuddy_experts'),
    'not-found hints at the list tool (list-first guidance)')
  const missingEn = capture(() => resolveSummonExpert(summonScan.experts, 'no-such-expert', 'en'))
  assert.ok(missingEn !== null && missingEn.message.includes('workbuddy_experts'),
    'english not-found hints at the list tool too')
  const empty = capture(() => resolveSummonExpert(summonScan.experts, '   '))
  assert.ok(empty !== null && /必须提供/.test(empty.message), 'empty query rejected')
}

assert.equal(normalizeTask('评审一下'), '评审一下', 'task passes through verbatim')
assert.equal(Array.from(normalizeTask('😀'.repeat(TASK_MAX_CHARS))).length, TASK_MAX_CHARS,
  'code-point limit counts surrogate pairs once')
{
  assert.ok(/不能为空/.test(capture(() => normalizeTask('  '))?.message), 'blank task rejected')
  assert.ok(/过长/.test(capture(() => normalizeTask('😀'.repeat(TASK_MAX_CHARS + 1)))?.message),
    'over-limit task rejected')
}

// currentRawSourcePath: optional settings, raw passthrough, default fallback.
assert.equal(currentRawSourcePath(undefined), DEFAULT_SOURCE_PATH,
  'no settings service → the default raw path (the summon segment never depends on settings)')
assert.equal(currentRawSourcePath({ get: () => undefined }), DEFAULT_SOURCE_PATH,
  'namespace not registered yet → the default raw path')
assert.equal(currentRawSourcePath({ get: (ns) => (ns === 'workbuddy-market' ? { sourcePath: '~/kept-raw' } : undefined) }),
  '~/kept-raw', 'the namespace value passes through RAW (tilde intact, #18)')

/**
 * Mocked injected context for mountWorkbuddySummon (sister-plugin shape):
 * captured tool/section registrations, a recording subagents seam, a
 * configurable roster, optional settings (locale + source namespace), and
 * a tool-registry view whose `get` decides which deny names exist.
 */
function makeSummonCtx(options = {}) {
  const registeredTools = []
  const sections = []
  const starts = []
  let disposed = 0
  const knownToolNames = new Set([LIST_TOOL, SUMMON_TOOL, ...(options.toolNames ?? [])])
  const ctx = {
    registeredTools, sections, starts,
    disposeCount: () => disposed,
    tools: {
      register(definition) {
        registeredTools.push(definition)
        return () => {
          const index = registeredTools.indexOf(definition)
          if (index >= 0) registeredTools.splice(index, 1)
        }
      },
      get: (name) => (knownToolNames.has(name) ? { name } : undefined),
    },
    systemPrompt: {
      section(spec) {
        sections.push(spec)
        return () => {
          const index = sections.indexOf(spec)
          if (index >= 0) sections.splice(index, 1)
        }
      },
    },
    subagents: {
      getProvider: () =>
        options.providerMissing === true
          ? undefined
          : (options.provider ?? { capabilities: { persona: true, toolFilter: true } }),
      start: async (name, request) => {
        starts.push({ name, request })
        return {
          result: Promise.resolve(
            options.result ?? { stopReason: 'completed', output: [{ type: 'text', text: '专家答复' }] },
          ),
          dispose: async () => { disposed += 1 },
        }
      },
    },
    agentPresets: options.roster ?? { async list() { return [] } },
    get: (serviceName) => (serviceName === 'settings' ? options.settings : undefined),
  }
  return ctx
}

const summonCatalog = createCatalog()
const summonSettings = {
  get: (ns) => (ns === SETTINGS_NS ? { sourcePath: summonRoot } : undefined),
}
const execStub = { agent: { id: 'parent-agent' }, signal: new AbortController().signal }

// Mount: two tools + one section; child sessions see ''.
const summonCtx = makeSummonCtx({
  roster: alphaRoster,
  settings: summonSettings,
  toolNames: ['market_experts', 'summon_market_expert'],
})
const offSummon = mountWorkbuddySummon(summonCtx, { catalog: summonCatalog })
assert.deepEqual(summonCtx.registeredTools.map((tool) => tool.name).sort(), [SUMMON_TOOL, LIST_TOOL],
  'both summon tools registered')
assert.equal(summonCtx.sections.length, 1, 'one prompt section registered')
assert.equal(summonCtx.sections[0].name, 'workbuddy-market:summon')
assert.equal(summonCtx.sections[0].order, 117)
assert.equal(
  summonCtx.sections[0].text({ agent: { session: { header: { parentSession: 'child' } } } }),
  '',
  'child sessions get an empty section (no recursive summoning)',
)
{
  const parentText = summonCtx.sections[0].text({})
  assert.ok(parentText.includes(SUMMON_TOOL) && parentText.includes(LIST_TOOL),
    'parent sessions are taught both tools')
  assert.ok(parentText.includes('WorkBuddy 专家'), 'the section names the install surface')
}

const summonListTool = summonCtx.registeredTools.find((tool) => tool.name === LIST_TOOL)
const summonRunTool = summonCtx.registeredTools.find((tool) => tool.name === SUMMON_TOOL)

// Tool descriptions guide list-first (acceptance: 先列后召).
assert.ok(summonListTool.description.includes('summon_workbuddy_expert')
  && summonListTool.description.includes('BEFORE'),
'the list tool description points at the summon tool, list-first')
assert.ok(summonListTool.description.includes('category')
  && summonListTool.parameters.properties.category.type === 'string',
'the list tool documents its optional category filter (#23)')
assert.equal(summonListTool.parameters.required, undefined,
  'the category argument stays optional')
assert.ok(summonRunTool.description.includes('workbuddy_experts')
  && /first/.test(summonRunTool.description),
'the summon tool description points back at the list tool')
assert.ok(summonRunTool.description.includes('Chinese name'),
  'the summon tool documents zhName matching')

// List tool over the real scan + real roster classification.
{
  const listed = await summonListTool.execute({}, execStub)
  assert.deepEqual(
    { total: listed.total, ids: listed.experts.map((expert) => expert.id) },
    { total: 1, ids: ['alpha-solo'] },
    'list tool returns exactly the installed (summonable) experts',
  )
  const alpha = listed.experts[0]
  assert.equal(alpha.zhName, '后端架构师')
  assert.equal(alpha.description, 'Use when designing APIs.')
  assert.equal(alpha.zhDescription, '', 'no plugin.json displayDescription → empty string, base survives')
  assert.equal(alpha.category, '02-Engineering',
    'each listed expert carries its raw categoryId (#23 — the verbatim filter key)')
  assert.equal(listed.category, undefined, 'no filter sent → the canonical value carries no category echo')
  const text = summonListTool.output.render({}, listed)[0].text
  assert.ok(text.includes('alpha-solo') && text.includes('后端架构师'),
    'zh list render shows id + zhName')
  assert.ok(text.includes('02-Engineering'), 'the render shows each expert\'s category')
}

// The category filter (#23): verbatim raw-id matching over the summonable
// set, with its own miss guidance (the unfiltered call is the discovery
// path). alpha+delta installed share 02-Engineering; beta's category is
// not installed.
{
  const twoRoster = makeSummonRoster(['alpha-solo', 'delta-solo'])
  const twoCtx = makeSummonCtx({ roster: twoRoster, settings: summonSettings })
  mountWorkbuddySummon(twoCtx, { catalog: createCatalog() })
  const twoListTool = twoCtx.registeredTools.find((tool) => tool.name === LIST_TOOL)

  const unfiltered = await twoListTool.execute({}, execStub)
  assert.deepEqual(unfiltered.experts.map((expert) => expert.id), ['alpha-solo', 'delta-solo'],
    'unfiltered: both installed experts')
  assert.ok(unfiltered.experts.every((expert) => expert.category === '02-Engineering'),
    'unfiltered listing shows the category the filter will match')

  const filtered = await twoListTool.execute({ category: '02-Engineering' }, execStub)
  assert.deepEqual(
    { total: filtered.total, ids: filtered.experts.map((expert) => expert.id), category: filtered.category },
    { total: 2, ids: ['alpha-solo', 'delta-solo'], category: '02-Engineering' },
    'a matching category keeps its experts and echoes the filter',
  )

  const miss = await twoListTool.execute({ category: '06-ContentCreative' }, execStub)
  assert.deepEqual(miss, { experts: [], total: 0, category: '06-ContentCreative' },
    'an installed-but-empty category answers empty with the echo')
  const missText = twoListTool.output.render({}, miss)[0].text
  assert.ok(missText.includes('06-ContentCreative') && missText.includes('不带 category'),
    'the category-miss render names the category and the discovery path')

  const unknown = await twoListTool.execute({ category: '  99-Nowhere  ' }, execStub)
  assert.equal(unknown.category, '99-Nowhere', 'a category argument is trimmed before matching')
  assert.equal(unknown.total, 0, 'an unknown category matches nothing')
  assert.ok(twoListTool.output.render({}, unknown)[0].text.includes('99-Nowhere'),
    'the unknown-category miss renders its own guidance (not the generic empty message)')

  const enMissCtx = makeSummonCtx({
    roster: twoRoster,
    settings: { get: (ns) => (ns === 'locale' ? { preference: 'en' } : ns === SETTINGS_NS ? { sourcePath: summonRoot } : undefined) },
  })
  mountWorkbuddySummon(enMissCtx, { catalog: createCatalog() })
  const enMissTool = enMissCtx.registeredTools.find((tool) => tool.name === LIST_TOOL)
  const enMiss = await enMissTool.execute({ category: '06-ContentCreative' }, execStub)
  assert.ok(enMissTool.output.render({}, enMiss)[0].text.includes('without category'),
    'the en category-miss render carries the EN guidance')
}

// Empty roster → the actionable empty message (zh default).
{
  const emptyCtx = makeSummonCtx({ settings: summonSettings })
  mountWorkbuddySummon(emptyCtx, { catalog: createCatalog() })
  const emptyListTool = emptyCtx.registeredTools.find((tool) => tool.name === LIST_TOOL)
  const emptyListed = await emptyListTool.execute({}, execStub)
  assert.deepEqual(emptyListed, { experts: [], total: 0 }, 'no installs → empty list')
  assert.ok(emptyListTool.output.render({}, emptyListed)[0].text.includes('WorkBuddy 专家'),
    'the empty render points at the market settings page')
}

// English host locale: en render + base fields.
{
  const enCtx = makeSummonCtx({
    roster: alphaRoster,
    settings: { get: (ns) => (ns === 'locale' ? { preference: 'en' } : ns === SETTINGS_NS ? { sourcePath: summonRoot } : undefined) },
  })
  mountWorkbuddySummon(enCtx, { catalog: createCatalog() })
  const enListTool = enCtx.registeredTools.find((tool) => tool.name === LIST_TOOL)
  const enListed = await enListTool.execute({}, execStub)
  assert.equal(enListed.experts[0].zhName, '后端架构师', 'canonical value carries zhName regardless of locale')
  const text = enListTool.output.render({}, enListed)[0].text
  assert.ok(text.includes('alpha-solo') && text.includes('Use when designing APIs.'),
    'en render shows the base description')
}

// Not-installed expert → the install-first error.
await assert.rejects(
  () => summonRunTool.execute({ expert: 'beta-solo', task: '评审一下' }, execStub),
  /WorkBuddy 专家/,
  'uninstalled expert → error tells the user to install it first',
)
await assert.rejects(
  () => summonRunTool.execute({ expert: 'alpha-solo', task: 'x' }, {}),
  /需要由智能体/,
  'missing calling agent rejected',
)
await assert.rejects(
  () => summonRunTool.execute({ expert: 'alpha-solo', task: '   ' }, execStub),
  /不能为空/,
  'blank task rejected through execute',
)
await assert.rejects(
  () => summonRunTool.execute({ expert: 'alpha-solo', task: 'x'.repeat(TASK_MAX_CHARS + 1) }, execStub),
  /过长/,
  'over-limit task rejected through execute',
)
await assert.rejects(
  () => summonRunTool.execute({ expert: '', task: 'x' }, execStub),
  /必须提供/,
  'missing expert argument rejected inside execute (hand-written definition)',
)

// Successful summon by zhName: the start parameters carry the COMPLETE
// persona verbatim and the four-name deny list; the run is disposed.
{
  const okResult = await summonRunTool.execute({ expert: '后端架构师', task: '评审 src/foo.js' }, execStub)
  assert.deepEqual(okResult, { expert: 'alpha-solo', answer: '专家答复' })
  assert.equal(summonCtx.starts.length, 1)
  const start = summonCtx.starts[0]
  assert.deepEqual(Object.keys(start.request).sort(),
    ['label', 'parent', 'persona', 'prompt', 'signal', 'toolFilter'],
    'the start request carries ONLY the designed options — no preset mount, no customSkillDirs (summon mode never touches the packaged skills)')
  assert.equal(start.name, 'spawn', 'uses the spawn provider')
  assert.equal(start.request.label, 'wb-expert:alpha-solo')
  assert.deepEqual(start.request.prompt, [{ type: 'text', text: '评审 src/foo.js' }])
  assert.equal(start.request.parent, execStub.agent, 'parent agent forwarded')
  assert.equal(start.request.signal, execStub.signal, 'cancellation signal forwarded')
  assert.equal(start.request.persona, summonScan.experts.find((expert) => expert.id === 'alpha-solo').persona,
    'the COMPLETE scan-card persona is passed verbatim')
  assert.deepEqual([...start.request.toolFilter.deny], SUMMON_TOOL_NAMES,
    'all four summon tool names denied in the child (both markets)')
  assert.equal(summonCtx.disposeCount(), 1, 'run disposed exactly once')
  assert.equal(summonRunTool.output.render({}, okResult)[0].text, '专家答复', 'render surfaces the answer')
}

// Registry intersection: without the sister plugin's names in the registry
// the deny list shrinks to this plugin's two — the core's tools.restrict()
// throws on unknown names, so verbatim four would fail every child start.
{
  const soloCtx = makeSummonCtx({ roster: alphaRoster, settings: summonSettings })
  mountWorkbuddySummon(soloCtx, { catalog: createCatalog() })
  const soloTool = soloCtx.registeredTools.find((tool) => tool.name === SUMMON_TOOL)
  await soloTool.execute({ expert: 'alpha-solo', task: 'x' }, execStub)
  assert.deepEqual([...soloCtx.starts[0].request.toolFilter.deny], [LIST_TOOL, SUMMON_TOOL],
    'sister-market names absent from the registry → dropped from the deny list')
}

// Failure mapping: a non-completed run becomes a tool error carrying the
// stop reason, diagnostic, and partial output — and is still disposed.
{
  const failCtx = makeSummonCtx({
    roster: alphaRoster,
    settings: summonSettings,
    result: { stopReason: 'error', diagnostic: 'provider boom', output: [{ type: 'text', text: '部分输出' }] },
  })
  mountWorkbuddySummon(failCtx, { catalog: createCatalog() })
  const failTool = failCtx.registeredTools.find((tool) => tool.name === SUMMON_TOOL)
  await assert.rejects(
    () => failTool.execute({ expert: 'alpha-solo', task: 'x' }, execStub),
    (error) => {
      const text = String(error.message)
      return text.includes('error') && text.includes('provider boom') && text.includes('部分输出')
    },
    'failure carries stop reason, diagnostic, and partial output',
  )
  assert.equal(failCtx.disposeCount(), 1, 'failed run disposed too')

  const abortCtx = makeSummonCtx({
    roster: alphaRoster,
    settings: summonSettings,
    result: { stopReason: 'aborted', output: [] },
  })
  mountWorkbuddySummon(abortCtx, { catalog: createCatalog() })
  await assert.rejects(
    () => abortCtx.registeredTools.find((tool) => tool.name === SUMMON_TOOL)
      .execute({ expert: 'alpha-solo', task: 'x' }, execStub),
    /aborted/,
    'a bare non-completed reason still maps to an error',
  )
}

// Provider capability gates.
{
  const noPersonaCtx = makeSummonCtx({
    roster: alphaRoster,
    settings: summonSettings,
    provider: { capabilities: { persona: false, toolFilter: true } },
  })
  mountWorkbuddySummon(noPersonaCtx, { catalog: createCatalog() })
  await assert.rejects(
    () => noPersonaCtx.registeredTools.find((tool) => tool.name === SUMMON_TOOL)
      .execute({ expert: 'alpha-solo', task: 'x' }, execStub),
    /人格/,
    'provider without persona capability rejected',
  )
  const noFilterCtx = makeSummonCtx({
    roster: alphaRoster,
    settings: summonSettings,
    provider: { capabilities: { persona: true, toolFilter: false } },
  })
  mountWorkbuddySummon(noFilterCtx, { catalog: createCatalog() })
  await assert.rejects(
    () => noFilterCtx.registeredTools.find((tool) => tool.name === SUMMON_TOOL)
      .execute({ expert: 'alpha-solo', task: 'x' }, execStub),
    /递归/,
    'provider without toolFilter capability rejected (recursion guard impossible)',
  )
  const noProviderCtx = makeSummonCtx({ roster: alphaRoster, settings: summonSettings, providerMissing: true })
  mountWorkbuddySummon(noProviderCtx, { catalog: createCatalog() })
  await assert.rejects(
    () => noProviderCtx.registeredTools.find((tool) => tool.name === SUMMON_TOOL)
      .execute({ expert: 'alpha-solo', task: 'x' }, execStub),
    /未注册/,
    'missing provider rejected',
  )
}

// The mount disposer drops every side effect.
offSummon()
assert.equal(summonCtx.registeredTools.length, 0, 'tools unregistered')
assert.equal(summonCtx.sections.length, 0, 'prompt section unregistered')

rmSync(summonRosterDir, { recursive: true, force: true })
rmSync(summonRoot, { recursive: true, force: true })

// ── 9. schemastery resolver (reporting, never gating) ────────────────────────

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
