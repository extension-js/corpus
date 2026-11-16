#!/usr/bin/env node
// build-sources.mjs: build the real extensions that have no manifest to build
// from until their own bundler has run.
//
// A source with a `build` entry in sources.json is a foreign project. For each
// one this script:
//
//   1. fetches the one commit named by `commit` into .cache/<id> (gitignored)
//   2. refuses a lockfile that names anything outside the npm registry
//   3. runs `npm ci --ignore-scripts`, so no dependency runs code at install
//   4. runs `build.run`, the project's own build command, untouched
//   5. checks that every folder in `scan` now holds a manifest.json
//
// discover.mjs then lists those folders as samples and run-matrix.mjs builds
// them like any other. Nothing is copied into the tracked corpus and the
// project's source is never edited.
//
// Every one of these sources is report-only. A project that does not install or
// build is written to reports/builds.json, shows up as one failing report-only
// sample, and this script still exits 0: a foreign build never decides a verdict.
//
// The project's code runs only inside its clone, with a throwaway HOME under
// .cache/ and an environment that carries no token.
//
// Flags: --source id[,id]
import {ROOT, CACHE_DIR, REPORTS_DIR, enabledSources, exec, readJson, writeJson, ensureDir, fs, path} from './lib/util.mjs'

const LOCK = path.join(ROOT, 'sources.lock.json')
const REGISTRY = 'https://registry.npmjs.org/'
const INSTALL_TIMEOUT = Number(process.env.QA_INSTALL_TIMEOUT_MS || 600_000)
const BUILD_TIMEOUT = Number(process.env.QA_PROJECT_BUILD_TIMEOUT_MS || 900_000)
const ONLY = (() => {
  const i = process.argv.indexOf('--source')
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1].split(',') : null
})()

function tail(text, n = 600) {
  const t = (text || '').replace(/\x1b\[[0-9;]*m/g, '').trim()
  return t.length > n ? t.slice(-n) : t
}

// The foreign commands see a minimal environment: no token, no user npm config.
function foreignEnv() {
  const home = path.join(CACHE_DIR, '.home')
  ensureDir(home)
  const env = {PATH: process.env.PATH, HOME: home, CI: '1', npm_config_cache: path.join(home, '.npm')}
  for (const k of ['LANG', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot']) if (process.env[k]) env[k] = process.env[k]
  return env
}

// A branch head moves, so a foreign project is fetched by commit and nothing else.
function fetchCommit(src, dest) {
  if (!/^[0-9a-f]{40}$/.test(src.commit || '')) return {ok: false, stderr: '`commit` must be a full 40-character SHA'}
  fs.rmSync(dest, {recursive: true, force: true})
  ensureDir(dest)
  for (const args of [
    ['init', '-q'],
    ['remote', 'add', 'origin', src.repo],
    ['fetch', '-q', '--depth', '1', 'origin', src.commit],
    ['checkout', '-q', '--detach', 'FETCH_HEAD']
  ]) {
    const r = exec('git', args, {cwd: dest})
    if (!r.ok) return r
  }
  const head = exec('git', ['rev-parse', 'HEAD'], {cwd: dest})
  return head.stdout.trim() === src.commit ? head : {ok: false, stderr: `fetched ${head.stdout.trim()}, expected ${src.commit}`}
}

// Registry only: a git URL or a tarball from another host is code no lockfile
// hash was published for. Returns the offending entries.
function outsideRegistry(dir) {
  const file = path.join(dir, 'package-lock.json')
  if (!fs.existsSync(file)) return ['no package-lock.json']
  const lock = readJson(file)
  return Object.entries(lock.packages || {})
    .filter(([name, p]) => name && !p.link && p.resolved && !p.resolved.startsWith(REGISTRY))
    .map(([name, p]) => `${name} <- ${p.resolved}`)
}

function folderSize(dir) {
  let files = 0
  let bytes = 0
  for (const e of fs.readdirSync(dir, {withFileTypes: true, recursive: true})) {
    if (!e.isFile()) continue
    files++
    bytes += fs.statSync(path.join(e.parentPath, e.name)).size
  }
  return {files, bytes}
}

function buildOne(src) {
  const dest = path.join(CACHE_DIR, src.id)
  const row = {name: src.name, repo: src.repo, commit: src.commit, status: 'built', error: null}
  const stop = (status, r) => ({...row, status, error: tail(r.stderr || r.stdout || r.error || '')})

  const fetched = fetchCommit(src, dest)
  if (!fetched.ok) return stop('fetch-failed', fetched)

  const outside = outsideRegistry(dest)
  if (outside.length) return stop('refused', {stderr: `not installable from the registry alone: ${outside.slice(0, 5).join(', ')}`})

  // `allowScripts` is the one way to let install scripts run, and it must say why.
  const install = ['ci', '--no-audit', '--no-fund', ...(src.build.allowScripts ? [] : ['--ignore-scripts'])]
  if (src.build.allowScripts) console.log(`! ${src.id}: install scripts allowed: ${src.build.allowScripts}`)
  const env = foreignEnv()
  const i = exec('npm', install, {cwd: dest, env, timeout: INSTALL_TIMEOUT})
  row.installMs = i.ms
  if (!i.ok) return stop('install-failed', i)

  const [command, ...args] = src.build.run
  const b = exec(command, args, {cwd: dest, env, timeout: BUILD_TIMEOUT})
  row.buildMs = b.ms
  if (!b.ok) return stop('build-failed', b)

  row.outputs = {}
  for (const out of src.scan) {
    const abs = path.join(dest, out)
    if (!fs.existsSync(path.join(abs, 'manifest.json'))) return stop('no-output', {stderr: `${out}/manifest.json was not written`})
    row.outputs[out] = folderSize(abs)
  }
  return row
}

function main() {
  ensureDir(CACHE_DIR)
  const lock = readJson(LOCK, {})
  const sources = {}
  for (const src of enabledSources().filter((s) => s.build && (!ONLY || ONLY.includes(s.id)))) {
    const row = buildOne(src)
    sources[src.id] = row
    if (row.status === 'built') {
      lock[src.id] = {sha: src.commit, ref: src.ref, repo: src.repo, fetchedAt: lock[src.id]?.sha === src.commit ? lock[src.id].fetchedAt : new Date().toISOString()}
      const mb = (Object.values(row.outputs).reduce((n, o) => n + o.bytes, 0) / 1e6).toFixed(1)
      console.log(`✓ ${src.id}: ${src.commit.slice(0, 10)} install ${(row.installMs / 1000).toFixed(1)} s, build ${(row.buildMs / 1000).toFixed(1)} s, ${src.scan.length} output folder(s), ${mb} MB`)
    } else {
      console.log(`! ${src.id}: ${row.status} (reported, not gating)\n${row.error}`)
    }
  }
  writeJson(LOCK, lock)
  writeJson(path.join(REPORTS_DIR, 'builds.json'), {generatedAt: new Date().toISOString(), node: process.version, sources})

  if (process.env.GITHUB_STEP_SUMMARY) {
    const s = (ms) => (ms === undefined ? '' : `${(ms / 1000).toFixed(1)} s`)
    const md = [
      '## Built extensions',
      '',
      '| Source | Commit | Status | Install | Build |',
      '|---|---|---|---|---|',
      ...Object.entries(sources).map(([id, r]) => `| ${id} | \`${r.commit.slice(0, 10)}\` | ${r.status} | ${s(r.installMs)} | ${s(r.buildMs)} |`)
    ].join('\n')
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n\n')
  }
}

main()
