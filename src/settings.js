/**
 * Settings namespace: `sourcePath` persistence for the WorkBuddy market.
 *
 * Registers one namespace on the host `settings` service:
 *
 *   - value `{ sourcePath: string }`; the composition base is the default
 *     WorkBuddy path so an untouched install resolves to it without any
 *     user override;
 *   - the stored/echoed string is the RAW user input — a leading `~` stays
 *     literal (decision #18) and is expanded only where the filesystem is
 *     touched (scanner, avatar route);
 *   - saving a path that does not exist is allowed (decision #3); existence
 *     is reported per state request, never validated at write time;
 *   - revision conflict protection lives at the SERVICE level
 *     (`settings.update(ns, patch, expectedRevision)`); the scope-level
 *     `update(patch)` takes no revision and is deliberately not used by the
 *     HTTP layer.
 *
 * The registration itself is an effect on the calling plugin fiber — the
 * service removes the namespace when that fiber disposes — so the disposer
 * returned here only has to drop what this module registered itself (the
 * cache-invalidation watcher).
 */

import { DEFAULT_SOURCE_PATH } from './scanner.js'

/**
 * Settings namespace id. Kebab-case without dots: the settings service
 * rejects anything outside `^[a-z][a-z0-9-]*$`, so the plugin's dotted
 * package name cannot serve as the namespace directly.
 */
export const SETTINGS_NS = 'workbuddy-market'

/**
 * Build the namespace schema with the given schemastery factory.
 * @param {import('@deepseek-ai/schemastery')} z - schemastery factory
 * @returns the live schema handed to `settings.register`
 */
export function buildSourcePathSchema(z) {
  return z.object({ sourcePath: z.string() })
}

/**
 * The namespace's descriptor from `settings.describe()` — the one place
 * that knows how to find this plugin's entry in the service's list. (The
 * summon segment's tolerant `currentRawSourcePath` in src/summon.js
 * deliberately bypasses this descriptor: it reads `settings.get` and falls
 * back to the default path, because it must stay usable while the settings
 * segment is pending, design §1.)
 * @param {object} settingsService - host settings service (injected `settings`)
 * @returns {{ ns: string, value: { sourcePath: string }, revision: number }} the descriptor
 * @throws when the namespace is not registered (the settings segment failed)
 */
export function namespaceDescriptor(settingsService) {
  const descriptor = settingsService.describe().find((entry) => entry.ns === SETTINGS_NS)
  if (descriptor === undefined) {
    throw new Error(`settings namespace "${SETTINGS_NS}" is not registered`)
  }
  return descriptor
}

/**
 * Register the namespace and wire the cache-invalidation watcher.
 * @param {object} settingsService - host settings service (injected `settings`)
 * @param {import('@deepseek-ai/schemastery')} z - schemastery factory
 * @param {{ invalidate(): void }} catalog - scan cache invalidated on path change
 * @returns {() => void} disposer for the watcher (the registration follows the caller's fiber)
 */
export function mountWorkbuddySettings(settingsService, z, catalog) {
  const scope = settingsService.register(SETTINGS_NS, buildSourcePathSchema(z), {
    base: { sourcePath: DEFAULT_SOURCE_PATH },
  })
  const off = scope.watch((next, prev) => {
    if (next?.sourcePath !== prev?.sourcePath) catalog.invalidate()
  })
  return () => {
    off()
  }
}
