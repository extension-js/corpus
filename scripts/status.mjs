#!/usr/bin/env node
// status.mjs — the single "are we clean?" verdict.
//
// Reads reports/diff.json (framework health, regressions, criteria skew) and, if
// present, reports/confirmed-regressions.json (regressions that survived a re-run).
// Renders a CLEAN / NOT CLEAN summary to stdout and — under GitHub Actions — to the
// job summary ($GITHUB_STEP_SUMMARY), so the run page and the README badge show the
// verdict at a glance.
//
//   CLEAN            0 framework failures AND 0 confirmed regressions → exit 0 (green)
//   NOT CLEAN        a framework failure or a confirmed regression    → exit 1 (red)
//   RE-BASELINE      scoring criteria changed since baseline          → exit 0 (neutral)
//
// QA_STRICT=1 exits 1 on any framework failure, criteria change or not.
import {REPORTS_DIR, readJson, fs, path} from './lib/util.mjs'

// Failures are reported as ids, which says nothing about cause. When one error
// text accounts for most of them the run is usually environmental, not a corpus
// regression, so name the dominant reason next to the count that carries it.
function dominantFailureReason() {
  const latest = readJson(path.join(REPORTS_DIR, 'latest.json'), null)
  if (!latest || !Array.isArray(latest.results)) return null
  const counts = new Map()
  for (const row of latest.results) {
    for (const result of Object.values(row.browsers || {})) {
      if (!result || result.status === 'pass' || result.status === 'skip') continue
      const reason = String(result.error || '(no error captured)').split('\n')[0].trim().slice(0, 200)
      counts.set(reason, (counts.get(reason) || 0) + 1)
    }
  }
  if (counts.size === 0) return null
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const [reason, count] = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
  return {reason, count, total, distinct: counts.size}
}

function main() {
  const diff = readJson(path.join(REPORTS_DIR, 'diff.json'), null)
  if (!diff) {
    console.error('No reports/diff.json — run `npm run report` first.')
    process.exitCode = 2
    return
  }
  const confirmed = readJson(path.join(REPORTS_DIR, 'confirmed-regressions.json'), null)
  // Prefer the confirmed (re-run-filtered) list; fall back to the raw diff.
  const regressions = confirmed ? confirmed.confirmed : diff.regressions.map((r) => r.id)
  const f = diff.framework
  const skew = diff.criteriaSkew

  const clean = f.failures.length === 0 && regressions.length === 0
  const verdict = skew ? '⚠️ RE-BASELINE NEEDED' : clean ? '✅ CLEAN' : '❌ NOT CLEAN'
  const pct = ((f.pass / f.attempted) * 100).toFixed(1)

  const dominant = f.failures.length ? dominantFailureReason() : null

  const lines = [
    `# ${verdict} · ${diff.cliVersion}`,
    '',
    `**Framework health:** ${f.pass}/${f.attempted} buildable samples pass (${pct}%) · ${f.skipped} skipped (sample-side/upstream)`,
    ...(dominant
      ? [
          `**Top failure reason:** ${dominant.count}/${dominant.total} failing builds (${dominant.distinct} distinct reason${dominant.distinct === 1 ? '' : 's'}) report: \`${dominant.reason}\``
        ]
      : []),
    `**Framework failures:** ${f.failures.length}${f.failures.length ? '\n' + f.failures.map((id) => `- ❌ \`${id}\``).join('\n') : ''}`,
    `**Confirmed regressions:** ${regressions.length}${regressions.length ? '\n' + regressions.map((id) => `- 🔴 \`${id}\``).join('\n') : ''}`,
    `**Progressions:** ${diff.progressions.length} · **Criteria:** \`${diff.criteria.hash}\`${skew ? ' (changed: re-baseline required, not a regression)' : ''}`
  ]
  const summary = lines.join('\n') + '\n'

  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)

  // A workflow that calls this lane reads the verdict as step outputs.
  if (process.env.GITHUB_OUTPUT) {
    const word = skew ? 'rebaseline' : clean ? 'clean' : 'not-clean'
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `verdict=${word}\nclean=${clean}\ncli-version=${diff.cliVersion}\n`
    )
  }

  // Skew is not a product problem — don't fail the job on it (re-baseline instead).
  // A release gate sets QA_STRICT: a failing build stops it whatever the baseline says.
  const strict = process.env.QA_STRICT === '1'
  if (!clean && (!skew || strict)) process.exitCode = 1
}

main()
