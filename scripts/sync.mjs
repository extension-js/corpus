#!/usr/bin/env node
// sync.mjs: fetch the latest commit of each enabled upstream, shallow-clone it
// into .cache/<id>, and report which sources changed since the last tested SHA.
//
// Writes sources.lock.json (the SHA actually under test). The weekly job uses
// the `changed` list to decide whether a full matrix re-run is warranted, but
// `--all` / cron always runs regardless so CLI regressions surface even when
// upstream is quiet.
//
// `--source id[,id]` syncs only the named sources and leaves every other lock
// entry as it is, so adding one source does not move the others.
import {ROOT, CACHE_DIR, enabledSources, exec, readJson, writeJson, ensureDir, fs, path} from './lib/util.mjs'

const LOCK = path.join(ROOT, 'sources.lock.json')
const ONLY = (() => {
  const i = process.argv.indexOf('--source')
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1].split(',') : null
})()

// A bare name matches every ref that ends with it (refs/heads/someone/master
// sorts before refs/heads/master), so ask for the branch by its full name first.
function remoteSha(repo, ref) {
  for (const name of [`refs/heads/${ref}`, ref]) {
    const r = exec('git', ['ls-remote', repo, name])
    if (!r.ok) return null
    const line = r.stdout.split('\n').find(Boolean)
    if (line) return line.split('\t')[0]
  }
  return null
}

// `sparse: true` fetches only the scan trees (plus the repository's root files,
// so its license still travels). For an upstream far larger than its samples.
// `submodules: true` also fetches the submodules at the commits the upstream
// pins, for a project that keeps part of the extension in a second repository.
function clone(src, dest) {
  fs.rmSync(dest, {recursive: true, force: true})
  if (!src.sparse) {
    const c = exec('git', ['clone', '--depth', '1', '--branch', src.ref, src.repo, dest])
    if (!c.ok || !src.submodules) return c
    return exec('git', ['submodule', 'update', '--init', '--depth', '1'], {cwd: dest})
  }
  const c = exec('git', ['clone', '--depth', '1', '--branch', src.ref, '--filter=blob:none', '--sparse', src.repo, dest])
  if (!c.ok) return c
  const trees = [...src.scan, ...(src.vendorInclude || [])]
  return exec('git', ['sparse-checkout', 'set', ...trees], {cwd: dest})
}

async function main() {
  ensureDir(CACHE_DIR)
  const lock = readJson(LOCK, {})
  const changed = []
  const summary = []

  for (const src of enabledSources().filter((s) => !ONLY || ONLY.includes(s.id))) {
    const dest = path.join(CACHE_DIR, src.id)
    const latest = remoteSha(src.repo, src.ref)
    if (!latest) {
      summary.push({id: src.id, status: 'unreachable'})
      console.error(`✗ ${src.id}: could not reach ${src.repo}`)
      continue
    }
    const prev = lock[src.id]?.sha
    const isChanged = prev !== latest
    if (isChanged || !fs.existsSync(path.join(dest, '.git'))) {
      const c = clone(src, dest)
      if (!c.ok) {
        summary.push({id: src.id, status: 'clone-failed'})
        console.error(`✗ ${src.id}: clone failed\n${c.stderr}`)
        continue
      }
      if (isChanged && prev) changed.push(src.id)
    }
    lock[src.id] = {sha: latest, ref: src.ref, repo: src.repo, fetchedAt: new Date().toISOString()}
    summary.push({id: src.id, status: isChanged ? (prev ? 'updated' : 'new') : 'unchanged', sha: latest.slice(0, 10)})
    console.log(`${isChanged ? '↻' : '✓'} ${src.id}: ${latest.slice(0, 10)} (${isChanged ? 'changed' : 'unchanged'})`)
  }

  writeJson(LOCK, lock)
  console.log(`\nChanged sources: ${changed.length ? changed.join(', ') : 'none'}`)
  // Emit for CI consumption (GitHub Actions step output).
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed.join(',')}\n`)
  }
}

main()
