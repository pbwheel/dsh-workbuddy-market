/**
 * Runtime resolution of @deepseek-ai/schemastery.
 *
 * The settings namespace needs a live schemastery schema (`z.object(...)`),
 * but this plugin ships as a `link:` dependency for local development and
 * `dsh plugin add <path>` — and a linked package resolves bare specifiers
 * from its own real path, which cannot see `@deepseek-ai/*` (the same
 * link-install pitfall the design doc records for `@deepseek-ai/dsh-tools`).
 * Published installs (Git/npm, where pnpm materializes dependencies) have no
 * such problem, so resolution is layered:
 *
 *   1. plain dynamic import — succeeds wherever the install provides the
 *      package (published installs, hoisted layouts);
 *   2. the harness-maintained flat fallback `$DSH_HOME/profiles/node_modules`
 *      (one symlink per package in the running dsh's dependency closure,
 *      healed on every profile boot) — this is what a link-installed plugin
 *      rides on inside a real dsh host;
 *   3. the running dsh installation itself (the process entry script lives
 *      inside it), as a belt-and-braces anchor for unusual DSH_HOME setups.
 *
 * Every tier failing is a hard, loud error: the settings namespace is a hard
 * dependency of this plugin and must never silently degrade.
 */

import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { errorMessage } from './util.js'

const SPECIFIER = '@deepseek-ai/schemastery'

/** Import the package through a resolved file path (CJS default interop). */
async function importFromPath(path) {
  return (await import(pathToFileURL(path).href)).default
}

/** Candidate anchor files for `createRequire`, in tier order. */
function anchorFiles() {
  const anchors = []
  if (typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== '') {
    anchors.push(join(process.env.DSH_HOME, 'profiles', 'package.json'))
  }
  anchors.push(join(homedir(), '.dsh', 'profiles', 'package.json'))
  if (typeof process.argv[1] === 'string' && process.argv[1] !== '') {
    anchors.push(process.argv[1])
  }
  return anchors
}

/**
 * Resolve the schemastery factory the settings schema is built with.
 * @returns {Promise<import('@deepseek-ai/schemastery')>} the `z` factory
 * @throws when no tier can provide the package (with tier diagnostics)
 */
export async function resolveSchemastery() {
  const attempts = []
  try {
    const z = (await import(SPECIFIER)).default
    if (z !== null && typeof z.object === 'function') return z
    attempts.push(`plain import resolved without a usable default (${typeof z})`)
  } catch (error) {
    attempts.push(`plain import: ${errorMessage(error)}`)
  }
  for (const anchor of anchorFiles()) {
    try {
      const require = createRequire(anchor)
      const resolved = require.resolve(SPECIFIER)
      const z = await importFromPath(resolved)
      if (z !== null && typeof z.object === 'function') return z
      attempts.push(`${anchor}: resolved without a usable default (${typeof z})`)
    } catch (error) {
      attempts.push(`${anchor}: ${errorMessage(error)}`)
    }
  }
  throw new Error(
    'dsh-workbuddy-market: cannot resolve @deepseek-ai/schemastery, which the '
      + 'settings namespace schema requires; this plugin must run inside a dsh host. '
      + `Tried: ${attempts.join('; ')}`,
  )
}
