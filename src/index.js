/**
 * dsh-workbuddy-market host entry: mounts the settings namespace and the
 * market's HTTP routes once the profile composes the needed services, per
 * the design doc's staged-inject orchestration.
 *
 *   inject settings:
 *     src/settings.js   the `workbuddy-market` namespace (sourcePath kept
 *                       as the raw `~`-prefixed string) + the watcher that
 *                       invalidates the scan cache;
 *   inject webServer + agentPresets + settings:
 *     src/routes.js     /dsh-workbuddy-market/api/{state,config,refresh,
 *                       install} over src/scanner.js via src/catalog.js, with
 *                       src/presets.js behind the install route — the
 *                       update/uninstall routes of later tickets join this
 *                       same segment and its single-flight lane;
 *   inject tools + subagents + systemPrompt + agentPresets:
 *     src/summon.js     workbuddy_experts / summon_workbuddy_expert — the
 *                       P3 summon segment, deliberately absent until that
 *                       ticket (T1 ships only real, working segments).
 *
 * `settings` is a hard dependency of both mounted segments: a composition
 * without it leaves them pending (diagnosable), never half-activated.
 *
 * The schemastery factory resolves at module load (top-level await): the
 * settings schema needs it, and a link-installed copy cannot resolve the
 * bare specifier, so src/schemastery.js anchors resolution at the running
 * harness and an unresolvable environment fails the plugin import loudly
 * instead of surfacing as a mystery error at first use.
 */

import { createCatalog } from './catalog.js'
import { mountWorkbuddyMarketRoutes } from './routes.js'
import { mountWorkbuddySettings } from './settings.js'
import { resolveSchemastery } from './schemastery.js'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-workbuddy-market'

// No `Config` export on purpose: cordis resolveConfig() expects a schemastery
// schema (`Config["~standard"].validate`), so a plain object here crashes the
// loader entry at startup. When options are needed, export a schema built
// with the resolved '@deepseek-ai/schemastery' factory instead.

const z = await resolveSchemastery()

/**
 * Register the market against the host context.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host context
 */
export function apply(ctx) {
  const catalog = createCatalog()

  ctx.inject(['settings'], (settingsCtx) => {
    ctx.effect(() => mountWorkbuddySettings(settingsCtx.settings, z, catalog), 'dsh-workbuddy-market:settings')
  })

  ctx.inject(['webServer', 'agentPresets', 'settings'], (hostCtx) => {
    ctx.effect(() => mountWorkbuddyMarketRoutes(hostCtx, { catalog }), 'dsh-workbuddy-market:routes')
  })
}
