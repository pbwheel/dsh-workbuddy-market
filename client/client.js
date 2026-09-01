/**
 * dsh-workbuddy-market browser client: the market page, hand-written in the
 * harness client-bundle format: `window.__ModuleLoader__.load({ id,
 * factory })`, CJS-style module, externals resolved through the injected
 * `require` (react only). There is no build step — this file IS the
 * artifact package.json exports as "./client". The wrapper shape, the
 * settings.section registration, the theme-token CSS with hard fallbacks,
 * and the zh/en dictionaries all mirror the sister plugin's verified bundle
 * (dsh-agency-market/client/client.js) verbatim where the two pages overlap.
 *
 * Ticket #8 shipped the read-only half; ticket #9 (this file's current
 * shape) adds the MUTATING half on the same page:
 *
 *   - the source-path topbar: a mono path input + 应用 (apply) + a refresh
 *     button whose icon SPINS while the rescan runs and is disabled for the
 *     whole flight (no double submits). Apply posts { sourcePath,
 *     expectedRevision } — the revision is the settings namespace's
 *     optimistic lock, so a second tab's change answers 409
 *     SETTINGS_CONFLICT, which renders BOTH revisions in a warn box with a
 *     重试 button that re-pulls the fresh revision and replays the same
 *     draft. Saving a nonexistent path is allowed (design #3): the page
 *     answers with the yellow banner, and fixing the path clears it on the
 *     next apply — 改错 → 黄条, 改对 → 自动恢复;
 *   - inline install/update/uninstall on every card, ALL behind the
 *     sister's inline confirmation: the action button swaps for a
 *     confirm/cancel pair that auto-reverts after 4 seconds. One lane at a
 *     time client-side too — while any row action is in flight that row
 *     shows a disabled 处理中… and every other mutating control disables —
 *     so the host's single-flight 409 (a second tab racing us) lands in a
 *     handler that surfaces it as an error notice and always releases the
 *     busy state: the UI never wedges, every button comes back;
 *   - every action refetches /api/state on success (the response's fresh
 *     overlay flips ✓ 已装 / ↑ 可更新 within a second of the click), and
 *     the orphans panel lists wb-* presets installed from another source
 *     with full provenance (preset id, source path, plugin dir/agent file,
 *     import date, broken flag) and its own confirmed uninstall — the
 *     roster, not the scan table, is the uninstall authority.
 *
 * Ticket #11 (this file's current addition) ships the two summon entry
 * points on top of the page, both mirroring the sister plugin's verified
 * surfaces verbatim where they overlap (dsh-agency-market/client/
 * client.js):
 *
 *   - one `conversation.input.left` entry: the 召唤专家 pill button. Its
 *     popover lists INSTALLED WorkBuddy experts with a filter box (once
 *     the roster passes eight), each card's PNG avatar (the same face the
 *     market grid shows, emoji fallback) beside the localized name over
 *     the mono id + description, arrow-key navigation, Escape to close,
 *     and a footer that promises the pick only writes a DRAFT — never
 *     auto-sends. Zero installs (healthy route) opens the market settings
 *     section instead; a failed route still opens the popover with
 *     empty-state copy;
 *   - one '@' input trigger source ("workbuddy-market") feeding the SAME
 *     installed roster into the composer's @ menu. Registered only when
 *     the inputTriggers service is composed (package.json
 *     dsh.client.inject lists dsh-client-ui-input-trigger — restored by
 *     this ticket); skipped silently otherwise.
 *
 * Both draft the SAME instruction template (zh/en), whose tool wording
 * follows src/summon.js: the draft asks the MODEL to call
 * summon_workbuddy_expert — the client never calls the tool itself, it
 * only writes the draft. The roster comes from GET /api/state's install
 * overlay (expert.installed === true — exactly the set the host's
 * workbuddy_experts lists: orphans from another source never flag a card
 * installed, broken installs stay summonable).
 *
 * One intentional deviation from the sister, kept from ticket #8: the
 * scoped <style data-plugin> tag is injected inside apply() and removed by
 * the disposer apply() returns, so the cleanup is owned by this fiber
 * rather than delegated to the module loader.
 *
 * Ticket #12 (P4 polish) rounds the market page out on the same file:
 *
 *   - the team group view: cards are grouped by their source plugin; a
 *     team renders as ONE collapsible section (caret, the first four
 *     members' faces, the mono plugin dir, the team badge, shown/total
 *     counts, and aggregated ✓/↑/⚠ counts over the SHOWN members) whose
 *     members expand in place as ordinary cards. Solo cards are untouched.
 *     Grouping is presentation only — chips, the matchline, and the census
 *     keep counting expert cards; a query or filter chip expands every
 *     group by default so matched members are visible without a second
 *     click, and an explicit user fold wins over that default either way;
 *   - the bulk update (一键全更): one entry button while any card is
 *     updatable, then a SERIAL walk — one /api/update at a time, a fresh
 *     /api/state after every completion so each finished card flips
 *     within a second, then the next. A mid-run failure parks the walk
 *     with the remaining queue and the host error; 继续更新剩余 resumes
 *     the walk from the next entry (the failed card keeps its own ↑ and
 *     row button). The run holds the page's shared mutation lane while
 *     walking and releases it on failure.
 */
window.__ModuleLoader__.load({ id: "dsh-workbuddy-market", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;

var NS = 'dsh-workbuddy-market'
var API_BASE = '/dsh-workbuddy-market/api'

// The directory's second voice: ids, plugin dirs, counts, paths, and the
// census run in mono.
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

/* ── the mutating topbar: source path input + apply + refresh (#9) ───────── */
.wbm-pathbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.wbm-path-field { flex: 1 1 240px; min-width: 0; }
.wbm-path-input { width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border-radius: 8px;
  font-family: ${MONO};
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35)); outline: none;
  background: var(--dsw-alias-bg-layer-1, transparent); color: var(--dsw-alias-label-primary, inherit); }
.wbm-path-input:focus { border-color: var(--dsw-alias-brand-primary, currentColor); }
.wbm-path-input::placeholder { color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-refresh { display: inline-flex; align-items: center; gap: 5px; }
.wbm-spin { animation: wbm-spin .9s linear infinite; }
@keyframes wbm-spin { to { transform: rotate(360deg); } }

/* ── the revision conflict box: both sides' revisions + retry (#9) ───────── */
.wbm-conflict { display: flex; gap: 6px 10px; flex-wrap: wrap; align-items: center;
  padding: 9px 12px; font-size: 12px; line-height: 1.6; border-radius: 10px;
  color: var(--dsw-alias-state-warn-primary, #c77700);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c77700) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c77700) 42%, transparent); }
.wbm-conflict-body { flex: 1 1 240px; min-width: 0; }
.wbm-conflict-title { display: block; font-weight: 600; }
.wbm-conflict-detail { display: block; font-family: ${MONO}; font-size: 11px; }

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

/* ── the card footer: status marks over the inline action row (#9) ───────── */
.wbm-foot { margin-top: auto; padding-top: 7px; display: flex; flex-direction: column; gap: 6px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18)); }
.wbm-status { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
.wbm-mark { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; white-space: nowrap; }
.wbm-mark[data-kind="ok"] { color: var(--dsw-alias-state-success-primary, #2e9e5b); }
.wbm-mark[data-kind="upd"] { color: var(--dsw-alias-brand-primary, #4f6ef7); }
.wbm-mark[data-kind="bad"] { color: var(--dsw-alias-state-warn-primary, #c77700); }
.wbm-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

/* ── the team group view (#12): one collapsible section per team ─────────── */
.wbm-group { grid-column: 1 / -1; list-style: none; }
.wbm-group-head { display: flex; align-items: center; gap: 8px 10px; flex-wrap: wrap; width: 100%;
  box-sizing: border-box; padding: 10px 12px; font-size: 12px; line-height: 1.5; text-align: left;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.28)); border-radius: 12px; cursor: pointer;
  background: var(--dsw-alias-bg-layer-1, transparent); color: var(--dsw-alias-label-secondary, inherit); }
.wbm-group-head:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.06)); }
.wbm-group-caret { flex: none; font-size: 10px; line-height: 1; color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-group-faces { flex: none; display: inline-flex; align-items: center; }
.wbm-gavatar { width: 20px; height: 20px; border-radius: 6px; object-fit: cover; font-size: 11px;
  display: inline-flex; align-items: center; justify-content: center; line-height: 1;
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.18)); box-sizing: content-box;
  border: 2px solid var(--dsw-alias-bg-layer-1, transparent); margin-right: -6px; }
.wbm-group-name { font-family: ${MONO}; font-size: 11px; min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-group-count { font-family: ${MONO}; font-size: 11px; line-height: 1.5; font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary, inherit); white-space: nowrap; }
.wbm-group-marks { display: inline-flex; gap: 4px 10px; flex-wrap: wrap; }

/* ── the bulk-update bar (#12): entry, progress, failure + continue ───────── */
.wbm-bulk { display: flex; gap: 8px 10px; flex-wrap: wrap; align-items: center;
  padding: 8px 12px; font-size: 12px; line-height: 1.6; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.28)); }
.wbm-bulk[data-phase="running"] { color: var(--dsw-alias-brand-primary, #4f6ef7);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #4f6ef7) 40%, transparent); }
.wbm-bulk[data-phase="failed"] { color: var(--dsw-alias-state-error-primary, #d5484f);
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d5484f) 42%, transparent); }
.wbm-bulk-text { flex: 1 1 240px; min-width: 0; overflow-wrap: anywhere; }

/* ── the orphans panel: installed from another source (#9) ───────────────── */
.wbm-orphans { border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.28)); border-radius: 12px;
  padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.wbm-orphans-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.wbm-orphans-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); }
.wbm-orphans-count { font-family: ${MONO}; font-size: 11px; line-height: 1.4;
  font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-orphans-hint { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-orphan { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between;
  padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.22)); border-radius: 10px; }
.wbm-orphan[data-broken="true"] { border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c77700) 45%, transparent); }
.wbm-orphan-main { min-width: 0; flex: 1 1 260px; display: flex; flex-direction: column; gap: 2px; }
.wbm-orphan-line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }
.wbm-orphan-name { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); }
.wbm-orphan-id { font-family: ${MONO}; font-size: 11px; line-height: 1.4;
  color: var(--dsw-alias-label-tertiary, inherit); word-break: break-all; }
.wbm-orphan-broken { flex: none; font-size: 10px; line-height: 1.5; padding: 1px 7px; border-radius: 999px; white-space: nowrap;
  color: var(--dsw-alias-state-warn-primary, #c77700);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #c77700) 45%, transparent); }
.wbm-orphan-meta { font-family: ${MONO}; font-size: 11px; line-height: 1.6;
  color: var(--dsw-alias-label-tertiary, inherit); overflow-wrap: anywhere; }

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
.wbm-notice[data-kind="ok"] { color: var(--dsw-alias-state-success-primary, #2e9e5b); }
.wbm-notice[data-kind="error"] { color: var(--dsw-alias-state-error-primary, #d5484f); }
.wbm-btn { padding: 5px 12px; font-size: 12px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35)); background: transparent;
  color: var(--dsw-alias-label-primary, inherit); }
.wbm-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.1)); }
.wbm-btn:disabled { opacity: .55; cursor: default; }
.wbm-btn[data-variant="primary"] { background: var(--dsw-alias-brand-primary, #4f6ef7); border-color: transparent; color: #fff; }
.wbm-btn[data-variant="primary"]:hover:not(:disabled) { background: var(--dsw-alias-brand-primary, #4f6ef7); opacity: .9; }
.wbm-btn[data-variant="danger"] { color: var(--dsw-alias-state-error-primary, #d5484f);
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d5484f) 45%, transparent); }
.wbm-btn[data-variant="danger"]:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d5484f) 10%, transparent); }
.wbm-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* ── the summon popover (#11): the input pill's roster dropdown ──────────── */
.wbm-summon-wrap { position: relative; order: 1; }
.wbm-summon-btn { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 4px 0 8px; border: none;
  border-radius: 24px; background: transparent; color: var(--dsw-alias-label-secondary, inherit);
  font-size: 13px; line-height: 20px; font-weight: 500; cursor: pointer; }
.wbm-summon-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12)); color: var(--dsw-alias-label-primary, inherit); }
.wbm-summon-menu { position: absolute; bottom: calc(100% + 4px); left: 0; box-sizing: border-box; padding: 4px;
  display: flex; flex-direction: column; width: 320px; max-width: 360px; max-height: calc(100vh - 24px); overflow-y: auto;
  border: 1px solid var(--dsw-alias-border-inverted, rgba(127,127,127,.35)); border-radius: 12px;
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, inherit));
  box-shadow: var(--dsw-shadow-lv3, 0 8px 24px rgba(0,0,0,.18)); z-index: 10000; }
.wbm-summon-menu-title { padding: 8px 10px 6px; font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-summon-filter { box-sizing: border-box; width: 100%; margin: 0 0 4px; padding: 7px 10px; font-size: 13px;
  border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35)); outline: none;
  background: var(--dsw-alias-bg-layer-1, transparent); color: var(--dsw-alias-label-primary, inherit); }
.wbm-summon-filter:focus { border-color: var(--dsw-alias-brand-primary, currentColor); }
.wbm-summon-filter::placeholder { color: var(--dsw-alias-label-tertiary, inherit); }
.wbm-summon-item { display: flex; align-items: flex-start; gap: 8px; width: 100%; padding: 8px 10px;
  border: none; border-radius: 10px; background: transparent; cursor: pointer; text-align: left;
  color: var(--dsw-alias-label-primary, inherit); box-sizing: border-box; }
.wbm-summon-item:hover, .wbm-summon-item[data-active="true"] { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12)); }
.wbm-summon-emoji { flex: 0 0 auto; font-size: 16px; line-height: 20px; }
img.wbm-summon-emoji { width: 20px; height: 20px; border-radius: 6px; object-fit: cover; }
.wbm-summon-item-body { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.wbm-summon-item-name { font-size: 14px; line-height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbm-summon-item-desc { font-family: ${MONO}; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary, inherit);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbm-summon-empty { padding: 8px 10px; font-size: 13px; color: var(--dsw-alias-label-secondary, inherit); }
.wbm-summon-foot { margin-top: 4px; padding: 7px 10px 5px; font-size: 11px; line-height: 1.5;
  color: var(--dsw-alias-label-tertiary, inherit);
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.2)); }

/* ── quality floor: visible keyboard focus, calm motion ──────────────────── */
.wbm-btn:focus-visible, .wbm-chip:focus-visible, .wbm-search:focus-visible, .wbm-path-input:focus-visible,
.wbm-warns-toggle:focus-visible, .wbm-summon-btn:focus-visible, .wbm-summon-item:focus-visible,
.wbm-summon-filter:focus-visible, .wbm-group-head:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .wbm-skel-card { animation: none; }
  .wbm-spin { animation: none; }
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
    subtitle: '浏览本地 WorkBuddy 专家，装为用户预设；目录变了就刷新或改路径。',
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
    teamBadge: '团队 ·{n}',
    // ── #9: the mutating half ──────────────────────────────────────────────
    pathLabel: '源路径',
    apply: '应用',
    applying: '应用中…',
    refreshBtn: '刷新',
    pathApplied: '源路径已更新：{path}',
    configFailed: '路径保存失败',
    refreshFailed: '刷新失败',
    conflictTitle: '设置冲突：源路径已被其他页面修改。',
    conflictDetail: '本页基于修订 {expected}，当前已是修订 {actual}。',
    conflictRetry: '拉取新修订并重试',
    laneBusy: '另一个变更正在进行，请稍后重试',
    installBtn: '安装',
    updateBtn: '更新',
    uninstallBtn: '卸载',
    confirmInstall: '确认安装？',
    confirmUpdate: '确认更新？',
    confirmUninstall: '确认卸载？',
    cancel: '取消',
    actionBusy: '处理中…',
    installDone: '已安装「{name}」',
    updateDone: '已更新「{name}」',
    uninstallDone: '已卸载「{name}」',
    installFailed: '安装失败',
    updateFailed: '更新失败',
    uninstallFailed: '卸载失败',
    orphansTitle: '已安装但不在当前源',
    orphansHint: '这些 preset 装自别的源目录（或其专家已不在当前源中）——只呈列，不自动卸载；确认后可按 id 卸载。',
    orphanBroken: '清单异常',
    orphanImported: '安装于 {when}',
    // ── #12 (P4): team group view + bulk update ───────────────────────────
    groupExpand: '展开团队成员',
    groupCollapse: '收起团队成员',
    groupMembers: '成员 {shown}/{total}',
    installedCount: '已装 {n}',
    updatableCount: '可更新 {n}',
    brokenCount: '损坏 {n}',
    bulkUpdateBtn: '一键更新 {n} 位',
    bulkRunning: '正在更新 {done}/{total}：{name}',
    bulkFailedBody: '一键更新中断：{name}：{error}',
    bulkContinue: '继续更新剩余 {n} 位',
    bulkDismiss: '收起',
    bulkDoneNotice: '一键更新完成：成功 {done} 位',
    // ── #11: the summon entry points (button + '@' source) ────────────────
    summonButtonTitle: '召唤专家',
    summonButtonLabel: '召唤专家',
    summonMenuTitle: '已安装的 WorkBuddy 专家',
    summonMenuEmpty: '暂无可召唤的 WorkBuddy 专家',
    summonFilter: '过滤专家…',
    summonFootnote: '选中后写入指令草稿，不会自动发送',
    summonInstruction: '用 summon_workbuddy_expert 召唤专家「{name}」（{slug}）处理以下任务：',
    summonInstructionWithTask: '用 summon_workbuddy_expert 召唤专家「{name}」（{slug}）处理以下任务：\n{task}',
    triggerSection: 'WorkBuddy 专家'
  },
  en: {
    nav: 'WorkBuddy Experts',
    title: 'WorkBuddy Expert Market',
    subtitle: 'Browse local WorkBuddy experts and install them as user presets; refresh or repoint the path when the directory moves.',
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
    teamBadge: 'team ·{n}',
    // ── #9: the mutating half ──────────────────────────────────────────────
    pathLabel: 'Source path',
    apply: 'Apply',
    applying: 'Applying…',
    refreshBtn: 'Refresh',
    pathApplied: 'Source path updated: {path}',
    configFailed: 'Failed to save the path',
    refreshFailed: 'Refresh failed',
    conflictTitle: 'Settings conflict: the source path was changed on another page.',
    conflictDetail: 'This page was on revision {expected}; the current revision is {actual}.',
    conflictRetry: 'Pull the new revision and retry',
    laneBusy: 'Another change is in progress — try again shortly',
    installBtn: 'Install',
    updateBtn: 'Update',
    uninstallBtn: 'Uninstall',
    confirmInstall: 'Install now?',
    confirmUpdate: 'Update now?',
    confirmUninstall: 'Uninstall now?',
    cancel: 'Cancel',
    actionBusy: 'Working…',
    installDone: 'Installed "{name}"',
    updateDone: 'Updated "{name}"',
    uninstallDone: 'Uninstalled "{name}"',
    installFailed: 'Install failed',
    updateFailed: 'Update failed',
    uninstallFailed: 'Uninstall failed',
    orphansTitle: 'Installed from another source',
    orphansHint: 'These presets came from another source directory (or their expert left this one) — listed, never auto-uninstalled; confirm to uninstall by id.',
    orphanBroken: 'manifest broken',
    orphanImported: 'installed {when}',
    // ── #12 (P4): team group view + bulk update ───────────────────────────
    groupExpand: 'Expand team members',
    groupCollapse: 'Collapse team members',
    groupMembers: '{shown}/{total} members',
    installedCount: '{n} installed',
    updatableCount: '{n} updatable',
    brokenCount: '{n} broken',
    bulkUpdateBtn: 'Update all ({n})',
    bulkRunning: 'Updating {done}/{total}: {name}',
    bulkFailedBody: 'Bulk update stopped at {name}: {error}',
    bulkContinue: 'Continue with {n} remaining',
    bulkDismiss: 'Dismiss',
    bulkDoneNotice: 'Bulk update finished: {done} updated',
    // ── #11: the summon entry points (button + '@' source) ────────────────
    summonButtonTitle: 'Summon expert',
    summonButtonLabel: 'Summon expert',
    summonMenuTitle: 'Installed WorkBuddy experts',
    summonMenuEmpty: 'No WorkBuddy experts summonable yet',
    summonFilter: 'Filter experts…',
    summonFootnote: 'Picking writes an instruction draft — it never auto-sends',
    summonInstruction: 'Summon expert "{name}" ({slug}) with summon_workbuddy_expert to handle the following task:',
    summonInstructionWithTask: 'Summon expert "{name}" ({slug}) with summon_workbuddy_expert to handle the following task:\n{task}',
    triggerSection: 'WorkBuddy Experts'
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

/**
 * Same-origin JSON fetch; throws host-sent error messages when present.
 * Thrown errors carry the HTTP status and, when the host sent them, the
 * structured fields the #9 flows key off: `code` (SETTINGS_CONFLICT) and
 * the two revisions of a config conflict.
 */
function api (path, options) {
  var init = Object.assign({ credentials: 'same-origin' }, options || {})
  return fetch(path, init).then(function (response) {
    return response.json().catch(function () { return {} }).then(function (body) {
      if (!response.ok) {
        var error = new Error(body && body.error ? body.error : 'HTTP ' + response.status)
        error.status = response.status
        if (body !== null && typeof body === 'object') {
          if (typeof body.code === 'string') error.code = body.code
          if (body.expectedRevision !== undefined) error.expectedRevision = body.expectedRevision
          if (body.revision !== undefined) error.revision = body.revision
        }
        throw error
      }
      return body
    })
  })
}

/** Same-origin JSON POST (the only shape the mutating routes accept). */
function postJson (path, body) {
  return api(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
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

// ── the team group view (#12, P4): cards grouped by source plugin ────────────

/**
 * Group ALREADY-FILTERED cards by their source plugin directory, in
 * first-card order (the scan's deterministic order — id-sorted within the
 * table, so groups appear in a stable arrangement). A group whose plugin is
 * a team (`teamSize > 1` on any member, or several members surviving the
 * filter) renders as a collapsible group; a lone solo card renders exactly
 * as the un-grouped grid always did. The grouping is PRESENTATION ONLY:
 * chips, match counts, and the census keep counting EXPERT CARDS, so the
 * aggregation never changes what a filter claims to match.
 */
function groupCardsByPlugin (experts) {
  var groups = []
  var byDir = {}
  for (var i = 0; i < experts.length; i++) {
    var expert = experts[i]
    var dir = strOf(expert.pluginDir)
    var key = dir !== '' ? dir : '·no-plugin·'
    var group = byDir[key]
    if (group === undefined) {
      group = { pluginDir: key, members: [], team: false }
      byDir[key] = group
      groups.push(group)
    }
    group.members.push(expert)
  }
  for (var g = 0; g < groups.length; g++) {
    // teamSize is per-plugin-directory, so every member agrees; several
    // members alone (a filtered team) still group even when one survives.
    groups[g].team = groups[g].members.length > 1 || isTeam(groups[g].members[0])
  }
  return groups
}

/**
 * Whether one team group stands expanded. `openMap` holds the user's
 * EXPLICIT choice per pluginDir: true forces open, false forces closed,
 * undefined follows the default — collapsed on the plain browse, expanded
 * whenever a query or filter chip is active (matched members must be
 * visible without a second click). The explicit choice wins either way, so
 * collapsing a noisy group under an active filter STAYS collapsed.
 */
function groupExpanded (openMap, pluginDir, filteredActive) {
  var choice = openMap === null || openMap === undefined ? undefined : openMap[pluginDir]
  if (choice === true) return true
  if (choice === false) return false
  return filteredActive === true
}

/** Aggregate status counts over a group's (filtered) members. */
function groupStatsOf (members) {
  var out = { installed: 0, updatable: 0, broken: 0 }
  for (var i = 0; i < members.length; i++) {
    var expert = members[i]
    if (expert.installed === true) out.installed++
    if (expert.updatable === true) out.updatable++
    if (expert.broken === true) out.broken++
  }
  return out
}

/**
 * The bulk-update queue (#12): every card the host flags updatable, in
 * table order. Broken cards never join — the host never marks a broken
 * preset updatable (its fix is 卸载重装), and cardActionsOf already offers
 * such cards uninstall only.
 */
function updatableQueueOf (experts) {
  if (!Array.isArray(experts)) return []
  return experts.filter(function (expert) {
    return expert !== null && typeof expert === 'object' &&
      expert.updatable === true && expert.broken !== true
  })
}

/**
 * The inline actions one card offers (#9): uninstalled → install;
 * installed + updatable → update THEN uninstall; broken → uninstall only
 * (its fix is 卸载重装 — the host never marks a broken card updatable, and
 * an update through a broken manifest is refused anyway).
 */
function cardActionsOf (expert) {
  if (expert.installed === true) {
    return expert.updatable === true && expert.broken !== true ? ['update', 'uninstall'] : ['uninstall']
  }
  return ['install']
}

/**
 * Dictionary keys per action — one table drives the buttons, the confirm
 * labels, and the done/failed notices of the inline row actions.
 */
var ACTION_TEXT = {
  install: { button: 'installBtn', confirm: 'confirmInstall', done: 'installDone', failed: 'installFailed' },
  update: { button: 'updateBtn', confirm: 'confirmUpdate', done: 'updateDone', failed: 'updateFailed' },
  uninstall: { button: 'uninstallBtn', confirm: 'confirmUninstall', done: 'uninstallDone', failed: 'uninstallFailed' }
}

/**
 * The confirm-button variant per action: destructive actions get the danger
 * tone, constructive ones the primary — the sister's confirm-remove pairing
 * generalized to all three confirmed actions.
 */
function confirmVariantOf (action) {
  return action === 'uninstall' ? 'danger' : 'primary'
}

/** Locale-aware import timestamp; any unusable value falls back to raw. */
function formatWhen (value, localeId) {
  var raw = strOf(value)
  if (raw === '') return ''
  var date = new Date(raw)
  if (isNaN(date.getTime())) return raw
  try {
    return date.toLocaleString(localeId === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  } catch (error) {
    return raw
  }
}

/**
 * One default action button. A factory (not an inline loop closure) so each
 * button captures ITS action — a `var` loop closure would fire the last
 * iteration's action for every button.
 */
function actionButton (t, action, laneBusy, onConfirm) {
  return el('button', {
    key: action, className: 'wbm-btn', type: 'button',
    'data-variant': action === 'install' ? 'primary' : undefined,
    disabled: laneBusy,
    onClick: function () { onConfirm(action) }
  }, t(ACTION_TEXT[action].button))
}

/** The confirm/cancel pair one action swaps in (sister's inline confirm). The
 * confirm leg joins the lane discipline; cancel stays live (it is local). */
function confirmPair (t, action, laneBusy, onAction, onCancelConfirm) {
  return [
    el('button', {
      key: action, className: 'wbm-btn', type: 'button',
      'data-variant': confirmVariantOf(action),
      disabled: laneBusy,
      onClick: function () { onAction(action) }
    }, t(ACTION_TEXT[action].confirm)),
    el('button', {
      key: 'cancel', className: 'wbm-btn', type: 'button',
      onClick: function () { onCancelConfirm() }
    }, t('cancel'))
  ]
}

/**
 * The single inline action-row renderer shared by expert cards and orphan
 * rows (#9). States, in priority order — exactly the sister's row machine:
 *
 *   busy (this row)      → one disabled 处理中… button;
 *   confirming (action)  → [确认…？(variant)] [取消];
 *   default              → one button per action.
 *
 * Every mutation-bound leg disables while ANY lane flight of this page is in
 * progress (`laneBusy`: a row action, the refresh, or the path apply — the
 * host's single flight is shared, so a click through it could only ever
 * earn a 409).
 */
function ActionRow (props) {
  var t = props.t
  var laneBusy = props.laneBusy === true
  var rowBusy = props.busyKey === props.rowKey
  var buttons = null

  if (rowBusy) {
    buttons = el('button', { className: 'wbm-btn', type: 'button', disabled: true }, t('actionBusy'))
  } else {
    buttons = []
    for (var i = 0; i < props.actions.length; i++) {
      var action = props.actions[i]
      if (props.confirmKey === props.rowKey + ':' + action) {
        // The inline confirmation replaces the rest of the row.
        buttons = confirmPair(t, action, laneBusy, props.onAction, props.onCancelConfirm)
        break
      }
      buttons.push(actionButton(t, action, laneBusy, props.onConfirm))
    }
  }
  return el('div', { className: 'wbm-actions' }, buttons)
}

// ── the card ────────────────────────────────────────────────────────────────

/**
 * The shared avatar face: the card's PNG through avatarUrl when the payload
 * carries one AND it loads (onError flips to the glyph), the static 🧑‍💻
 * emoji otherwise — a PNG-less card or a failed load makes no placeholder
 * request. The market card and the summon popover (#11) render the same
 * face at different sizes (imgClass/glyphClass pick the seat's classes).
 */
function AvatarFace (props) {
  var expert = props.expert
  var avatarState = React.useState(false)
  var avatarFailed = avatarState[0]
  var setAvatarFailed = avatarState[1]
  if (!avatarFailed && strOf(expert.avatarUrl) !== '') {
    return el('img', {
      className: props.imgClass,
      src: expert.avatarUrl,
      alt: '',
      loading: 'lazy',
      decoding: 'async',
      onError: function () { setAvatarFailed(true) }
    })
  }
  return el('span', { className: props.glyphClass, 'aria-hidden': 'true' }, AVATAR_EMOJI)
}

/**
 * One expert card: avatar (PNG via avatarUrl; onError OR a PNG-less card
 * falls back to the static 🧑‍💻 emoji — no placeholder request), a
 * locale-following name over the mono id, a locale-following two-line
 * description, provenance badges (source plugin / skills count / team),
 * TOLERANT status marks — ✓ installed / ↑ updatable / ⚠ broken render only
 * when the state payload carries the field — and the inline action row
 * (#9): install / update / uninstall, each behind the sister's inline
 * confirm. Handler props are optional so read-only renders (the smoke's
 * card-only checks) keep working.
 */
function ExpertCard (props) {
  var t = props.t
  var expert = props.expert
  var localeId = props.localeId

  var avatar = el(AvatarFace, { expert: expert, imgClass: 'wbm-avatar', glyphClass: 'wbm-emoji' })

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

  // Status marks, tolerant to absent fields (missing means "not marked",
  // never "no").
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

  var actions = cardActionsOf(expert)
  var rowKey = 'expert:' + strOf(expert.id)

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
    el('div', { className: 'wbm-foot' },
      marks.length > 0 ? el('div', { className: 'wbm-status' }, marks) : null,
      el(ActionRow, {
        t: t,
        rowKey: rowKey,
        actions: actions,
        laneBusy: props.laneBusy === true,
        busyKey: props.busyKey || '',
        confirmKey: props.confirmKey || '',
        onConfirm: function (action) {
          if (typeof props.onActionConfirm === 'function') props.onActionConfirm(rowKey + ':' + action)
        },
        onCancelConfirm: function () {
          if (typeof props.onCancelConfirm === 'function') props.onCancelConfirm()
        },
        onAction: function (action) {
          if (typeof props.onAction === 'function') props.onAction(expert, action)
        }
      })))
}

// ── the team group header (#12): one collapsible source-plugin section ─────

/**
 * The full-width header of one team group: a caret, a stacked row of member
 * faces (the first four members' PNG avatars, emoji fallback each), the mono
 * plugin directory, the team badge with the plugin's full size, the
 * shown/total member count (the shown side follows whatever filter is
 * active), and aggregated status counts over the SHOWN members. The member
 * cards themselves are appended by the page as ordinary ExpertCards right
 * after this header — grouping changes arrangement, never card capability.
 */
function TeamGroup (props) {
  var t = props.t
  var group = props.group
  var expanded = props.expanded === true
  var members = group.members
  var stats = groupStatsOf(members)
  var teamSize = typeof members[0].teamSize === 'number' && members[0].teamSize > members.length
    ? members[0].teamSize : members.length

  var faces = []
  var faceCount = Math.min(members.length, 4)
  for (var i = 0; i < faceCount; i++) {
    faces.push(el(AvatarFace, {
      key: strOf(members[i].id), expert: members[i],
      imgClass: 'wbm-gavatar', glyphClass: 'wbm-gavatar'
    }))
  }

  var marks = []
  if (stats.broken > 0) {
    marks.push(el('span', { key: 'broken', className: 'wbm-mark', 'data-kind': 'bad' }, '⚠ ', t('brokenCount', { n: stats.broken })))
  }
  if (stats.installed > 0) {
    marks.push(el('span', { key: 'installed', className: 'wbm-mark', 'data-kind': 'ok' }, '✓ ', t('installedCount', { n: stats.installed })))
  }
  if (stats.updatable > 0) {
    marks.push(el('span', { key: 'updatable', className: 'wbm-mark', 'data-kind': 'upd' }, '↑ ', t('updatableCount', { n: stats.updatable })))
  }

  return el('li', { className: 'wbm-group' },
    el('button', {
      className: 'wbm-group-head', type: 'button',
      'aria-expanded': expanded ? 'true' : 'false',
      title: t(expanded ? 'groupCollapse' : 'groupExpand'),
      onClick: function () {
        if (typeof props.onToggle === 'function') props.onToggle(group.pluginDir)
      }
    },
      el('span', { className: 'wbm-group-caret', 'aria-hidden': 'true' }, expanded ? '▾' : '▸'),
      faces.length > 0 ? el('span', { className: 'wbm-group-faces', 'aria-hidden': 'true' }, faces) : null,
      el('span', { className: 'wbm-group-name', title: group.pluginDir }, group.pluginDir),
      el('span', { className: 'wbm-badge', 'data-kind': 'team' }, t('teamBadge', { n: teamSize })),
      el('span', { className: 'wbm-group-count' }, t('groupMembers', { shown: members.length, total: teamSize })),
      marks.length > 0 ? el('span', { className: 'wbm-group-marks' }, marks) : null))
}

// ── the orphan rows (#9) ─────────────────────────────────────────────────────

/**
 * One orphan preset: name + mono presetId + ⚠ when broken, a provenance
 * meta line (source path · plugin dir/agent file · import date), and the
 * same confirmed uninstall as the cards — the host uninstalls by expert id
 * and the roster, not the scan table, is its authority (#9).
 */
function OrphanRow (props) {
  var t = props.t
  var orphan = props.orphan
  var localeId = props.localeId
  var broken = orphan.broken === true

  var meta = []
  if (strOf(orphan.sourcePath) !== '') meta.push(strOf(orphan.sourcePath))
  var pluginDir = strOf(orphan.pluginDir)
  var agentFile = strOf(orphan.agentFile)
  if (pluginDir !== '' || agentFile !== '') {
    meta.push(pluginDir + (agentFile !== '' ? '/' + agentFile : ''))
  }
  var when = formatWhen(orphan.importedAt, localeId)
  if (when !== '') meta.push(t('orphanImported', { when: when }))
  // A broken orphan carries no provenance — the host's `warning` IS its
  // provenance (清单缺失 reason / roster reason); surface it in the row
  // instead of leaving the ⚠ badge explaining nothing.
  if (strOf(orphan.warning) !== '') meta.push(strOf(orphan.warning))

  var rowKey = 'orphan:' + strOf(orphan.id)
  var name = strOf(orphan.name) !== '' ? strOf(orphan.name) : strOf(orphan.id)

  return el('li', { className: 'wbm-orphan', 'data-broken': broken ? 'true' : undefined },
    el('div', { className: 'wbm-orphan-main' },
      el('div', { className: 'wbm-orphan-line' },
        el('span', { className: 'wbm-orphan-name', title: name }, name),
        el('span', { className: 'wbm-orphan-id' }, strOf(orphan.presetId) !== '' ? strOf(orphan.presetId) : strOf(orphan.id)),
        broken ? el('span', { className: 'wbm-orphan-broken' }, '⚠ ', t('orphanBroken')) : null),
      meta.length > 0 ? el('span', { className: 'wbm-orphan-meta' }, meta.join(' · ')) : null),
    el(ActionRow, {
      t: t,
      rowKey: rowKey,
      actions: ['uninstall'],
      laneBusy: props.laneBusy === true,
      busyKey: props.busyKey || '',
      confirmKey: props.confirmKey || '',
      onConfirm: function (action) {
        if (typeof props.onActionConfirm === 'function') props.onActionConfirm(rowKey + ':' + action)
      },
      onCancelConfirm: function () {
        if (typeof props.onCancelConfirm === 'function') props.onCancelConfirm()
      },
      onAction: function (action) {
        if (typeof props.onAction === 'function') props.onAction(orphan, action)
      }
    }))
}

// ── the bulk-update bar (#12): entry / progress / failure + continue ────────

/**
 * The one-line bulk-update strip above the grid (#12). Idle with updatable
 * cards → the primary entry (disabled while any other lane flight holds the
 * shared lane); running → live progress (done+1 of total, the current
 * expert) with aria-busy; failed → the failed entry with the host error and
 * the two ways out: 继续更新剩余 (re-enters the walk with the remaining
 * queue) or 收起 (drop the run — every card keeps its own row buttons).
 */
function BulkBar (props) {
  var t = props.t
  var bulk = props.bulk
  var laneBusy = props.laneBusy === true

  if (bulk !== null && bulk !== undefined && bulk.phase === 'running') {
    return el('div', { className: 'wbm-bulk', 'data-phase': 'running', role: 'status', 'aria-busy': 'true' },
      el('span', { className: 'wbm-bulk-text' },
        t('bulkRunning', { done: bulk.done + 1, total: bulk.total, name: bulk.current.name })))
  }
  if (bulk !== null && bulk !== undefined && bulk.phase === 'failed') {
    return el('div', { className: 'wbm-bulk', 'data-phase': 'failed', role: 'alert' },
      el('span', { className: 'wbm-bulk-text' },
        t('bulkFailedBody', { name: bulk.failed.name, error: bulk.error })),
      el('button', {
        className: 'wbm-btn', type: 'button', 'data-variant': 'primary',
        disabled: laneBusy || bulk.queue.length === 0,
        onClick: props.onContinue
      }, t('bulkContinue', { n: bulk.queue.length })),
      el('button', { className: 'wbm-btn', type: 'button', onClick: props.onDismiss }, t('bulkDismiss')))
  }
  if (props.count > 0) {
    return el('div', { className: 'wbm-bulk', 'data-phase': 'idle' },
      el('button', {
        className: 'wbm-btn', type: 'button', 'data-variant': 'primary',
        disabled: laneBusy,
        onClick: props.onStart
      }, t('bulkUpdateBtn', { n: props.count })))
  }
  return null
}

// ── the refresh icon (#9) ────────────────────────────────────────────────────

/** The circular-arrow glyph; it spins while `spinning` (CSS class). */
function refreshIcon (spinning) {
  return el('svg', {
    viewBox: '0 0 16 16', width: 13, height: 13,
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
    'aria-hidden': 'true',
    className: spinning ? 'wbm-spin' : undefined
  },
    el('path', { d: 'M13.5 8a5.5 5.5 0 1 1-1.62-3.88' }),
    el('path', { d: 'M13.7 1.6v2.8h-2.8' }))
}

// ── the market page ──────────────────────────────────────────────────────────

/**
 * The settings-section page: the read-only half of #8 (one /api/state pull
 * per mount; bilingual payload; client-side search/filter) plus the #9
 * mutating half — the path topbar (apply with optimistic-lock revision,
 * conflict box + retry), the spinning refresh button, inline confirmed
 * install/update/uninstall on cards and orphans, and an action notice.
 *
 * Lane discipline mirrors the host's single flight: at most ONE of {row
 * action, refresh, apply} is ever in flight from this page (their guards
 * plus each other's disabled buttons), so a 409 can only arrive from a
 * RACING tab — and when it does, the handler path is the ordinary error
 * path: notice + busy state released, buttons back.
 */
function MarketPage (props) {
  var t = props.t

  // Optional initial snapshot seam: undefined in production (the page fetches
  // on mount); the offline smoke renders real states through it.
  var initialPath = props.initialState !== undefined && props.initialState !== null &&
    typeof props.initialState.sourcePath === 'string' ? props.initialState.sourcePath : ''
  var stateState = React.useState(props.initialState === undefined ? null : props.initialState)
  var setState = stateState[1]
  var body = stateState[0]
  var experts = body !== null && body !== undefined && Array.isArray(body.experts) ? body.experts : null
  var orphans = body !== null && body !== undefined && Array.isArray(body.orphans) ? body.orphans : []

  var errorState = React.useState('')
  var setError = errorState[1]
  var error = errorState[0]

  // ── #9: the mutating state machine ────────────────────────────────────────
  // busyKey: '' | 'expert:<id>' | 'orphan:<id>' — the row whose lane action
  // is in flight (one at a time, like the sister's busyId).
  var busyState = React.useState('')
  var setBusyKey = busyState[1]
  var busyKey = busyState[0]

  // confirmKey: '' | '<rowKey>:<action>' — the row+action awaiting its
  // inline confirmation; auto-reverts after 4 seconds (sister pattern).
  var confirmState = React.useState('')
  var setConfirmKey = confirmState[1]
  var confirmKey = confirmState[0]

  // The refresh flight: the icon spins and the button disables for its
  // whole duration — no double submits.
  var refreshingState = React.useState(false)
  var setRefreshing = refreshingState[1]
  var refreshing = refreshingState[0]

  // The path-apply flight.
  var savingState = React.useState(false)
  var setSaving = savingState[1]
  var saving = savingState[0]

  // ── #12 (P4): the bulk-update run and the team-group fold ────────────────
  // bulk: null when idle; otherwise
  //   { phase: 'running', current: {id,name}, queue: [entry…], done, total }
  //   { phase: 'failed', failed: {id,name}, error, queue: [entry…], done, total }
  // Only 'running' holds the mutation lane (a failed run releases it — the
  // continue button re-takes it); the queue holds the entries AFTER the
  // current/failed one, so 中途失败 → 继续更新剩余 skips the failed card
  // (it stays updatable with its own row button).
  var bulkState = React.useState(null)
  var setBulk = bulkState[1]
  var bulk = bulkState[0]
  var bulkRunning = bulk !== null && bulk !== undefined && bulk.phase === 'running'

  // openGroups: the user's EXPLICIT per-pluginDir choice for team groups —
  // true forces open, false forces closed, undefined follows the default
  // (collapsed on the plain browse, expanded under an active query/filter so
  // matched members are visible without a second click).
  var openGroupsState = React.useState({})
  var setOpenGroups = openGroupsState[1]
  var openGroups = openGroupsState[0]

  // A config 409 SETTINGS_CONFLICT: { expected, actual } — both revisions
  // shown, retry re-pulls and replays.
  var conflictState = React.useState(null)
  var setConflict = conflictState[1]
  var conflict = conflictState[0]

  // Action feedback: ok fades after 6 seconds, errors stay until the next
  // action (sister pattern).
  var noticeState = React.useState(null)
  var setNotice = noticeState[1]
  var notice = noticeState[0]

  // The path draft. syncedRef holds the sourcePath the CURRENT draft was
  // synced from: while the user has not diverged from it, every fresh
  // payload re-syncs the draft (another tab's apply lands here too); once
  // the user typed, the draft is theirs and only a successful apply of it
  // re-syncs. draftRef is the async-safe read the retry flow uses.
  var draftState = React.useState(initialPath)
  var setDraftPath = draftState[1]
  var draftPath = draftState[0]
  var syncedRef = React.useRef(initialPath)
  var draftRef = React.useRef(initialPath)

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

  // The inline confirm auto-reverts after 4 seconds (sister pattern).
  React.useEffect(function () {
    if (confirmKey === '') return undefined
    var timer = setTimeout(function () { setConfirmKey('') }, 4000)
    return function () { clearTimeout(timer) }
  }, [confirmKey])

  // Success notices fade themselves out; errors stay until the next action.
  React.useEffect(function () {
    if (notice === null || notice.kind !== 'ok') return undefined
    var timer = setTimeout(function () { setNotice(null) }, 6000)
    return function () { clearTimeout(timer) }
  }, [notice])

  /** Adopt a fresh /api/state payload (and keep the draft in step). */
  function adoptState (payload) {
    var nextPath = strOf(payload !== null && payload !== undefined ? payload.sourcePath : '')
    // Capture the pre-adopt synced value: the functional updater may run
    // LATER than everything below it (React defers it to the render), so it
    // must close over the value at QUEUE time — reading the ref inside the
    // updater would compare against the already-mutated next value and
    // never adopt.
    var prevSynced = syncedRef.current
    setState(payload)
    setDraftPath(function (prev) { return prev === prevSynced ? nextPath : prev })
    if (draftRef.current === prevSynced) draftRef.current = nextPath
    syncedRef.current = nextPath
  }

  /**
   * The one state pull (+ the retry affordance on failure). Returns the
   * payload on success, undefined on failure — the conflict-retry chain
   * stops when the pull itself fails.
   */
  var pullState = React.useCallback(function () {
    return api(API_BASE + '/state').then(function (payload) {
      adoptState(payload)
      setError('')
      return payload
    }, function (err) {
      setError(err && err.message ? err.message : String(err))
      return undefined
    })
  }, [])

  React.useEffect(function () { pullState() }, [pullState])

  /**
   * An error message for a failed mutating call: the single-flight 409 gets
   * its localized hint wrapped around the host's raw message; a config
   * conflict is NOT handled here (it gets its own box).
   */
  function failText (key, err) {
    var raw = err !== null && err !== undefined && err.message ? err.message : String(err)
    var lane = err !== null && typeof err === 'object' && err.status === 409 && err.code !== 'SETTINGS_CONFLICT'
    return t(key) + '：' + (lane ? t('laneBusy') + '（' + raw + '）' : raw)
  }

  /**
   * POST /api/config with one revision of the optimistic lock. Success
   * adopts the new state (banner flips to match the path's existence);
   * a SETTINGS_CONFLICT 409 renders both revisions; anything else is an
   * ordinary error notice. Resolves true/false — the caller releases the
   * saving state either way.
   */
  function applyRequest (sourcePath, expectedRevision) {
    return postJson(API_BASE + '/config', { sourcePath: sourcePath, expectedRevision: expectedRevision })
      .then(function (payload) {
        adoptState(payload)
        setError('')
        setConflict(null)
        setNotice({ kind: 'ok', text: t('pathApplied', { path: sourcePath }) })
        return true
      }, function (err) {
        if (err !== null && typeof err === 'object' && err.code === 'SETTINGS_CONFLICT') {
          setConflict({
            expected: err.expectedRevision !== undefined ? err.expectedRevision : expectedRevision,
            actual: err.revision
          })
        } else {
          setNotice({ kind: 'error', text: failText('configFailed', err) })
        }
        return false
      })
  }

  var draftTrimmed = draftPath.trim()
  var applyDisabled = saving || refreshing || busyKey !== '' || bulkRunning ||
    draftTrimmed === '' || draftTrimmed === syncedRef.current

  var onApply = function () {
    if (applyDisabled) return
    setConflict(null)
    setNotice(null)
    setSaving(true)
    applyRequest(draftRef.current.trim(), body !== null && body !== undefined ? body.revision : undefined)
      .then(function () { setSaving(false) })
  }

  /**
   * Conflict retry: re-pull the state (its payload carries the CURRENT
   * revision), then replay the SAME draft against that revision — the
   * acceptance's 可重试成功. A failed pull leaves the conflict box up.
   */
  var onConflictRetry = function () {
    if (saving || refreshing || busyKey !== '' || bulkRunning) return
    setNotice(null)
    setSaving(true)
    pullState().then(function (payload) {
      if (payload === undefined) return undefined
      return applyRequest(draftRef.current.trim(), payload.revision)
    }).then(function () { setSaving(false) })
  }

  /** POST /api/refresh — forced rescan; spinner + disabled for the flight. */
  var onRefresh = function () {
    if (refreshing || saving || busyKey !== '' || bulkRunning) return
    setNotice(null)
    setRefreshing(true)
    postJson(API_BASE + '/refresh', {}).then(function (payload) {
      adoptState(payload)
      setError('')
    }, function (err) {
      setNotice({ kind: 'error', text: failText('refreshFailed', err) })
    }).then(function () { setRefreshing(false) })
  }

  /**
   * One lane action (install/update/uninstall): confirm cleared, busy key
   * on, POST, ok-notice (with any warnings the host attached) + state
   * refetch on success, error notice on failure — and the busy key ALWAYS
   * released, so a 409 from a racing tab leaves every button usable.
   */
  var runAction = function (entry) {
    setConfirmKey('')
    setNotice(null)
    setBusyKey(entry.key)
    return postJson(API_BASE + '/' + entry.action, { id: entry.id }).then(function (result) {
      var text = t(ACTION_TEXT[entry.action].done, { name: entry.name })
      if (result !== null && typeof result === 'object' && Array.isArray(result.warnings) && result.warnings.length > 0) {
        text = text + '（' + result.warnings.join('；') + '）'
      }
      setNotice({ kind: 'ok', text: text })
      return pullState()
    }, function (err) {
      setNotice({ kind: 'error', text: failText(ACTION_TEXT[entry.action].failed, err) })
    }).then(function () { setBusyKey('') })
  }

  // Any lane flight of this page: a row action, the refresh, the apply, or a
  // bulk-update run (#12). Row actions guard on it AND their buttons disable
  // under it — the host's lane is shared, so a click through another flight
  // could only 409.
  var laneBusy = busyKey !== '' || refreshing || saving || bulkRunning

  var onCardAction = function (expert, action) {
    if (laneBusy) return
    runAction({
      key: 'expert:' + strOf(expert.id),
      action: action,
      id: strOf(expert.id),
      name: localeNameOf(expert, localeId)
    })
  }

  var onOrphanAction = function (orphan, action) {
    if (laneBusy) return
    var id = strOf(orphan.id)
    runAction({
      key: 'orphan:' + id,
      action: action,
      id: id,
      name: strOf(orphan.name) !== '' ? strOf(orphan.name) : strOf(orphan.presetId)
    })
  }

  var onActionConfirm = function (key) { setConfirmKey(key) }
  var onCancelConfirm = function () { setConfirmKey('') }

  /**
   * Toggle one team group's fold: the user's choice flips from the group's
   * CURRENT EFFECTIVE state (explicit choice, or the default under the
   * active-filter mode) and is then stored explicitly — it wins over the
   * default from then on, in either direction (#12).
   */
  var onToggleGroup = function (pluginDir) {
    setOpenGroups(function (prev) {
      var next = {}
      for (var key in prev) {
        if (Object.prototype.hasOwnProperty.call(prev, key)) next[key] = prev[key]
      }
      next[pluginDir] = !groupExpanded(prev, pluginDir, filteredActive)
      return next
    })
  }

  /**
   * The serial bulk-update walk (#12): one /api/update at a time, a fresh
   * /api/state after EVERY completion (the finished card flips ✓ within a
   * second — 逐个翻新), then the next entry. A failure stops the walk and
   * parks phase:'failed' with the REMAINING queue (the failed entry itself
   * is skipped — it keeps its ↑ and its own row button); 继续更新剩余
   * re-enters here with that queue and the progress earned so far.
   */
  var startBulkRun = function (queue, doneBase) {
    var total = doneBase + queue.length
    var runQueue = queue.slice()
    var done = doneBase
    setConfirmKey('')
    setNotice(null)
    var step = function () {
      var entry = runQueue[0]
      setBulk({ phase: 'running', current: entry, queue: runQueue.slice(1), done: done, total: total })
      postJson(API_BASE + '/update', { id: entry.id }).then(function () {
        return pullState()
      }).then(function () {
        done += 1
        runQueue = runQueue.slice(1)
        if (runQueue.length === 0) {
          setBulk(null)
          setNotice({ kind: 'ok', text: t('bulkDoneNotice', { done: done }) })
        } else {
          step()
        }
      }, function (err) {
        setBulk({
          phase: 'failed', failed: entry, error: failText('updateFailed', err),
          queue: runQueue.slice(1), done: done, total: total,
        })
      })
    }
    step()
  }

  /** 一键更新 entry: every updatable card (broken ones never join), in table order. */
  var onBulkUpdate = function () {
    if (laneBusy) return
    startBulkRun(updatableQueue, 0)
  }

  /** Continue a failed run with the remaining queue; the lane is free again. */
  var onBulkContinue = function () {
    if (laneBusy || bulk === null || bulk.phase !== 'failed') return
    startBulkRun(bulk.queue, bulk.done)
  }

  var onDraftChange = function (event) {
    var value = event !== null && event !== undefined && event.target !== null && event.target !== undefined
      ? event.target.value : ''
    draftRef.current = value
    setDraftPath(value)
  }

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

  // The bulk-update queue over the FULL table (#12): filtering rearranges
  // the grid but never changes what 一键更新 covers; broken cards never
  // join (their fix is 卸载重装, and the host never flags them updatable).
  var updatableQueue = React.useMemo(function () {
    if (experts === null) return []
    return updatableQueueOf(experts).map(function (expert) {
      return { id: strOf(expert.id), name: localeNameOf(expert, localeId) }
    })
  }, [experts, localeId])

  // Whether a query or filter chip is active — the team groups' DEFAULT fold
  // follows it (expanded under filtering so matched members are visible
  // without a second click; collapsed on the plain browse).
  var filteredActive = !loading && (query.trim() !== '' || filter !== 'all')

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
    // The grouped grid (#12): solo cards render exactly as they always did;
    // a team's members sit behind one collapsible group header. Grouping is
    // presentation only — the chips, the matchline, and the census above
    // kept counting EXPERT CARDS.
    var cardOf = function (expert) {
      return el(ExpertCard, {
        key: strOf(expert.id), t: t, expert: expert, localeId: localeId,
        laneBusy: laneBusy, busyKey: busyKey, confirmKey: confirmKey,
        onActionConfirm: onActionConfirm, onCancelConfirm: onCancelConfirm,
        onAction: onCardAction
      })
    }
    var items = []
    var groups = groupCardsByPlugin(filtered)
    for (var gi = 0; gi < groups.length; gi++) {
      var group = groups[gi]
      if (!group.team) {
        items.push(cardOf(group.members[0]))
        continue
      }
      var expanded = groupExpanded(openGroups, group.pluginDir, filteredActive)
      items.push(el(TeamGroup, {
        key: 'group:' + group.pluginDir, t: t, group: group, expanded: expanded,
        onToggle: onToggleGroup
      }))
      if (expanded) {
        for (var mi = 0; mi < group.members.length; mi++) items.push(cardOf(group.members[mi]))
      }
    }
    cards = el('ul', { className: 'wbm-grid' }, items)
  }

  // The bulk-update strip (#12) — the phase picks the shape inside BulkBar;
  // no updatable cards and no run → it renders nothing at all.
  var bulkBar = el(BulkBar, {
    t: t, bulk: bulk, laneBusy: laneBusy, count: loading ? 0 : updatableQueue.length,
    onStart: onBulkUpdate, onContinue: onBulkContinue,
    onDismiss: function () { setBulk(null) },
  })

  return el('div', { className: 'wbm-page' },
    el('header', { className: 'wbm-head' },
      el('div', { className: 'wbm-head-main' },
        el('h2', null, t('title')),
        el('p', { className: 'wbm-subtitle' }, t('subtitle'))),
      stats !== null
        ? el('span', { className: 'wbm-census' },
            el('span', { className: 'wbm-census-item' }, t('censusExperts', { n: stats.total })),
            el('span', { className: 'wbm-census-item' }, t('censusPlugins', { n: stats.plugins })))
        : null),
    // The mutating topbar (#9): path draft + apply + spinning refresh.
    el('div', { className: 'wbm-pathbar' },
      el('div', { className: 'wbm-path-field' },
        el('input', {
          className: 'wbm-path-input',
          type: 'text',
          value: draftPath,
          placeholder: t('pathLabel'),
          'aria-label': t('pathLabel'),
          disabled: saving,
          onChange: onDraftChange
        })),
      el('button', {
        className: 'wbm-btn', type: 'button',
        disabled: applyDisabled,
        onClick: onApply
      }, saving ? t('applying') : t('apply')),
      el('button', {
        className: 'wbm-btn wbm-refresh', type: 'button',
        title: t('refreshBtn'),
        'aria-label': t('refreshBtn'),
        'aria-busy': refreshing ? 'true' : undefined,
        disabled: refreshing || saving || busyKey !== '' || bulkRunning,
        onClick: onRefresh
      },
        refreshIcon(refreshing),
        t('refreshBtn'))),
    conflict !== null
      ? el('div', { className: 'wbm-conflict', role: 'alert' },
          el('span', { className: 'wbm-conflict-body' },
            el('span', { className: 'wbm-conflict-title' }, t('conflictTitle')),
            el('span', { className: 'wbm-conflict-detail' },
              t('conflictDetail', { expected: conflict.expected, actual: conflict.actual }))),
          el('button', {
            className: 'wbm-btn', type: 'button',
            disabled: saving || refreshing || busyKey !== '' || bulkRunning,
            onClick: onConflictRetry
          }, t('conflictRetry')))
      : null,
    missingPath
      ? el('div', { className: 'wbm-banner', role: 'alert' },
          el('span', null, t('bannerMissingPath')),
          el('span', { className: 'wbm-banner-path' }, strOf(body.sourcePath)),
          el('span', { className: 'wbm-banner-hint' }, t('bannerMissingHint')))
      : null,
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
    notice !== null
      ? el('div', { className: 'wbm-notice', 'data-kind': notice.kind, role: 'status' }, notice.text)
      : null,
    error !== ''
      ? el('div', { className: 'wbm-notice', 'data-kind': 'error', role: 'alert' },
          t('loadFailed') + '：' + error + ' ',
          el('button', { className: 'wbm-btn', type: 'button', onClick: pullState }, t('retry')))
      : null,
    // The bulk-update bar (#12): entry only while updatables exist, progress
    // while the serial walk runs, failure + 继续更新剩余 when one entry dies.
    bulkBar,
    cards,
    orphans.length > 0
      ? el('section', { className: 'wbm-orphans', 'aria-label': t('orphansTitle') },
          el('div', { className: 'wbm-orphans-head' },
            el('h3', { className: 'wbm-orphans-title' }, t('orphansTitle')),
            el('span', { className: 'wbm-orphans-count' }, String(orphans.length))),
          el('p', { className: 'wbm-orphans-hint' }, t('orphansHint')),
          orphans.map(function (orphan) {
            return el(OrphanRow, {
              key: 'orphan:' + strOf(orphan.id) + ':' + strOf(orphan.presetId),
              t: t, orphan: orphan, localeId: localeId,
              laneBusy: laneBusy, busyKey: busyKey, confirmKey: confirmKey,
              onActionConfirm: onActionConfirm, onCancelConfirm: onCancelConfirm,
              onAction: onOrphanAction
            })
          }))
      : null)
}

// ── the summon entry points (#11): input-box button + '@' trigger source ────

/**
 * Installed (summonable) WorkBuddy experts off GET /api/state — the same
 * route and install overlay the market page reads, so the button, the '@'
 * menu, and the host's summonableCards (src/summon.js) share ONE
 * classification authority: expert.installed === true is exactly the set
 * workbuddy_experts lists (an orphan installed from another source never
 * flags its card installed; a broken install stays summonable, design §6).
 * The payload is bilingual, so names/descriptions localize client-side
 * (localeNameOf/localeDescriptionOf) and the fetch needs no locale
 * parameter. Never rejects and never throws synchronously: failure yields
 * { ok: false, experts: [] } so callers can tell "zero installs" apart
 * from "state route failed".
 */
function fetchInstalledExperts () {
  return Promise.resolve().then(function () {
    return api(API_BASE + '/state')
  }).then(function (body) {
    var experts = body !== undefined && body !== null && Array.isArray(body.experts) ? body.experts : []
    return {
      ok: true,
      experts: experts.filter(function (expert) {
        return expert !== undefined && expert !== null && typeof expert === 'object' &&
          expert.installed === true && typeof expert.id === 'string'
      })
    }
  }, function () {
    return { ok: false, experts: [] }
  })
}

/**
 * Open the settings dialog and navigate to this plugin's market section:
 * with nothing installed yet, the button's healthy-empty path routes the
 * user to the install surface instead of an empty popover (sister-plugin
 * pattern — click the toolbar trigger if no dialog is open yet, then,
 * after two animation frames, click the nav button whose text equals our
 * section label).
 */
function openMarketSettings (t) {
  if (typeof document === 'undefined' || document === null) return
  if (document.querySelector('[role="dialog"]') === null) {
    var trigger = document.querySelector('button[aria-haspopup="dialog"]')
    if (trigger !== null && trigger !== undefined && typeof trigger.click === 'function') trigger.click()
  }
  var select = function () {
    var buttons = document.querySelectorAll('[role="dialog"] nav button')
    var wanted = t('nav')
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i]
      if (button.textContent !== null && button.textContent.trim() === wanted) {
        if (typeof button.click === 'function') button.click()
        return
      }
    }
  }
  var frame = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame
    : function (fn) { setTimeout(fn, 16) }
  frame(function () { frame(select) })
}

/**
 * The summon instruction draft for (name, slug). The tool wording follows
 * src/summon.js's descriptions: the draft ASKS THE MODEL to call
 * summon_workbuddy_expert (the client never calls the tool itself — it
 * only writes the draft). The ticket's "workbuddy 两位" fixes the NAMESPACE
 * (these names, never the sister's market_* pair): the draft names the
 * summon tool alone because it already carries the expert's exact id and
 * display name — workbuddy_experts (the list tool) only matters when the
 * id is unknown, which a draft never is. A non-blank composer draft rides
 * along as the task.
 */
function buildSummonInstruction (t, name, slug, draft) {
  var task = typeof draft === 'string' ? draft : ''
  return t(task.trim().length > 0 ? 'summonInstructionWithTask' : 'summonInstruction', {
    name: name,
    slug: slug,
    task: task
  })
}

/**
 * The summon-side search haystack of one card under one UI language: the
 * id and BOTH names always match (cross-language, like the page search),
 * plus the currently shown name/description — one matcher shared by the
 * popover filter and the '@' candidates.
 */
function summonHaystackOf (expert, localeId) {
  return [strOf(expert.id), strOf(expert.name), strOf(expert.zhName),
    localeNameOf(expert, localeId), localeDescriptionOf(expert, localeId)].join(' ').toLowerCase()
}

/** The sparkle glyph beside the button label (inline SVG, no request). */
function summonIcon () {
  return el('svg', {
    viewBox: '0 0 16 16',
    width: 14,
    height: 14,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  },
    el('path', { d: 'M8 2.5l1.15 2.35 2.35 1.15-2.35 1.15L8 9.5l-1.15-2.35L4.5 6l2.35-1.15z' }),
    el('path', { d: 'M12.75 10.25l.55 1.2 1.2.55-1.2.55-.55 1.2-.55-1.2-1.2-.55 1.2-.55z' }))
}

/** Pointer target inside the button container or the popover: keep the menu. */
function pointerInsideSummonUi (target) {
  if (target === null || target === undefined || typeof target.closest !== 'function') return false
  return target.closest('.wbm-summon-menu') !== null || target.closest('.wbm-summon-wrap') !== null
}

/**
 * Pill button in the input row (sister shape). Click fetches the installed
 * roster first: a healthy empty roster opens the market settings section
 * (nothing to summon — go install one); a failed fetch still toggles the
 * menu, which shows its empty-state copy. The popover carries a filter box
 * once the roster passes eight, the localized name over the mono id (the
 * description line, falling back to the bare id when the card has none),
 * arrow-key navigation from the filter field, Escape to close, and a
 * footer that promises the pick only writes a DRAFT through
 * inputActions.setDraft — it never sends.
 */
function SummonButton (props) {
  var t = props.t
  // The UI language read LIVE per render: names re-derive from the same
  // bilingual snapshot, so a locale switch re-renders through the slot's
  // locale seat with no refetch.
  var localeId = props.getLocale()
  var openState = React.useState(false)
  var open = openState[0]
  var setOpen = openState[1]
  var listState = React.useState([])
  var installed = listState[0]
  var setInstalled = listState[1]
  var filterState = React.useState('')
  var filter = filterState[0]
  var setFilter = filterState[1]
  var activeState = React.useState(-1)
  var active = activeState[0]
  var setActive = activeState[1]

  React.useEffect(function () {
    if (!open || typeof document === 'undefined' || document === null) return undefined
    var onPointerDown = function (event) {
      if (pointerInsideSummonUi(event && event.target)) return
      setOpen(false)
    }
    var onKeyDown = function (event) {
      if (event !== null && event !== undefined && event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return function () {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  var onClick = function () {
    fetchInstalledExperts().then(function (result) {
      setInstalled(result.experts)
      setFilter('')
      setActive(-1)
      if (result.ok === true && result.experts.length === 0) {
        openMarketSettings(t)
        return
      }
      setOpen(function (prev) { return !prev })
    })
  }

  var pick = function (expert) {
    var draft = props.input !== undefined && props.input !== null && typeof props.input.draft === 'string'
      ? props.input.draft
      : ''
    if (props.inputActions !== undefined && typeof props.inputActions.setDraft === 'function') {
      props.inputActions.setDraft(buildSummonInstruction(t, localeNameOf(expert, localeId), strOf(expert.id), draft))
    }
    setOpen(false)
  }

  var visible = open
    ? installed.filter(function (expert) {
        var q = filter.trim().toLowerCase()
        if (q === '') return true
        return summonHaystackOf(expert, localeId).indexOf(q) !== -1
      })
    : []

  var onFilterKeyDown = function (event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      var count = visible.length
      if (count === 0) return
      setActive(function (prev) {
        return event.key === 'ArrowDown' ? (prev + 1) % count : (prev - 1 + count) % count
      })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (active >= 0 && visible[active] !== undefined) pick(visible[active])
    }
  }

  var menu = null
  if (open) {
    var items = visible.map(function (expert, index) {
      var name = localeNameOf(expert, localeId)
      var description = localeDescriptionOf(expert, localeId)
      return el('button', {
        key: strOf(expert.id),
        type: 'button',
        className: 'wbm-summon-item',
        'data-active': index === active ? 'true' : undefined,
        title: description !== '' ? description : strOf(expert.id),
        onMouseDown: function (event) {
          event.preventDefault()
          pick(expert)
        },
        // Keyboard activation arrives as a click with detail 0.
        onClick: function (event) {
          if (event !== null && event !== undefined && event.detail === 0) pick(expert)
        },
        ref: index === active
          ? function (node) {
              if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' })
            }
          : undefined
      },
        el(AvatarFace, { expert: expert, imgClass: 'wbm-summon-emoji', glyphClass: 'wbm-summon-emoji' }),
        el('span', { className: 'wbm-summon-item-body' },
          el('span', { className: 'wbm-summon-item-name' }, name),
          description !== ''
            ? el('span', { className: 'wbm-summon-item-desc' }, strOf(expert.id) + ' — ' + description)
            : el('span', { className: 'wbm-summon-item-desc' }, strOf(expert.id))))
    })
    menu = el('div', { className: 'wbm-summon-menu' },
      el('div', { className: 'wbm-summon-menu-title' }, t('summonMenuTitle')),
      installed.length > 8
        ? el('input', {
            className: 'wbm-summon-filter',
            type: 'search',
            value: filter,
            placeholder: t('summonFilter'),
            'aria-label': t('summonFilter'),
            onChange: function (event) { setFilter(event.target.value); setActive(-1) },
            onKeyDown: onFilterKeyDown
          })
        : null,
      items.length === 0
        ? el('div', { className: 'wbm-summon-empty' }, t('summonMenuEmpty'))
        : items,
      el('div', { className: 'wbm-summon-foot' }, t('summonFootnote')))
  }

  return el('div', { className: 'wbm-summon-wrap' },
    el('button', {
      type: 'button',
      className: 'wbm-summon-btn',
      title: t('summonButtonTitle'),
      onClick: onClick
    },
      summonIcon(),
      el('span', null, t('summonButtonLabel'))),
    menu)
}

/**
 * The '@' trigger source: one group of INSTALLED WorkBuddy experts fed by
 * the same /api/state overlay as the button. Candidates show the
 * locale-following name with the mono id riding the description line
 * (id + zhName/enName), carry a localized `section` heading (rendered
 * verbatim in place of the raw source name, which the slash.menu namespace
 * cannot translate for third-party sources), and stash the expert id in
 * `hint`; onPick splices the summon instruction over the trigger token —
 * a draft, never a send. The icon seat renders a plain STRING glyph, so
 * the candidate carries the static 🧑‍💻 emoji, not the card's PNG (the
 * menu's icon seat cannot take a URL; the popover, which owns its own
 * markup, shows the real avatar).
 */
function buildTriggerSource (t, getLocale) {
  return {
    trigger: '@',
    name: 'workbuddy-market',
    order: 150,
    candidates: function (_session, req) {
      var query = req !== undefined && req !== null && typeof req.query === 'string' ? req.query : ''
      var q = query.trim().toLowerCase()
      var localeId = getLocale()
      return fetchInstalledExperts().then(function (result) {
        return result.experts.filter(function (expert) {
          if (q === '') return true
          return summonHaystackOf(expert, localeId).indexOf(q) !== -1
        }).map(function (expert) {
          var description = localeDescriptionOf(expert, localeId)
          return {
            name: localeNameOf(expert, localeId),
            icon: AVATAR_EMOJI,
            hint: strOf(expert.id),
            section: t('triggerSection'),
            description: description !== '' ? strOf(expert.id) + ' · ' + description : strOf(expert.id)
          }
        })
      })
    },
    onPick: function (pick) {
      var candidate = pick !== undefined && pick !== null && pick.candidate !== undefined && pick.candidate !== null
        ? pick.candidate
        : {}
      var name = typeof candidate.name === 'string' ? candidate.name : ''
      var slug = typeof candidate.hint === 'string' ? candidate.hint : ''
      return { text: buildSummonInstruction(t, name, slug, '') }
    }
  }
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

  // The input-box summon button (#11): conversation.input.left, the seat
  // the sister plugin's verified button rides. Order 1 keeps this plugin's
  // pill beside — and after — the sister's order-0 pill when both markets
  // compose in one profile.
  collect(slots.inject('conversation.input.left', function () {
    return slots.register({
      name: 'conversation.input.left',
      id: 'workbuddy-market',
      order: 1,
      locale: NS
    }, function (props) {
      props = props || {}
      // The session-scoped standard-kit provider supplies inputActions
      // (setDraft) and the input state (draft). Without a setDraft seam the
      // button has no way to write the draft, so it degrades to hidden.
      if (props.inputActions === undefined || props.inputActions === null ||
          typeof props.inputActions.setDraft !== 'function') return null
      return el(SummonButton, { t: t, getLocale: getLocale, input: props.input, inputActions: props.inputActions })
    })
  }))

  // The '@' trigger source (#11) needs the inputTriggers service, composed
  // via package.json dsh.client.inject (dsh-client-ui-input-trigger —
  // restored by this ticket). A missing service (or a duplicate-name
  // registration) only skips the @ entry; the settings page and the input
  // button are unaffected.
  var inputTriggers = typeof ctx.get === 'function' ? ctx.get('inputTriggers') : undefined
  if (inputTriggers !== undefined && inputTriggers !== null && typeof inputTriggers.registerSource === 'function') {
    try {
      collect(inputTriggers.registerSource(buildTriggerSource(t, getLocale)))
    } catch (error) {
      if (ctx.logger && typeof ctx.logger.warn === 'function') {
        ctx.logger.warn('dsh-workbuddy-market: input trigger source registration failed: ' +
          (error && error.message ? error.message : String(error)))
      }
    }
  } else if (ctx.logger && typeof ctx.logger.warn === 'function') {
    ctx.logger.warn('dsh-workbuddy-market: inputTriggers service unavailable; @ trigger source not registered')
  }

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
// 'inputTriggers' (dsh-client-ui-input-trigger, likewise composed there) is
// deliberately NOT declared here: a hard inject would stall the whole plugin
// in compositions without the service, so apply() reads it via ctx.get and
// degrades to skipping only the @ source.
module.exports = { name: NS, inject: ['slots', 'locale'], apply: apply }
// Extra exports for offline smoke checks (scripts/smoke.mjs); the module
// loader treats unknown plugin keys as inert.
module.exports.DICTS = DICTS
module.exports.AVATAR_EMOJI = AVATAR_EMOJI
module.exports.filterExperts = filterExperts
module.exports.localeNameOf = localeNameOf
module.exports.localeDescriptionOf = localeDescriptionOf
module.exports.cardActionsOf = cardActionsOf
module.exports.formatWhen = formatWhen
module.exports.ExpertCard = ExpertCard
module.exports.OrphanRow = OrphanRow
module.exports.TeamGroup = TeamGroup
module.exports.groupCardsByPlugin = groupCardsByPlugin
module.exports.groupExpanded = groupExpanded
module.exports.groupStatsOf = groupStatsOf
module.exports.updatableQueueOf = updatableQueueOf
module.exports.MarketPage = MarketPage
module.exports.fetchInstalledExperts = fetchInstalledExperts
module.exports.buildSummonInstruction = buildSummonInstruction
module.exports.SummonButton = SummonButton
module.exports.buildTriggerSource = buildTriggerSource
return module.exports;
} });
