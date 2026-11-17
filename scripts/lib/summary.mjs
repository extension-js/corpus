// Build summary: the CLI's own account of a build, read after each cell.
//
// `extension build --silent` prints nothing when a build passes, so a warning in
// a passing cell would never reach the run log. A CLI that writes a summary
// leaves it at dist/extension-js/<browser>/build-summary.json, next to the output.
//
// This never decides a verdict. A CLI that writes no summary, a summary that
// cannot be read and a summary left by an earlier build all read as "unknown":
// warningsCount is null, which is told apart from a build that warned 0 times.
import fs from 'node:fs'
import path from 'node:path'

const UNKNOWN = {warningsCount: null, warnings: []}

export function summaryPath(projectDir, browser) {
  return path.join(projectDir, 'dist', 'extension-js', browser, 'build-summary.json')
}

// `startedAt` is the cell's start in epoch milliseconds. A vendored sample can
// carry a summary from its own upstream build, and that one must not be read
// as this build's.
export function readBuildSummary(projectDir, browser, startedAt) {
  const file = summaryPath(projectDir, browser)
  let summary
  try {
    if (fs.statSync(file).mtimeMs < startedAt) return UNKNOWN
    summary = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return UNKNOWN
  }
  const count = summary?.warnings_count
  if (!Number.isInteger(count) || count < 0) return UNKNOWN
  const warnings = Array.isArray(summary.warnings) ? summary.warnings.filter((w) => typeof w === 'string') : []
  return {warningsCount: count, warnings}
}

// A warning names files by the sample's throwaway folder, which differs for
// every sample. With that folder removed, the same warning reads the same in
// every cell it shows up in, and a path reads relative to the sample.
export function withoutSamplePaths(warning, dirs) {
  let text = warning
  // Longest first: on macOS the resolved folder contains the unresolved one.
  for (const dir of [...new Set(dirs)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    text = text.split(dir + path.sep).join('').split(dir).join('.')
  }
  return text.trim()
}

function indented(warning) {
  return warning.split('\n').map((line) => `      ${line}`)
}

// The warnings block printed once, after the last verdict line. `cells` holds
// one entry per passing cell that warned: {id, browser, warningsCount, warnings}.
// A warning that reads the same in several cells is printed once with its cell
// count and one cell to look at. Only a warning no other cell has is printed
// under its own cell, so 240 samples that share one warning cost one entry.
export function warningReportLines(cells) {
  const warned = cells.filter((c) => c.warningsCount > 0)
  if (warned.length === 0) return []
  const ordered = [...warned].sort((a, b) => a.id.localeCompare(b.id))

  const seenIn = new Map()
  for (const cell of ordered) {
    for (const warning of new Set(cell.warnings)) {
      if (!seenIn.has(warning)) seenIn.set(warning, [])
      seenIn.get(warning).push(cell)
    }
  }
  const shared = [...seenIn].filter(([, list]) => list.length > 1).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

  const lines = ['', `Warnings in passing cells: ${seenIn.size} distinct in ${warned.length} cell${warned.length === 1 ? '' : 's'}`]
  if (shared.length > 0) {
    lines.push('', '  In more than one cell:')
    for (const [warning, list] of shared) {
      lines.push(`    ${list.length} cells, for example ${list[0].id} (${list[0].browser})`, ...indented(warning))
    }
  }

  // The CLI caps the list it writes, so a count above the list length is said
  // out loud instead of looking like the whole story.
  const own = []
  for (const cell of ordered) {
    const unique = cell.warnings.filter((w) => seenIn.get(w).length === 1)
    const cut = cell.warnings.length < cell.warningsCount
    if (unique.length === 0 && !cut) continue
    const listed = cut ? `: ${cell.warningsCount} warnings, ${cell.warnings.length} listed by the CLI` : ''
    own.push(`    ${cell.id} (${cell.browser})${listed}`)
    for (const warning of unique) own.push(...indented(warning))
  }
  if (own.length > 0) lines.push('', '  In one cell only:', ...own)
  return lines
}
