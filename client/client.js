/**
 * dsh-workbuddy-market browser client (ticket #8): the READ-ONLY market page,
 * hand-written in the harness client-bundle format: `window.__ModuleLoader__
 * .load({ id, factory })`, CJS-style module, externals resolved through the
 * injected `require` (react only). There is no build step — this file IS the
 * artifact package.json exports as "./client". The wrapper shape, the
 * settings.section registration, the theme-token CSS with hard fallbacks,
 * and the zh/en dictionaries all mirror the sister plugin's verified bundle
 * (dsh-agency-market/client/client.js) verbatim where the two pages overlap.
 *
 * It registers exactly one client surface:
 *   - one `settings.section` entry ("WorkBuddy 专家"): the read-only half of
 *     the market — a yellow banner when the source path does not exist
 *     (pathExists=false), a census line (experts / source plugins), full-width
 *     bilingual search (the base English fields are always in the haystack,
 *     so a query hits in either UI language), five single-select filter
 *     chips (all / installed / updatable / with-skills / team) with live
 *     counts, a collapsed-by-default scan-warnings fold, and a card grid.
 *     Each card carries the expert's PNG avatar (onError swaps to a static
 *     🧑‍💻 emoji — no placeholder request ever), a name + description that
 *     follow the UI language (zhName/zhDescription vs the base fields),
 *     provenance badges (source plugin dir, skills count, team size), and
 *     status marks rendered TOLERANTLY — ✓ installed / ↑ updatable / ⚠
 *     broken appear only when the state payload carries the field; the
 *     read-only page neither requires nor fabricates them.
 *
 * Deliberately NOT here (later tickets): the source-path editor and refresh
 * button (#9, the mutating half — this page pulls /api/state exactly once
 * per mount; the payload is bilingual so a locale switch re-renders without
 * refetching), install/update/uninstall actions (#9), and the summon entry
 * points (#10).
 *
 * One intentional deviation from the sister, required by this ticket's
 * acceptance ("disposer clears the slot AND the style"): the scoped
 * <style data-plugin> tag is injected inside apply() and removed by the
 * disposer apply() returns, so the cleanup is owned by this fiber rather
 * than delegated to the module loader. The tag keeps the same
 * data-plugin / data-plugin-css attributes, the loader's own unload-time
 * sweep stays a harmless second line of defense, and a re-apply after a
 * dispose re-injects idempotently through the querySelector guard.
 */
window.__ModuleLoader__.load({ id: "dsh-workbuddy-market", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

var NS = 'dsh-workbuddy-market'
var API_BASE = '/dsh-workbuddy-market/api'

// The directory's second voice: ids, plugin dirs, counts, and the census run
// in mono.
var MONO = 'var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)'

// The static avatar fallback — a plain glyph, never a network request.
var AVATAR_EMOJI = '🧑‍💻'

var CSS = `
.wbm-page { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 2px; }

/* ── the yellow banner: source path missing (design #3) ─────────────────── */
.wbm-banner { display: flex; align-items: baseline; gap: 6px 8px; flex-wrap: wrap;
  padding: 9px 12px; font-size: 12px; line-height: 1.6; border-radius: 10px;
  color: var(--dsw-alias-state-warn-primary, #c77700);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c77700) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c77700) 42%, transparent); }
.wbm-banner-path { font-family: ${MONO}; font-size: 11px; }
.wbm-banner-hint { color: var(--dsw-alias-label-tertiary, inherit); }

/* ── header: title block + quiet mono census ─────────────────────────────── */
.wbm-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; }
.wbm-head-main { min-width: 0; }
.wbm-head h2 { margin: 0 0 4px; font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); }
.wbm-subtitle { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary, inherit); }
.wbm-census { display: inline-flex; gap: 12px; flex: none; padding-bottom: 2px;
  font-family: ${MONO}; font-size: 11px; line-height: 1.5; font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary, inherit); white-space: nowrap; }
.wbm-census-item { border-radius: 4px; padding: 0 2px; }

/* ── search owns its row — the primary path through a 50-card corpus ─────── */
.wbm-search { width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 13px; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35)); outline: none;
  background: var(--dsw-alias-bg-layer-1, transparent); color: var(--dsw-alias-label-primary, inherit); }
.wbm-search:focus { border-color: var(--dsw-alias-brand-primary, currentColor); }
.wbm-search::placeholder { color: var(--dsw-alias-label-tertiary, inherit); }

/* ── filter chips: five single-select states, each with its live count ───── */
.wbm-toolbar { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.wbm-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; font-size: 12px; line-height: 1.4;
  border-radius: 999px; cursor: pointer; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35));
  background: transparent; color: var(--dsw-alias-label-secondary, inherit); }
.wbm-chip:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.1)); }
.wbm-chip[data-active="true"] { background: var(--dsw-alias-brand-primary, #4f6ef7); border-color: transparent; color: #fff; }
.wbm-chip-count { font-family: ${MONO}; font-size: 10px; line-height: 1;
  font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-chip[data-active="true"] .wbm-chip-count { color: rgba(255,255,255,.78); }

/* ── match feedback: the filter stays visible while typing ───────────────── */
.wbm-matchline { margin: 0; font-family: ${MONO}; font-size: 11px; line-height: 1.5;
  font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-tertiary, inherit); }

/* ── scan warnings: a quiet fold, collapsed by default ───────────────────── */
.wbm-warns { border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c77700) 38%, transparent);
  border-radius: 10px; background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c77700) 4%, transparent); }
.wbm-warns-toggle { display: flex; width: 100%; box-sizing: border-box; align-items: center; gap: 6px;
  padding: 8px 12px; font-size: 12px; line-height: 1.5; border: none; border-radius: 10px;
  background: transparent; cursor: pointer; text-align: left;
  color: var(--dsw-alias-state-warn-primary, #c77700); }
.wbm-warns-toggle:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.1)); }
.wbm-warns-caret { flex: none; font-size: 10px; line-height: 1; }
.wbm-warns-list { margin: 0; padding: 0 14px 10px; font-size: 12px; line-height: 1.7; list-style: disc;
  color: var(--dsw-alias-label-secondary, inherit); }
.wbm-warns-list li + li { margin-top: 2px; }
.wbm-warns-list li::marker { color: var(--dsw-alias-state-warn-primary, #c77700); }

/* ── the card grid ────────────────────────────────────────────────────────── */
.wbm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 10px;
  list-style: none; margin: 0; padding: 0; }
.wbm-card { display: flex; flex-direction: column; gap: 7px; box-sizing: border-box; min-width: 0;
  padding: 12px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.28)); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1, transparent); }
.wbm-card:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.06)); }
.wbm-card[data-installed="true"] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e9e5b) 4%, transparent); }
.wbm-card[data-broken="true"] { border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c77700) 45%, transparent); }
.wbm-card-top { display: flex; align-items: center; gap: 10px; min-width: 0; }
.wbm-avatar { width: 40px; height: 40px; flex: none; border-radius: 10px; object-fit: cover;
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.18)); }
.wbm-emoji { display: inline-flex; width: 40px; height: 40px; flex: none; align-items: center; justify-content: center;
  font-size: 22px; line-height: 1; border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.18)); }
.wbm-card-title { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.wbm-name { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wbm-id { font-family: ${MONO}; font-size: 11px; line-height: 1.4; color: var(--dsw-alias-label-tertiary, inherit);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wbm-desc { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary, inherit);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.wbm-badges { display: flex; flex-wrap: wrap; gap: 4px 6px; }
.wbm-badge { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  box-sizing: border-box; padding: 2px 7px; font-size: 10px; line-height: 1.5; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3));
  color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-badge[data-kind="plugin"] { font-family: ${MONO}; font-size: 10px; }
.wbm-badge[data-kind="team"] { color: var(--dsw-alias-brand-primary, #4f6ef7);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #4f6ef7) 40%, transparent); }
.wbm-status { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; margin-top: auto; padding-top: 2px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18)); }
.wbm-mark { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; white-space: nowrap; }
.wbm-mark[data-kind="ok"] { color: var(--dsw-alias-state-success-primary, #2e9e5b); }
.wbm-mark[data-kind="upd"] { color: var(--dsw-alias-brand-primary, #4f6ef7); }
.wbm-mark[data-kind="bad"] { color: var(--dsw-alias-state-warn-primary, #c77700); }

/* ── states: skeleton loading, actionable empty, error + retry ───────────── */
.wbm-skel { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 10px; }
.wbm-skel-card { height: 128px; border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.2)); animation: wbm-skel 1.4s ease-in-out infinite; }
.wbm-skel-card:nth-child(3n) { animation-delay: .12s; }
@keyframes wbm-skel { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
.wbm-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 36px 12px; text-align: center; }
.wbm-empty-face { font-size: 28px; line-height: 1; opacity: .55; }
.wbm-empty-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-secondary, inherit); }
.wbm-empty-tip { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-notice { padding: 8px 12px; font-size: 12px; line-height: 1.6; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3)); }
.wbm-notice[data-kind="error"] { color: var(--dsw-alias-state-error-primary, #d5484f); }
.wbm-btn { padding: 5px 12px; font-size: 12px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35)); background: transparent;
  color: var(--dsw-alias-label-primary, inherit); }
.wbm-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.1)); }
.wbm-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* ── quality floor: visible keyboard focus, calm motion ──────────────────── */
.wbm-btn:focus-visible, .wbm-chip:focus-visible, .wbm-search:focus-visible, .wbm-warns-toggle:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .wbm-skel-card { animation: none; }
}
`

/**
 * Inject the scoped stylesheet, idempotently. Returns the tag THIS call
 * created (the caller's disposer owns removing it), or null when a tag is
 * already present from a sibling apply of the same module instance.
 */
function ensureStyle () {
  if (typeof document === 'undefined' || document === null) return null
  var tagId = NS + '/main.css'
  if (document.querySelector('style[data-plugin-css="' + tagId + '"]') !== null) return null
  var tag = document.createElement('style')
  tag.dataset.plugin = NS
  tag.dataset.pluginCss = tagId
  tag.textContent = CSS
  document.head.appendChild(tag)
  return tag
}

/** Remove a tag ensureStyle() created; absent-safe. */
function removeStyle (tag) {
  if (tag === null || tag === undefined) return
  tag.remove()
}

var React = require('react')
var el = React.createElement

var DICTS = {
  zh: {
    nav: 'WorkBuddy 专家',
    title: 'WorkBuddy 专家市场',
    subtitle: '本地 WorkBuddy 目录扫描出的专家一览（只读）。',
    censusExperts: '专家 {n}',
    censusPlugins: '来源插件 {n}',
    search: '搜索名称、描述或 id —— 中英文都行',
    filterAll: '全部',
    filterInstalled: '已装',
    filterUpdatable: '可更新',
    filterSkills: '含技能',
    filterTeam: '团队',
    matchesPlain: '共 {n} 位',
    matchesEcho: '匹配 {n} 位 ·「{q}」',
    emptyHint: '没有匹配的专家',
    emptyTip: '若源目录为空，先看上方的路径提醒。',
    clearFilters: '清除筛选',
    bannerMissingPath: '源路径不存在：',
    bannerMissingHint: '目录未挂载或路径有误——修复后此提醒自动消失。',
    warningsToggle: '扫描警告 {n} 条',
    loadFailed: '市场数据加载失败',
    retry: '重试',
    busy: '加载中…',
    installedStamp: '已装',
    updatableStamp: '可更新',
    brokenStamp: '预设损坏',
    skillsBadge: '技能 {n}',
    teamBadge: '团队 ·{n}'
  },
  en: {
    nav: 'WorkBuddy Experts',
    title: 'WorkBuddy Expert Market',
    subtitle: 'A read-only view of experts scanned from your local WorkBuddy directory.',
    censusExperts: '{n} experts',
    censusPlugins: '{n} plugins',
    search: 'Search names, descriptions, or ids — both languages',
    filterAll: 'All',
    filterInstalled: 'Installed',
    filterUpdatable: 'Updatable',
    filterSkills: 'With skills',
    filterTeam: 'Team',
    matchesPlain: '{n} shown',
    matchesEcho: '{n} matches for "{q}"',
    emptyHint: 'No matching experts',
    emptyTip: 'If the source directory is empty, check the path notice above.',
    clearFilters: 'Clear filters',
    bannerMissingPath: 'Source path does not exist:',
    bannerMissingHint: 'The directory is missing or mistyped — the notice clears once it is fixed.',
    warningsToggle: '{n} scan warnings',
    loadFailed: 'Failed to load market data',
    retry: 'Retry',
    busy: 'Loading…',
    installedStamp: 'installed',
    updatableStamp: 'updatable',
    brokenStamp: 'preset broken',
    skillsBadge: '{n} skills',
    teamBadge: 'team ·{n}'
  }
}

/** Fallback translator: zh dict → key, with {placeholder} interpolation. */
function fallbackT (key, params) {
  var template = DICTS.zh[key] || key
  return interpolate(template, params)
}

function interpolate (template, params) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, function (whole, name) {
    return params[name] !== undefined ? String(params[name]) : whole
  })
}

/** Same-origin JSON fetch; throws host-sent error messages when present. */
function api (path, options) {
  var init = Object.assign({ credentials: 'same-origin' }, options || {})
  return fetch(path, init).then(function (response) {
    return response.json().catch(function () { return {} }).then(function (body) {
      if (!response.ok) throw new Error(body && body.error ? body.error : 'HTTP ' + response.status)
      return body
    })
  })
}

// ── pure card derivations (exported for the offline smoke) ──────────────────

/** A trimmed string field ('' for anything else). */
function strOf (value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** The localized-then-base pick shared by the name and description chains. */
function localePick (zh, base, localeId) {
  return localeId === 'zh' ? (zh !== '' ? zh : base) : (base !== '' ? base : zh)
}

/**
 * The card name under one UI language: the localized field first, the BASE
 * field as fallback — the base (English) fields always exist, so no card is
 * ever nameless in either language.
 */
function localeNameOf (expert, localeId) {
  var pick = localePick(strOf(expert.zhName), strOf(expert.name), localeId)
  return pick !== '' ? pick : strOf(expert.id)
}

/** The card description under one UI language, same localized-then-base chain. */
function localeDescriptionOf (expert, localeId) {
  return localePick(strOf(expert.zhDescription), strOf(expert.description), localeId)
}

/** Team card = the plugin directory holds more than one agent file. */
function isTeam (expert) {
  return typeof expert.teamSize === 'number' && expert.teamSize > 1
}

/** Skills badge eligibility = the scan saw at least one skills/ subdirectory. */
function hasSkills (expert) {
  return Array.isArray(expert.skills) && expert.skills.length > 0
}

/**
 * The search haystack of one card. Both languages' name/description are
 * always present (the BASE fields are never dropped — a Chinese query hits
 * under an English UI and vice versa), plus the id, the source plugin dir,
 * and every skill name.
 */
function haystackOf (expert) {
  return [strOf(expert.id), strOf(expert.name), strOf(expert.zhName),
    strOf(expert.description), strOf(expert.zhDescription), strOf(expert.pluginDir),
    (Array.isArray(expert.skills) ? expert.skills : []).join(' ')].join(' ').toLowerCase()
}

/**
 * The five filter-chip states in toolbar order — ONE table drives the
 * toolbar, the filter pass, and the per-chip counts (the localized labels
 * stay per-language data keyed by `key`). Each `keep` predicate IS the
 * chip's tolerant contract: absent state fields never match.
 */
var FILTERS = [
  { id: 'all', key: 'filterAll', stat: 'total', keep: function () { return true } },
  { id: 'installed', key: 'filterInstalled', stat: 'installed',
    keep: function (expert) { return expert.installed === true } },
  { id: 'updatable', key: 'filterUpdatable', stat: 'updatable',
    keep: function (expert) { return expert.updatable === true } },
  { id: 'skills', key: 'filterSkills', stat: 'skills', keep: hasSkills },
  { id: 'team', key: 'filterTeam', stat: 'team', keep: isTeam }
]

/** The table entry of one filter id (unknown ids degrade to 'all'). */
function filterOf (filterId) {
  for (var i = 0; i < FILTERS.length; i++) {
    if (FILTERS[i].id === filterId) return FILTERS[i]
  }
  return FILTERS[0]
}

/**
 * One filter pass: the chip state crossed with a free-text query. Pure and
 * synchronous — search and filtering are purely client-side by design
 * (ticket #8).
 */
function filterExperts (experts, filter, query) {
  var keep = filterOf(filter).keep
  var q = strOf(query).toLowerCase()
  return experts.filter(function (expert) {
    if (!keep(expert)) return false
    if (q === '') return true
    return haystackOf(expert).indexOf(q) !== -1
  })
}

// ── the card ────────────────────────────────────────────────────────────────

/**
 * One expert card: avatar (PNG via avatarUrl; onError OR a PNG-less card
 * falls back to the static 🧑‍💻 emoji — no placeholder request), a
 * locale-following name over the mono id, a locale-following two-line
 * description, provenance badges (source plugin / skills count / team), and
 * TOLERANT status marks — ✓ installed / ↑ updatable / ⚠ broken render only
 * when the state payload carries the field, so this page works both before
 * and after the install-state ticket lands.
 */
function ExpertCard (props) {
  var t = props.t
  var expert = props.expert
  var localeId = props.localeId

  var avatarState = React.useState(false)
  var avatarFailed = avatarState[0]
  var setAvatarFailed = avatarState[1]

  var avatar
  if (!avatarFailed && strOf(expert.avatarUrl) !== '') {
    avatar = el('img', {
      className: 'wbm-avatar',
      src: expert.avatarUrl,
      alt: '',
      loading: 'lazy',
      decoding: 'async',
      onError: function () { setAvatarFailed(true) }
    })
  } else {
    avatar = el('span', { className: 'wbm-emoji', 'aria-hidden': 'true' }, AVATAR_EMOJI)
  }

  var name = localeNameOf(expert, localeId)
  var badges = []
  var pluginDir = strOf(expert.pluginDir)
  if (pluginDir !== '') {
    badges.push(el('span', { key: 'plugin', className: 'wbm-badge', 'data-kind': 'plugin', title: pluginDir }, pluginDir))
  }
  if (hasSkills(expert)) {
    badges.push(el('span', { key: 'skills', className: 'wbm-badge', 'data-kind': 'skills' },
      t('skillsBadge', { n: expert.skills.length })))
  }
  if (isTeam(expert)) {
    badges.push(el('span', { key: 'team', className: 'wbm-badge', 'data-kind': 'team' },
      t('teamBadge', { n: expert.teamSize })))
  }

  // Status marks, tolerant to absent fields (they arrive with the
  // install-state ticket; missing means "not marked", never "no").
  var marks = []
  if (expert.broken === true) {
    marks.push(el('span', { key: 'broken', className: 'wbm-mark', 'data-kind': 'bad' }, '⚠ ', t('brokenStamp')))
  }
  if (expert.installed === true) {
    marks.push(el('span', { key: 'installed', className: 'wbm-mark', 'data-kind': 'ok' }, '✓ ', t('installedStamp')))
  }
  if (expert.updatable === true) {
    marks.push(el('span', { key: 'updatable', className: 'wbm-mark', 'data-kind': 'upd' }, '↑ ', t('updatableStamp')))
  }

  return el('li', {
    className: 'wbm-card',
    'data-installed': expert.installed === true ? 'true' : undefined,
    'data-broken': expert.broken === true ? 'true' : undefined
  },
    el('div', { className: 'wbm-card-top' },
      avatar,
      el('div', { className: 'wbm-card-title' },
        el('span', { className: 'wbm-name', title: name }, name),
        el('span', { className: 'wbm-id' }, strOf(expert.id)))),
    el('p', { className: 'wbm-desc' }, localeDescriptionOf(expert, localeId)),
    badges.length > 0 ? el('div', { className: 'wbm-badges' }, badges) : null,
    marks.length > 0 ? el('div', { className: 'wbm-status' }, marks) : null)
}

// ── the market page (read-only half) ────────────────────────────────────────

/**
 * The settings-section page. Read-only: it pulls /api/state once per mount
 * (the payload is bilingual — a locale switch re-renders names/descriptions
 * without refetching), and every search/filter interaction is pure
 * client-side derivation over that one snapshot.
 */
function MarketPage (props) {
  var t = props.t

  // Optional initial snapshot seam: undefined in production (the page fetches
  // on mount); the offline smoke renders real states through it.
  var stateState = React.useState(props.initialState === undefined ? null : props.initialState)
  var setState = stateState[1]
  var body = stateState[0]
  var experts = body !== null && body !== undefined && Array.isArray(body.experts) ? body.experts : null

  var errorState = React.useState('')
  var setError = errorState[1]
  var error = errorState[0]

  var queryState = React.useState('')
  var setQuery = queryState[1]
  var query = queryState[0]

  var filterState = React.useState('all')
  var setFilter = filterState[1]
  var filter = filterState[0]

  // Scan warnings fold: collapsed by default — warnings are provenance, not
  // an alarm; the count is visible either way.
  var warnOpenState = React.useState(false)
  var setWarnOpen = warnOpenState[1]
  var warnOpen = warnOpenState[0]

  // The UI language, synced LIVE off the locale service: the settings.section
  // outlet re-renders on every locale switch (its locale seat's revision
  // bumps), and this deps-less effect then syncs the id. Names/descriptions
  // re-derive from the SAME bilingual snapshot — no refetch needed.
  var localeState = React.useState(function () { return props.getLocale() })
  var localeId = localeState[0]
  var setLocaleId = localeState[1]
  React.useEffect(function () {
    var next = props.getLocale()
    if (next !== localeId) setLocaleId(next)
  })

  // The single read-only pull (plus the retry affordance on failure). No
  // polling, no refresh — the mutating half (ticket #9) owns rescans.
  var refresh = React.useCallback(function () {
    return api(API_BASE + '/state').then(function (payload) {
      setState(payload)
      setError('')
    }, function (err) {
      setError(err && err.message ? err.message : String(err))
    })
  }, [])

  React.useEffect(function () { refresh() }, [refresh])

  var filtered = React.useMemo(function () {
    if (experts === null) return []
    return filterExperts(experts, filter, query)
  }, [experts, filter, query])

  // Census + per-chip counts, in one pass over the full table — the chip
  // predicates come from the shared FILTERS table, so a new chip counts
  // itself.
  var stats = React.useMemo(function () {
    if (experts === null) return null
    var out = { total: experts.length, plugins: 0 }
    var pluginDirs = {}
    for (var f = 1; f < FILTERS.length; f++) out[FILTERS[f].stat] = 0
    for (var i = 0; i < experts.length; i++) {
      var expert = experts[i]
      for (var g = 1; g < FILTERS.length; g++) {
        if (FILTERS[g].keep(expert)) out[FILTERS[g].stat]++
      }
      pluginDirs[strOf(expert.pluginDir)] = true
    }
    out.plugins = Object.keys(pluginDirs).length
    return out
  }, [experts])

  var warnings = body !== null && body !== undefined && Array.isArray(body.warnings) ? body.warnings : []
  var missingPath = body !== null && body !== undefined && body.pathExists === false

  var clearFilters = function () {
    setQuery('')
    setFilter('all')
  }

  // null (not undefined) before the first fetch lands — cover both so the
  // skeleton, not the empty state, owns the first paint.
  var loading = experts === null

  var cards = null
  if (loading) {
    cards = el('div', { 'aria-hidden': 'true' },
      el('p', { className: 'wbm-sr-only', role: 'status' }, t('busy')),
      el('div', { className: 'wbm-skel' },
        [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
          return el('div', { className: 'wbm-skel-card', key: i })
        })))
  } else if (filtered.length === 0) {
    cards = el('div', { className: 'wbm-empty' },
      el('span', { className: 'wbm-empty-face', 'aria-hidden': 'true' }, AVATAR_EMOJI),
      el('p', { className: 'wbm-empty-title' }, t('emptyHint')),
      el('p', { className: 'wbm-empty-tip' }, t('emptyTip')),
      el('button', { className: 'wbm-btn', type: 'button', onClick: clearFilters }, t('clearFilters')))
  } else {
    cards = el('ul', { className: 'wbm-grid' },
      filtered.map(function (expert) {
        return el(ExpertCard, { key: strOf(expert.id), t: t, expert: expert, localeId: localeId })
      }))
  }

  var filteredActive = !loading && (query.trim() !== '' || filter !== 'all')

  return el('div', { className: 'wbm-page' },
    missingPath
      ? el('div', { className: 'wbm-banner', role: 'alert' },
          el('span', null, t('bannerMissingPath')),
          el('span', { className: 'wbm-banner-path' }, strOf(body.sourcePath)),
          el('span', { className: 'wbm-banner-hint' }, t('bannerMissingHint')))
      : null,
    el('header', { className: 'wbm-head' },
      el('div', { className: 'wbm-head-main' },
        el('h2', null, t('title')),
        el('p', { className: 'wbm-subtitle' }, t('subtitle'))),
      stats !== null
        ? el('span', { className: 'wbm-census' },
            el('span', { className: 'wbm-census-item' }, t('censusExperts', { n: stats.total })),
            el('span', { className: 'wbm-census-item' }, t('censusPlugins', { n: stats.plugins })))
        : null),
    el('input', {
      className: 'wbm-search',
      type: 'search',
      value: query,
      placeholder: t('search'),
      onChange: function (event) { setQuery(event.target.value) }
    }),
    el('div', { className: 'wbm-toolbar' },
      FILTERS.map(function (chip) {
        var active = filter === chip.id
        return el('button', {
          key: chip.id,
          className: 'wbm-chip', type: 'button',
          'aria-pressed': active ? 'true' : 'false',
          'data-active': active ? 'true' : undefined,
          onClick: function () { setFilter(chip.id) }
        },
          t(chip.key),
          stats !== null
            ? el('span', { className: 'wbm-chip-count' }, String(stats[chip.stat]))
            : null)
      })),
    filteredActive
      ? el('p', { className: 'wbm-matchline', role: 'status' },
          query.trim() !== ''
            ? t('matchesEcho', { n: filtered.length, q: query.trim() })
            : t('matchesPlain', { n: filtered.length }))
      : null,
    warnings.length > 0
      ? el('div', { className: 'wbm-warns' },
          el('button', {
            className: 'wbm-warns-toggle', type: 'button',
            'aria-expanded': warnOpen ? 'true' : 'false',
            onClick: function () { setWarnOpen(!warnOpen) }
          },
            el('span', { className: 'wbm-warns-caret', 'aria-hidden': 'true' }, warnOpen ? '▾' : '▸'),
            t('warningsToggle', { n: warnings.length })),
          warnOpen
            ? el('ul', { className: 'wbm-warns-list' },
                warnings.map(function (warning, index) {
                  return el('li', { key: index }, String(warning))
                }))
            : null)
      : null,
    error !== ''
      ? el('div', { className: 'wbm-notice', 'data-kind': 'error', role: 'alert' },
          t('loadFailed') + '：' + error + ' ',
          el('button', { className: 'wbm-btn', type: 'button', onClick: refresh }, t('retry')))
      : null,
    cards)
}

function apply (ctx) {
  var t = fallbackT
  var locale = ctx.locale
  if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
    try {
      locale.register(NS, DICTS)
      var bound = locale.bind(NS)
      if (typeof bound === 'function') {
        t = function (key, params) {
          var text = bound(key, params)
          return typeof text === 'string' ? text : fallbackT(key, params)
        }
      }
    } catch (error) {
      t = fallbackT
    }
  }

  // Current UI language, read LIVE off the locale service so card names and
  // descriptions always match what the user sees; zh when the service is
  // missing or has not resolved a language yet.
  var getLocale = function () { return 'zh' }
  if (locale && typeof locale.getLocale === 'function') {
    getLocale = function () {
      var snapshot = locale.getLocale()
      return snapshot !== undefined && snapshot !== null && typeof snapshot.active === 'string' && snapshot.active !== ''
        ? snapshot.active
        : 'zh'
    }
  }

  var slots = ctx.slots
  if (slots === undefined || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
    if (ctx.logger && typeof ctx.logger.warn === 'function') {
      ctx.logger.warn('dsh-workbuddy-market: slots service unavailable; market page not registered')
    }
    return
  }

  // Every registration below returns a disposer. slots.inject already rides
  // ctx.effect in the runtime, and re-disposing from the disposer apply()
  // returns is idempotent — collect them all so one call releases the whole
  // surface (settings page entry + scoped style tag).
  var disposers = []
  function collect (disposer) {
    if (typeof disposer === 'function') disposers.push(disposer)
  }

  collect(slots.inject('settings.section', function () {
    return slots.register({
      name: 'settings.section',
      id: 'workbuddy-market',
      order: 46,
      label: function () { return t('nav') },
      locale: NS,
      inject: function () { return { t: t } }
    }, function () {
      return el(MarketPage, { t: t, getLocale: getLocale })
    })
  }))

  // The scoped style tag is injected only after every registration succeeded
  // (a failed apply must not leak it), and its removal joins the disposers —
  // this fiber owns the cleanup (see the header note for the why).
  var styleTag = ensureStyle()
  collect(function () { removeStyle(styleTag) })

  return function () {
    for (var i = 0; i < disposers.length; i++) disposers[i]()
  }
}

// Array-form inject only (object form means intercept config in this cordis).
// 'slots' comes with the client runtime core; 'locale' is provided by
// dsh-client-locale, which package.json dsh.client.inject composes alongside
// dsh-client-ui-settings (the settings.section slot's declaring owner).
module.exports = { name: NS, inject: ['slots', 'locale'], apply: apply }
// Extra exports for offline smoke checks (scripts/smoke.mjs); the module
// loader treats unknown plugin keys as inert.
module.exports.DICTS = DICTS
module.exports.AVATAR_EMOJI = AVATAR_EMOJI
module.exports.filterExperts = filterExperts
module.exports.localeNameOf = localeNameOf
module.exports.localeDescriptionOf = localeDescriptionOf
module.exports.ExpertCard = ExpertCard
module.exports.MarketPage = MarketPage
return module.exports;
} });
