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

// The lines to print under a sample's verdict line: the warnings of each cell
// that passed and warned. The CLI caps the list it writes, so a count above the
// list length is said out loud instead of looking like the whole story.
export function passingWarningLines(browsers, warningsByBrowser) {
  const lines = []
  for (const [browser, cell] of Object.entries(browsers)) {
    if (cell.status !== 'pass' || !(cell.warningsCount > 0)) continue
    const warnings = warningsByBrowser[browser] || []
    const shown = warnings.length < cell.warningsCount ? `, ${warnings.length} listed` : ''
    lines.push(`  ${browser}: ${cell.warningsCount} warning${cell.warningsCount === 1 ? '' : 's'}${shown}`)
    for (const warning of warnings) {
      for (const line of warning.trim().split('\n')) lines.push(`    ${line}`)
    }
  }
  return lines
}
