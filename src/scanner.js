/**
 * WorkBuddy source-directory scanner — T1 walking-skeleton placeholder.
 *
 * The real scanner (frontmatter/plugin.json metadata extraction, CRLF
 * tolerance, team cards, avatar resolution, template escaping) lands with
 * ticket #3; this file today only fixes the constants and the tilde rules
 * the settings namespace and routes already depend on:
 *
 *   - the default source path is stored and echoed as the RAW string with
 *     the leading `~` intact (decision #18) and expanded only at use time;
 *   - `scanWorkbuddyRoot` returns an empty expert table so every route and
 *     the catalog cache run end-to-end today.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

/** Default WorkBuddy experts directory, stored/echoed verbatim (#18). */
export const DEFAULT_SOURCE_PATH = '~/.workbuddy/plugins/marketplaces/experts/plugins'

/**
 * Expand a leading `~` or `~/` against the current home directory.
 * Anything else (absolute paths, `~foo`, relative paths) is returned as-is.
 * @param {string} value - raw stored path
 * @returns {string} the filesystem path to stat/read
 */
export function expandTildePath(value) {
  if (typeof value !== 'string') return value
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return join(homedir(), value.slice(2))
  return value
}

/**
 * Scan one WorkBuddy root into expert cards. T1 placeholder: always an
 * empty table, no warnings — the real traversal is ticket #3. The scan
 * receives the RAW stored path (tilde intact, #18) and expands it against
 * the filesystem itself; the catalog keys its cache by the same raw string.
 * @param {string} _rawRoot - raw stored source path (unused in the placeholder)
 * @returns {Promise<{ experts: object[], warnings: string[] }>}
 */
export async function scanWorkbuddyRoot(_rawRoot) {
  return { experts: [], warnings: [] }
}
