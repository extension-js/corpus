#!/usr/bin/env node
import {exec} from './lib/util.mjs'
import {resolveCli} from './lib/cli.mjs'

function parseVersion(raw) {
  const m = String(raw).trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function parseFloor(raw) {
  const m = String(raw).trim().replace(/^v/, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!m) return null
  return [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)]
}

function gte(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return true
}

function satisfiesClause(current, clause) {
  const parts = clause.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  let ok = true
  for (const part of parts) {
    const op = part.match(/^(>=|>|\^|~)?(.*)$/)
    const floor = parseFloor(op[2])
    if (!floor) return null
    if (op[1] === '>=' || op[1] === undefined || op[1] === '') {
      ok = ok && gte(current, floor)
    } else if (op[1] === '>') {
      ok = ok && gte(current, floor) && !(current[0] === floor[0] && current[1] === floor[1] && current[2] === floor[2])
    } else if (op[1] === '^') {
      ok = ok && gte(current, floor) && current[0] === floor[0]
    } else if (op[1] === '~') {
      ok = ok && gte(current, floor) && current[0] === floor[0] && current[1] === floor[1]
    } else {
      return null
    }
  }
  return ok
}

function satisfies(current, range) {
  const clauses = String(range).split('||')
  let anyParsed = false
  let ok = false
  for (const clause of clauses) {
    const r = satisfiesClause(current, clause)
    if (r === null) return null
    anyParsed = true
    ok = ok || r
  }
  return anyParsed ? ok : null
}

function main() {
  const runtimeRaw = process.argv[2] || process.version
  const current = parseVersion(runtimeRaw)
  const cli = resolveCli()

  if (!current) {
    console.error(`Runtime preflight: cannot read a node version from "${runtimeRaw}".`)
    process.exitCode = 1
    return
  }

  if (cli.kind !== 'published') {
    console.log(`Runtime preflight: ${cli.label} is a local build, no published engines range to check. node ${runtimeRaw}.`)
    return
  }

  const r = exec('npm', ['view', cli.label, 'engines.node'])
  const range = r.ok ? r.stdout.trim().split('\n').pop().trim() : ''

  if (!range) {
    console.error(`Runtime preflight: could not read engines.node for ${cli.label}; refusing to claim the runtime is supported.`)
    process.exitCode = 1
    return
  }

  const ok = satisfies(current, range)

  if (ok === null) {
    console.error(`Runtime preflight: engines.node "${range}" for ${cli.label} is outside what this check can parse; extend scripts/assert-runtime-supported.mjs rather than run a matrix it cannot vouch for.`)
    process.exitCode = 1
    return
  }

  if (!ok) {
    console.error(
      `Runtime preflight FAILED: ${cli.label} declares engines.node "${range}" and this runner is node ${runtimeRaw}.\n` +
        `Every sample would fail with the same engine refusal, which reads as a corpus-wide regression and is not one.\n` +
        `Raise node-version in the workflow to satisfy "${range}".`
    )
    process.exitCode = 1
    return
  }

  console.log(`Runtime preflight OK: node ${runtimeRaw} satisfies engines.node "${range}" for ${cli.label}.`)
}

main()
