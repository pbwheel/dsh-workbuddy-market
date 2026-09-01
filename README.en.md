# dsh-workbuddy-market

**Turn your local WorkBuddy expert directory into an expert market inside DeepSeek Harness: browse, install as a user preset with one click, summon anytime**

[中文](README.md) · [Design doc](docs/design.md) · [LICENSE](LICENSE)

## What it is

A DSH (DeepSeek Harness) web plugin that scans your **local** WorkBuddy expert plugin directory (default `~/.workbuddy/plugins/marketplaces/experts/plugins`) **at runtime** and renders every expert as a market card — bilingual search and filters, team plugins folded into collapsible groups, inline install/update/uninstall, and a one-click update-all for stale cards. An installed expert is usable two ways: start a session on its `wb-<id>` preset, or summon it from any session (`workbuddy_experts` / `summon_workbuddy_expert` model tools, plus the input-box "Summon expert" button and the `@` menu — both draft the instruction and never auto-send).

```
Settings → WorkBuddy Experts → browse/search → Install ─┬→ new session on the wb-<id> preset
                                                        └→ summon from any session (workbuddy_experts / summon_workbuddy_expert)
```

WorkBuddy updated an expert? Hit Refresh for a forced rescan — or do nothing: every read compares the directory fingerprint and rescans automatically when it changed; installed experts light up ↑ updatable, individually or update-all.

## Privacy boundary

- **Read-only scan**: the plugin only reads your WorkBuddy expert directory; it never writes there and never touches WorkBuddy itself.
- **Zero data egress**: every HTTP route is same-origin only; no telemetry, no reporting, no third-party requests. Expert content never leaves your machine.
- **Products land in DSH_HOME only**: installing copies the expert's persona/skills into `${DSH_HOME:-~/.dsh}/.agent-presets/wb-<id>/` and nowhere else; uninstalling removes exactly that directory.
- **Zero expert data in this repo**: there is no `data/` directory here — this repo ships the market mechanism, not expert content.

## Relationship to the sister plugin dsh-agency-market

[dsh-agency-market](https://github.com/pbwheel/dsh-agency-market) is the same mechanism pointed at a different source: a static in-repo catalog (273 agency-agents experts) instead of your live private directory. **The two coexist in one profile**:

| | dsh-agency-market | dsh-workbuddy-market (this plugin) |
|---|---|---|
| Catalog data | in-repo `data/`, shipped with the plugin | your local directory, scanned at runtime |
| Updates | re-run the import script | Refresh rescans (fingerprint auto-rescan backs it up) |
| Install product | `expert-<id>` preset | `wb-<id>` preset (prefix isolation) |
| Summon tool names | `market_experts` / `summon_market_expert` | `workbuddy_experts` / `summon_workbuddy_expert` |

Each installs and summons its own; a summoned expert sub-agent can no longer summon experts from either market (the recursion deny lists cover both).

## Prerequisites

- A working DeepSeek Harness web install with the `dsh` command on PATH (Node.js 22+; otherwise prefix the commands below with `npx -p @deepseek-ai/dsh`).
- A local WorkBuddy expert directory (the default path above; you can also install first and point the path later — the page shows a notice until the path exists). The examples use the `web` profile; substitute as needed.

## Install (from scratch, copy-paste ready)

```sh
git clone https://github.com/pbwheel/dsh-workbuddy-market.git
cd dsh-workbuddy-market
dsh plugin --profile web add .
dsh --profile web --dump-config
```

`dsh-workbuddy-market` should appear in the config dump. Then **restart `dsh web`** (the bundle list is read at startup only) and **hard-refresh the browser**; open Settings → WorkBuddy Experts.

Zero build, zero runtime dependencies, no install scripts: the cloned directory is the plugin source — `src/` and `client/` are the artifacts; don't copy `src` alone.

## Using it

- **Market page** (Settings → WorkBuddy Experts): search hits both languages; filter chips (all/installed/updatable/with skills/team); **team plugins fold into one expandable group header** (stacked member faces + aggregated counts) while solo experts lay out flat; groups auto-expand while a search or filter is active.
- **Update all**: appears whenever updatable cards exist — updates strictly one at a time, each finished card refreshes in place; a mid-run failure stops with the reason shown and can be continued for the remainder.
- **Orphans**: after switching source directories, presets installed from another source are listed under "Installed from another source" — listed only, never blocking the market; confirmed uninstall by id.
- **Summoning**: let the model call the tools in any session, or use the input-box button / type `@` — the latter two only draft the instruction.

## Configuration

The source directory lives in the host settings namespace `workbuddy-market` as `sourcePath` (default `~/.workbuddy/plugins/marketplaces/experts/plugins`; the tilde is stored verbatim and expanded on use). The page topbar edits it with revision conflict protection; saving a nonexistent path is allowed — the state reports `pathExists` and the page shows a notice until it is fixed.

## HTTP API (prefix `/dsh-workbuddy-market`)

| Route | Method | Semantics |
|---|---|---|
| `/api/state` | GET | `{ sourcePath, pathExists, revision, experts, orphans, warnings }`; every card carries `installed/updatable/broken/avatarUrl`; fingerprint-checked, auto-rescans on change |
| `/api/avatar?id=` | GET | Streams the expert's PNG from the current scan table on demand (never copied); the id must pass `ID_RE`, hit the scan table, and stay inside the source root after realpath — every miss answers one identical 404; `image/png` + `max-age=60` |
| `/api/config` | POST | `{ sourcePath, expectedRevision? }` → saves the raw path, answers with the new state; stale revisions get 409 |
| `/api/refresh` | POST | Forced rescan, answers with the new state |
| `/api/install` | POST | `{ id }` → installs a user-level `wb-<id>` preset; same-source reinstalls are idempotent |
| `/api/update` | POST | `{ id }` → in-place re-stamp (persona/skills sync + fingerprint refresh) |
| `/api/uninstall` | POST | `{ id }` → removes the whole preset directory (the roster is the authority; orphans uninstall by id too) |

Mutating routes accept same-origin POST only, cap bodies at 4 KiB, and allow one change at a time (a concurrent second gets 409); every JSON route is `cache-control: no-store` — the sole exception is the avatar's `max-age=60`. Installing is copying plus file rewriting; no scripts are ever executed.

## Development

```sh
node scripts/smoke.mjs            # offline smoke checks, zero dependencies
node scripts/zhname-audit.mjs     # empirical zhName-priority audit over the real corpus (read-only)
```

No build, no dependencies, no install scripts. Host-side changes (`src/`, `package.json`) need a `dsh web` restart; client-only changes (`client/client.js`) take effect on page refresh. Design and decision log: [docs/design.md](docs/design.md).

## License

MIT
