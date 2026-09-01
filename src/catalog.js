/**
 * Scan cache with the shape the design doc's fingerprint scheme needs.
 *
 * Today the cache key is the raw source path alone (the scan is an empty
 * placeholder). Ticket #3 grows the key into the per-plugin file-manifest
 * fingerprint so `GET /api/state` auto-rescans on content changes; the
 * `invalidate()` seam — called by `POST /api/refresh` and by the settings
 * `sourcePath` watcher — stays exactly as wired here.
 */

import { scanWorkbuddyRoot } from './scanner.js'

/**
 * Create a scan cache around a scan function.
 * @param {(root: string) => Promise<{experts: object[], warnings: string[]}>} [scan]
 * @returns {{ stateOf(rawSourcePath: string): Promise<{experts: object[], warnings: string[]}>, invalidate(): void }}
 */
export function createCatalog(scan = scanWorkbuddyRoot) {
  let cached = null

  return {
    /** The scan result for one raw source path, re-scanned when the path (later: fingerprint) moves. */
    async stateOf(rawSourcePath) {
      if (cached === null || cached.sourcePath !== rawSourcePath) {
        cached = { sourcePath: rawSourcePath, result: await scan(rawSourcePath) }
      }
      return cached.result
    },

    /** Drop the cache; the next `stateOf` re-scans. */
    invalidate() {
      cached = null
    },
  }
}
