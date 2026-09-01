/**
 * zhName priority audit (ticket #12, design §10 P4): a scripted sample of the
 * REAL WorkBuddy corpus comparing the `profession.zh` and displayName-like
 * fields every zhName candidate chain reads, so the priority decision
 * (#22) rests on printed evidence rather than anecdote.
 *
 * Read-only. Usage:
 *
 *   node scripts/zhname-audit.mjs [sourceRoot] [--solo N]
 *
 *   sourceRoot  raw source path (default: the real corpus at
 *               ~/.workbuddy/plugins/marketplaces/experts/plugins — the
 *               design's canonical corpus; any fixture tree also works)
 *   --solo N    how many solo cards to sample (default 10; team member
 *               cards are ALWAYS all sampled — they are the scarce class)
 *
 * For every sampled card the audit prints one row with every Chinese-name
 * source the scanner can see —
 *
 *   fm(dn)  frontmatter displayName.zh
 *   fm(pr)  frontmatter profession.zh
 *   pj(dn)  plugin.json  displayName.zh   (solo cards only in the chain)
 *   pj(pr)  plugin.json  profession.zh
 *   h1      body first heading (#19's source, shown for context)
 *
 * — plus the zhName the CURRENT scanner produces and the one the
 * displayName-first ordering WOULD produce, so an ordering regression is a
 * visible diff rather than a silent drift. A final tally counts, per class:
 * cards where the two orderings disagree, and which field won.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { DEFAULT_SOURCE_PATH, expandTildePath, scanWorkbuddyRoot } from '../src/scanner.js'

const argv = process.argv.slice(2)
const soloIndex = argv.indexOf('--solo')
const soloRaw = soloIndex >= 0 ? argv[soloIndex + 1] : undefined
const soloWant = soloRaw !== undefined && soloRaw !== '' && !Number.isNaN(Number(soloRaw))
  ? Math.max(0, Number(soloRaw)) : 10
if (soloIndex >= 0) argv.splice(soloIndex, 2)
const rawRoot = argv.find((arg) => !arg.startsWith('--')) ?? DEFAULT_SOURCE_PATH

const root = expandTildePath(rawRoot)
const scan = await scanWorkbuddyRoot(rawRoot)
if (scan.experts.length === 0) {
  console.log(`zhname-audit: no cards under ${root} — nothing to sample`)
  process.exit(0)
}

/** Trimmed `.zh` of a frontmatter/plugin.json metadata object. */
const zhOf = (value) => (typeof value?.zh === 'string' ? value.zh.trim() : '')

/**
 * One row of raw evidence per card: the frontmatter fields re-read straight
 * from the agent md (the scanner's own parse would already have folded them
 * into zhName, hiding exactly the comparison this audit exists to make) and
 * the plugin.json fields re-read from disk.
 */
async function evidenceOf(card) {
  const agentText = (await readFile(join(root, card.pluginDir, 'agents', card.agentFile), 'utf8'))
    .replace(/\r\n?/g, '\n')
  const frontmatter = agentText.split('\n---')[0]
  const fmField = (key) => {
    const block = new RegExp(`^${key}:\\n((?:[ \\t]+.*\\n?)*)`, 'm').exec(frontmatter)
    if (block === null) {
      const inline = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(frontmatter)
      return inline === null ? '' : inline[1].trim().replace(/^["']|["']$/g, '')
    }
    const zh = /^[ \t]+zh:[ \t]*(.+)$/m.exec(block[1])
    return zh === null ? '' : zh[1].trim().replace(/^["']|["']$/g, '')
  }
  const manifest = JSON.parse(
    (await readFile(join(root, card.pluginDir, '.codebuddy-plugin', 'plugin.json'), 'utf8')).replace(/\r\n?/g, '\n'),
  )
  const h1 = /^#{1,6}[ \t]+(.+)$/m.exec(agentText.split('\n---').slice(1).join('\n---'))
  return {
    fmDn: fmField('displayName'),
    fmPr: fmField('profession'),
    pjDn: zhOf(manifest.displayName),
    pjPr: zhOf(manifest.profession),
    h1: h1 === null ? '' : h1[1].trim(),
  }
}

const team = scan.experts.filter((card) => card.teamSize > 1)
const solo = scan.experts.filter((card) => card.teamSize <= 1)
const stride = Math.max(1, Math.floor(solo.length / soloWant))
const soloSample = Array.from({ length: Math.min(soloWant, solo.length) }, (_, i) => solo[(i * stride) % solo.length])

const quote = (value) => (value === '' ? '·' : value)
let teamDisagree = 0
let soloDisagree = 0
let soloDnIdentity = 0

console.log(`zhname-audit: ${rawRoot} — ${scan.experts.length} cards (${solo.length} solo + ${team.length} team members; sampling ${soloSample.length} solo)\n`)

for (const [label, cards] of [['TEAM (frontmatter chain)', team], ['SOLO (plugin.json chain)', soloSample]]) {
  console.log(`── ${label} ${'─'.repeat(Math.max(0, 56 - label.length))}`)
  for (const card of cards) {
    const e = await evidenceOf(card)
    // What each ORDERING picks, re-derived from the raw evidence. `current`
    // mirrors the SHIPPED chains (#22: functional name first for both
    // classes — team = fm pr → fm dn, solo = pj pr → fm dn → fm pr);
    // `flipped` is the displayName-first alternative the audit rejected, so
    // a scanner regression shows up as a zhName ≠ current disagreement.
    const current = card.teamSize > 1
      ? (e.fmPr || e.fmDn || '')
      : (e.pjPr || e.fmDn || e.fmPr || '')
    const flipped = card.teamSize > 1
      ? (e.fmDn || e.fmPr || '') : (e.fmDn || e.pjDn || e.pjPr || '')
    const disagree = current !== flipped
    if (disagree) card.teamSize > 1 ? teamDisagree++ : soloDisagree++
    if (card.teamSize <= 1 && e.pjDn !== '' && e.pjDn !== e.pjPr) soloDnIdentity++
    const flippedLabel = 'dn-first'
    console.log(
      `  ${card.pluginDir}/${card.id}`.padEnd(46)
      + ` fm(dn)=${quote(e.fmDn).padEnd(10)} fm(pr)=${quote(e.fmPr).padEnd(12)}`
      + ` pj(dn)=${quote(e.pjDn).padEnd(10)} pj(pr)=${quote(e.pjPr).padEnd(14)}`
      + ` h1=${quote(e.h1).slice(0, 26).padEnd(26)}`
      + ` zhName=${card.zhName}`
      + (disagree ? `  ⟂ ${flippedLabel}→${flipped}` : ''),
    )
  }
  console.log('')
}

console.log('tally:')
console.log(`  team members sampled      : ${team.length}; current(#22 functional-first) vs dn-first disagree on ${teamDisagree}`)
console.log(`  solo cards sampled        : ${soloSample.length}; current(#22 functional-first) vs dn-first disagree on ${soloDisagree}`)
console.log(`  solo pj(dn) ≠ pj(pr)      : ${soloDnIdentity}/${soloSample.length} sampled (displayName.zh carries a different, identity-flavored value)`)
console.log(`  corpus plugin dirs        : ${(await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith('git:')).length} (git: copies excluded from cards)`)
