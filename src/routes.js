/**
 * HTTP routes bridging the (future) browser market page to the host. T1
 * ships the three skeleton routes from the design doc's API table:
 *
 *   GET  /dsh-workbuddy-market/api/state  → { sourcePath, pathExists,
 *                                             revision, experts, orphans,
 *                                             warnings } (no-store);
 *   POST /dsh-workbuddy-market/api/config { sourcePath, expectedRevision }
 *                                     → save the RAW path string through the
 *                                       SERVICE-level settings update (revision
 *                                       conflict protection), answer with the
 *                                       new state; nonexistent paths are
 *                                       saveable and surface as
 *                                       pathExists=false + warning;
 *   POST /dsh-workbuddy-market/api/refresh → drop the scan cache, answer
 *                                       with a freshly scanned state.
 *
 * Security baseline (ported from the sister plugin's verified routes):
 * mutating routes accept same-origin POSTs only (405/403 otherwise), JSON
 * bodies are capped at 4 KiB, every JSON response carries no-store, and one
 * mutating operation runs at a time — a concurrent second change gets 409.
 * The single-flight lane is shared by every mutating route of this plugin;
 * the install/update/uninstall routes of later tickets join the same lane.
 */

import { stat } from 'node:fs/promises'

import { expandTildePath } from './scanner.js'
import { SETTINGS_NS, namespaceDescriptor } from './settings.js'
import { errorMessage } from './util.js'

const ROUTE_BASE = '/dsh-workbuddy-market'

/** Write a JSON payload with no-store caching. */
function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

/** True when the request's Origin matches its Host — required on POSTs. */
function sameOrigin(request) {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** Read and parse a JSON body, rejecting anything over 4 KiB. */
async function readJsonBody(request, maxBytes = 4096) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Whether the expanded form of a raw stored path exists on disk. */
async function pathExists(rawSourcePath) {
  try {
    await stat(expandTildePath(rawSourcePath))
    return true
  } catch {
    return false
  }
}

/**
 * Compose one `/api/state` payload: raw stored path (tilde intact, #18),
 * its existence flag, the settings revision for conflict protection, the
 * (currently empty) expert table, and warnings.
 * @param {object} deps - { settingsService, catalog }
 * @returns {Promise<object>} the state payload
 */
async function buildState({ settingsService, catalog }) {
  const descriptor = namespaceDescriptor(settingsService)
  const rawSourcePath = descriptor.value.sourcePath
  const exists = await pathExists(rawSourcePath)
  const scan = await catalog.stateOf(rawSourcePath)
  const warnings = [...scan.warnings]
  if (!exists) warnings.push(`source path does not exist: ${rawSourcePath}`)
  return {
    sourcePath: rawSourcePath,
    pathExists: exists,
    revision: descriptor.revision,
    experts: scan.experts,
    // Orphan detection (installed wb-* presets missing from the current
    // source) reads the roster; it lands with the install ticket, and the
    // field ships now so the state shape matches the API table from day one.
    orphans: [],
    warnings,
  }
}

/** Validate the `sourcePath` field of a config body; returns it verbatim. */
function requireSourcePath(body) {
  if (body === null || typeof body !== 'object') throw new Error('body must be a JSON object')
  const sourcePath = body.sourcePath
  if (typeof sourcePath !== 'string' || sourcePath.trim() === '') {
    throw new Error('missing sourcePath')
  }
  return sourcePath
}

/**
 * Register every WorkBuddy-market route on the host webServer. Returns a
 * disposer that drops them all, so the plugin unloads cleanly.
 * @param {object} hostCtx - injected context exposing `webServer` + `settings`
 * @param {{ invalidate(): void }} deps - { catalog } the shared scan cache
 */
export function mountWorkbuddyMarketRoutes(hostCtx, { catalog }) {
  const disposers = []
  const register = (route) => {
    const off = hostCtx.webServer.register(route)
    if (typeof off === 'function') disposers.push(off)
  }

  /** What buildState reads: the injected settings service plus the shared scan cache. */
  const deps = { settingsService: hostCtx.settings, catalog }

  /** One mutating operation at a time; roster copies (later tickets) are not concurrency-safe. */
  let mutating = false

  /** Shared guard chain for mutating routes: method, origin, single-flight. */
  function mutationGuard(request, response) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'method not allowed' })
      return false
    }
    if (!sameOrigin(request)) {
      sendJson(response, 403, { error: 'same-origin required' })
      return false
    }
    if (mutating) {
      sendJson(response, 409, { error: 'another change is in progress' })
      return false
    }
    mutating = true
    return true
  }

  register({
    kind: 'exact',
    path: `${ROUTE_BASE}/api/state`,
    handler: async (request, response) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { error: 'method not allowed' })
        return
      }
      try {
        sendJson(response, 200, await buildState(deps))
      } catch (error) {
        sendJson(response, 500, { error: errorMessage(error) })
      }
    },
  })

  register({
    kind: 'exact',
    path: `${ROUTE_BASE}/api/config`,
    handler: async (request, response) => {
      if (!mutationGuard(request, response)) return
      try {
        const body = await readJsonBody(request)
        const sourcePath = requireSourcePath(body)
        const expectedRevision = body.expectedRevision
        let state
        try {
          // Service-level update: the scope-level update(patch) takes no
          // expectedRevision, so conflict protection is only available here.
          await hostCtx.settings.update(SETTINGS_NS, { sourcePath }, expectedRevision)
          state = await buildState(deps)
        } catch (error) {
          if (error?.code === 'SETTINGS_CONFLICT') {
            sendJson(response, 409, {
              error: errorMessage(error),
              code: 'SETTINGS_CONFLICT',
              expectedRevision: error.expected,
              revision: error.actual,
            })
            return
          }
          throw error
        }
        sendJson(response, 200, state)
      } catch (error) {
        sendJson(response, 400, { error: errorMessage(error) })
      } finally {
        mutating = false
      }
    },
  })

  register({
    kind: 'exact',
    path: `${ROUTE_BASE}/api/refresh`,
    handler: async (request, response) => {
      if (!mutationGuard(request, response)) return
      try {
        catalog.invalidate()
        sendJson(response, 200, await buildState(deps))
      } catch (error) {
        sendJson(response, 500, { error: errorMessage(error) })
      } finally {
        mutating = false
      }
    },
  })

  return () => {
    for (const off of disposers) off()
  }
}
