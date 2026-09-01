/**
 * HTTP routes bridging the (future) browser market page to the host. T1
 * shipped the three skeleton routes; T4 (ticket #5) added the install route;
 * T6 (ticket #7) adds the avatar stream; T5 (ticket #6) adds the
 * update/uninstall routes and the install overlay on state:
 *
 *   GET  /dsh-workbuddy-market/api/state  → { sourcePath, pathExists,
 *                                             revision, experts, orphans,
 *                                             warnings } (no-store); expert
 *                                             cards carry avatarUrl (only
 *                                             when the scan found a PNG —
 *                                             PNG-less experts have neither
 *                                             avatarUrl nor avatarPath) and
 *                                             the install flags from the
 *                                             roster/manifest overlay
 *                                             (installed/updatable/broken,
 *                                             every card, all three always
 *                                             present); `orphans` lists the
 *                                             roster wb-* presets whose
 *                                             manifest names another source
 *                                             or whose id left the current
 *                                             scan table — reported, never
 *                                             auto-uninstalled (#9);
 *   GET  /dsh-workbuddy-market/api/avatar?id=<id>
 *                                     → the expert's PNG read on demand from
 *                                       the CURRENT scan table (never copied),
 *                                       image/png + max-age=60; the id must
 *                                       pass the scanner's ID_RE, hit the
 *                                       table, and its avatarPath must
 *                                       realpath inside the source root —
 *                                       unknown/invalid/escaping ids all
 *                                       answer one uniform 404 (no probe
 *                                       signal), and read failures 404 the
 *                                       same way;
 *   POST /dsh-workbuddy-market/api/config { sourcePath, expectedRevision }
 *                                     → save the RAW path string through the
 *                                       SERVICE-level settings update (revision
 *                                       conflict protection), answer with the
 *                                       new state; nonexistent paths are
 *                                       saveable and surface as
 *                                       pathExists=false + warning;
 *   POST /dsh-workbuddy-market/api/refresh → drop the scan cache, answer
 *                                       with a freshly scanned state;
 *   POST /dsh-workbuddy-market/api/install { id }
 *                                     → install the scanned expert as the
 *                                       user preset wb-<id> through the
 *                                       roster (src/presets.js, the design
 *                                       §4 seven steps);
 *   POST /dsh-workbuddy-market/api/update { id }
 *                                     → re-stamp the installed preset in
 *                                       place from the CURRENT scan card
 *                                       (preset.yml + persona + skills sync
 *                                       including deletions + manifest +
 *                                       standing re-validation);
 *   POST /dsh-workbuddy-market/api/uninstall { id }
 *                                     → remove the whole wb-<id> preset
 *                                       directory through the roster
 *                                       (skills and manifest with it),
 *                                       refusing non-user-trust entries;
 *                                       works for orphans too — the roster,
 *                                       not the scan table, is the authority.
 *
 * Security baseline (ported from the sister plugin's verified routes):
 * mutating routes accept same-origin POSTs only (405/403 otherwise), JSON
 * bodies are capped at 4 KiB, every JSON response carries no-store, and one
 * mutating operation runs at a time — a concurrent second change gets 409.
 * The single-flight lane is shared by every mutating route of this plugin
 * (roster copies are not concurrency-safe). Installs/updates are file copies
 * plus text edits — no script ever runs. The avatar route is a GET read: no
 * origin check, no lane — its only guard is the id/containment chain above,
 * and it is the ONE response allowed to cache (max-age=60, the design's sole
 * exception to no-store; a source PNG mtime change moves the fingerprint,
 * the rescan swaps the bytes, and the 60s window absorbs itself).
 */

import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, sep } from 'node:path'

import { installWorkbuddyExpert, installedMarketState, uninstallWorkbuddyExpert, updateWorkbuddyExpert } from './presets.js'
import { ID_RE, expandTildePath } from './scanner.js'
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
 * True when a fully resolved candidate path sits strictly inside a fully
 * resolved root. Both inputs must already be realpath'd — the route resolves
 * both sides through the filesystem itself, so `..` segments AND symlinks
 * (a declared plugin.json avatar may be either) are undone before the
 * prefix test; a leading `../` or an absolute escape means "outside".
 */
function isWithinRoot(rootReal, candidateReal) {
  const rel = relative(rootReal, candidateReal)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/**
 * One state-payload expert card: the scan card minus the internal absolute
 * `avatarPath`, plus `avatarUrl` — but ONLY for experts the scan gave a PNG.
 * PNG-less experts carry neither field (the client's emoji fallback is the
 * next ticket). Ids are ID_RE-constrained by the scanner, so the URL needs
 * no percent-encoding. `flags` (the install overlay's verdict for this id,
 * undefined when nothing is installed) contributes the three install
 * booleans — present on EVERY card so the market page reads one shape.
 * @param {object} expert - the scan card
 * @param {{ installed?: boolean, updatable?: boolean, broken?: boolean }} [flags]
 */
function stateCardOf(expert, flags) {
  const { avatarPath, ...card } = expert
  const base = avatarPath === undefined
    ? card
    : { ...card, avatarUrl: `${ROUTE_BASE}/api/avatar?id=${expert.id}` }
  const { installed = false, updatable = false, broken = false } = flags ?? {}
  return { ...base, installed, updatable, broken }
}

/**
 * Compose one `/api/state` payload: raw stored path (tilde intact, #18),
 * its existence flag, the settings revision for conflict protection, the
 * expert table (cards via `stateCardOf` — avatarUrl only where the scan
 * found a PNG, plus the install overlay's installed/updatable/broken), the
 * orphan presets (installed from another source or gone from this source,
 * #9 — reported, never auto-uninstalled), and warnings (scan + path +
 * install-overlay together).
 * @param {object} deps - { settingsService, catalog, agentPresets }
 * @returns {Promise<object>} the state payload
 */
async function buildState({ settingsService, catalog, agentPresets }) {
  if (agentPresets === undefined) {
    // Unreachable in production (the routes segment hard-injects the
    // service) — a loud diagnostic beats a silent TypeError.
    throw new Error('agentPresets service is not composed')
  }
  const descriptor = namespaceDescriptor(settingsService)
  const rawSourcePath = descriptor.value.sourcePath
  const exists = await pathExists(rawSourcePath)
  const scan = await catalog.stateOf(rawSourcePath)
  const warnings = [...scan.warnings]
  if (!exists) warnings.push(`source path does not exist: ${rawSourcePath}`)
  const overlay = await installedMarketState(agentPresets, rawSourcePath, scan.experts)
  return {
    sourcePath: rawSourcePath,
    pathExists: exists,
    revision: descriptor.revision,
    experts: scan.experts.map((expert) => stateCardOf(expert, overlay.byId.get(expert.id))),
    orphans: overlay.orphans,
    warnings: [...warnings, ...overlay.warnings],
  }
}

/** The RAW stored source path every scan-facing caller reads (tilde intact, #18). */
function currentSourcePath(settingsService) {
  return namespaceDescriptor(settingsService).value.sourcePath
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

/** Validate the `id` field of an install body; ids match scan cards exactly. */
function requireExpertId(body) {
  if (body === null || typeof body !== 'object') throw new Error('body must be a JSON object')
  const id = body.id
  if (typeof id !== 'string' || id.length === 0) throw new Error('missing expert id')
  return id
}

/**
 * Register every WorkBuddy-market route on the host webServer. Returns a
 * disposer that drops them all, so the plugin unloads cleanly.
 * @param {object} hostCtx - injected context exposing `webServer` +
 *                           `agentPresets` + `settings`
 * @param {{ invalidate(): void }} deps - { catalog } the shared scan cache
 */
export function mountWorkbuddyMarketRoutes(hostCtx, { catalog }) {
  const disposers = []
  const register = (route) => {
    const off = hostCtx.webServer.register(route)
    if (typeof off === 'function') disposers.push(off)
  }

  /** What buildState reads: settings + the shared scan cache + the roster. */
  const deps = { settingsService: hostCtx.settings, catalog, agentPresets: hostCtx.agentPresets }

  /** The RAW stored source path (tilde intact, #18) every scan-facing caller reads. */
  const rawSourcePathOf = () => currentSourcePath(hostCtx.settings)

  /**
   * The CURRENT scan table's card for one expert id (undefined when absent)
   * — the shared lookup of the avatar, install, and update routes.
   */
  const currentCardOf = async (id) => {
    const scan = await deps.catalog.stateOf(rawSourcePathOf())
    return scan.experts.find((expert) => expert.id === id)
  }

  /** One mutating operation at a time; roster writes are not concurrency-safe. */
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
    path: `${ROUTE_BASE}/api/avatar`,
    handler: async (request, response) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { error: 'method not allowed' })
        return
      }
      // Every miss answers ONE uniform 404 — unknown id, charset reject,
      // PNG-less expert, out-of-root resolution, vanished file — so the
      // route cannot be probed for which ids exist.
      const notFound = () => sendJson(response, 404, { error: 'not found' })
      let id = null
      try {
        id = new URL(request.url ?? '/', 'http://internal.invalid').searchParams.get('id')
      } catch {
        id = null
      }
      if (typeof id !== 'string' || !ID_RE.test(id)) {
        notFound()
        return
      }
      try {
        // The card comes from the CURRENT scan table (through the catalog's
        // fingerprint cache, never a private rescan) — an id that is not in
        // the table has no avatar to serve.
        const card = await currentCardOf(id)
        if (card === undefined || typeof card.avatarPath !== 'string' || card.avatarPath === '') {
          notFound()
          return
        }
        // Containment on REAL paths: realpath undoes `..` and symlink hops
        // on both sides, so a declared avatar spelled or linked anywhere
        // outside the source root fails the check. A missing/unreadable
        // root or file resolves to null and 404s like any other miss.
        const rootReal = await realpath(expandTildePath(rawSourcePathOf())).catch(() => null)
        const avatarReal = await realpath(card.avatarPath).catch(() => null)
        if (rootReal === null || avatarReal === null || !isWithinRoot(rootReal, avatarReal)) {
          notFound()
          return
        }
        // Corpus PNGs are a few hundred KiB at most — a single Buffer read
        // is the stream here (design §5: read on demand, never copy). A
        // read that fails after containment (vanished mid-race, EACCES)
        // 404s like every other miss — the uniform body leaks no detail.
        const bytes = await readFile(avatarReal).catch(() => null)
        if (bytes === null) {
          notFound()
          return
        }
        response.writeHead(200, {
          'content-type': 'image/png',
          'cache-control': 'max-age=60',
          'content-length': String(bytes.length),
        })
        response.end(bytes)
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

  register({
    kind: 'exact',
    path: `${ROUTE_BASE}/api/install`,
    handler: async (request, response) => {
      if (!mutationGuard(request, response)) return
      try {
        const id = requireExpertId(await readJsonBody(request))
        // The card comes from the CURRENT scan table of the CURRENT source;
        // an id that is not in the table (never installed, or its plugin
        // degraded at scan time) is rejected before the roster is touched.
        const rawSourcePath = rawSourcePathOf()
        const card = await currentCardOf(id)
        if (card === undefined) throw new Error(`unknown expert id: ${id}`)
        const result = await installWorkbuddyExpert(hostCtx.agentPresets, card, rawSourcePath)
        sendJson(response, 200, { ok: true, ...result })
      } catch (error) {
        sendJson(response, 400, { error: errorMessage(error) })
      } finally {
        mutating = false
      }
    },
  })

  register({
    kind: 'exact',
    path: `${ROUTE_BASE}/api/update`,
    handler: async (request, response) => {
      if (!mutationGuard(request, response)) return
      try {
        const id = requireExpertId(await readJsonBody(request))
        // Like install, the update re-stamps from the CURRENT scan card of
        // the CURRENT source — presets.js owns the roster/manifest checks
        // (not installed / non-user trust / #17 manifest / #9 foreign source).
        const rawSourcePath = rawSourcePathOf()
        const card = await currentCardOf(id)
        if (card === undefined) throw new Error(`unknown expert id: ${id}`)
        const result = await updateWorkbuddyExpert(hostCtx.agentPresets, card, rawSourcePath)
        sendJson(response, 200, { ok: true, ...result })
      } catch (error) {
        sendJson(response, 400, { error: errorMessage(error) })
      } finally {
        mutating = false
      }
    },
  })

  register({
    kind: 'exact',
    path: `${ROUTE_BASE}/api/uninstall`,
    handler: async (request, response) => {
      if (!mutationGuard(request, response)) return
      try {
        const id = requireExpertId(await readJsonBody(request))
        // ID_RE gate for shape (the scanner constrains every real expert id
        // the same way); the roster — NOT the scan table — is the uninstall
        // authority, so orphans (ids absent from the current source) go
        // through: uninstalling them is the designed cleanup path (#9).
        if (!ID_RE.test(id)) throw new Error(`unknown expert id: ${id}`)
        const result = await uninstallWorkbuddyExpert(hostCtx.agentPresets, id)
        sendJson(response, 200, { ok: true, ...result })
      } catch (error) {
        sendJson(response, 400, { error: errorMessage(error) })
      } finally {
        mutating = false
      }
    },
  })

  return () => {
    for (const off of disposers) off()
  }
}
