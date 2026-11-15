# QA Findings

## Current reading (2026-11-15)

**CLI:** `extension@4.1.39` · **Platform:** macOS (local run of the gate's steps) · **Targets:** chrome, firefox, edge
**Corpus:** 244 discovered samples, 240 attempted, 4 skipped (sample-side/upstream)
**Run:** local, vendored samples, `tier=all --install`, concurrency 6, criteria `a45441489280`

**240 / 240 (100%) build cleanly**, 720 builds, no failure and no timeout on
any target. Every passing build had its emitted manifest checked against
`dist/` (2,892 referenced files, none missing).

Two sources joined, eight samples, and nothing else moved:

- `wpt`, the six test extensions under `web-extensions/resources/` of
  web-platform-tests (BSD-3-Clause), pinned at `4fc3e21bbb`. Each declares
  `background.scripts` and `background.service_worker` side by side.
- `webextension-demos`, two samples from `dotproto/webextension-demos` (MIT),
  pinned at `52bbea7d92`. One pairs `background.page` with a service worker
  and `sidebar_action` with `side_panel`.

The skip list did not change, so the criteria hash is the same and the run
was diffed against the 2026-11-14 baseline before it replaced it: no
regression, eight new samples. The other vendored folders stay at the cut
that reading validated. `extension-js/examples` has moved since, and that
refresh is its own commit.

Safari was not built for the eight new samples in this reading. The macOS
lanes are the first to build them, and `baseline.safari.json` is unchanged.

## Earlier reading (2026-11-14)

**CLI:** `extension@4.1.39` · **Platform:** macOS (local run of the Linux lane's steps) · **Targets:** chrome, firefox, edge
**Corpus:** 236 discovered samples, 232 attempted, 4 skipped (sample-side/upstream)
**Run:** local, `tier=all --install`, concurrency 6, criteria `a45441489280`

**232 / 232 (100%) build cleanly**, 696 builds, no failure and no timeout on
any target. Every passing build had its emitted manifest checked against
`dist/` (2,855 referenced files, none missing).

The corpus moved since the last reading because the three upstreams moved.
`sources.lock.json` now pins `mdn` at `4b8c5825f9`, `chrome` at `657a941658`
and `extensionjs` at `954d00c85c`. Against the 4.0.29 baseline the run adds
25 samples and drops 16: the Extension.js examples renamed their `new-*`
family to `newtab-*`, replaced `sidebar-monorepo-turbopack` with
`sidebar-monorepo-nx`, and added seven `devtools*` examples and
`sidebar-monorepo-turborepo`. MDN added `script-on-click`. The tracked sample
directories still hold the earlier vendored cut.

The skip list went from nine to four on 2026-11-04, when five samples that
build on `4.1.38` re-entered the matrix. That changes the scoring criteria
(`e394f331798b` to `a45441489280`), so this run re-pins `baseline.json`
instead of diffing against it. The four standing skips were rebuilt the same
day with `--no-skips` and all four still fail on all three targets for the
reason `skips.json` records.

Two notes on how to read it:

- The baseline was frozen from a macOS run. Verdicts on the three targets
  have matched across platforms on every earlier reading, and the next weekly
  Linux run is the check that they still do.
- The asset check used to look for `dist/<browser>` at the staged sample root
  only. The two workspace examples (`sidebar-monorepo-nx`,
  `sidebar-monorepo-turborepo`) emit under `packages/extension/dist`, so their
  builds passed without being checked. The check now follows the manifest's
  project, and each result records `assetsChecked` so an unchecked pass is
  visible.

Timing on a 10-core machine under heavy unrelated load (1-minute load average
24 to 54): the matrix took 5 min 14 s on the first pass and 8 min 10 s on the
second, the median build 2.2 s and 3.6 s. Sync, the corpus check and discover
took 13 s together.

## Earlier reading (2026-08-04)

**CLI:** `extension@4.0.29` · **Platform:** Linux + macOS · **Targets:** chrome, firefox, edge
**Corpus:** 227 discovered samples, 218 attempted, 9 skipped (sample-side/upstream)
**Run:** [30915868576](https://github.com/extension-js/corpus/actions/runs/30915868576), `tier=all --install`, both lanes green

**218 / 218 (100%) build cleanly.** `4.0.29` (released 2026-08-04) closed
[bug 07](bug-reports/07-theme-named-css-colors-rejected.md): named CSS colors
in `theme.colors` now convert to Chromium's integer arrays the way hex already
did, so `mdn/themes/temp` builds on all three targets and the Weekly QA badge
is green on the whole corpus for the first time.

### The reading it supersedes (earlier the same day)

`extension@4.0.28` on run
[30912374327](https://github.com/extension-js/corpus/actions/runs/30912374327)
read **217 / 218 (99.5%)**, Firefox 218 / 218. The one failure was
`mdn/themes/temp` on Chrome and Edge, confirmed twice by re-run: the sample
declares `theme.colors.*` as **named** CSS colors (`"blue"`, `"black"`) and the
build refuses them for Chromium targets. `4.0.28` fixed the hex-string refusal
that `4.0.27` shipped on 2026-08-02 (that one took down all five hex-carrying
`mdn/themes/*` samples in the 2026-08-03 reading, 213/218 on run
[30819326430](https://github.com/extension-js/corpus/actions/runs/30819326430));
named colors wanted the same conversion. Filed as
[bug 07](bug-reports/07-theme-named-css-colors-rejected.md) with a pristine
repro the same morning; the fix shipped in `4.0.29` that afternoon and the
badge went red-to-green on the rerun above.

Read the ten days before 2026-08-03 as no reading at all. Both lanes pinned
`node-version: 20` while the CLI declares `engines.node >= 22.12`, so from
2026-07-24 every sample failed with the same engine refusal and the report said
`0/218` and `212 confirmed regressions`. Nothing about the framework was measured.
Fixed in `d7df161`, and `scripts/assert-runtime-supported.mjs` now refuses the
lane before the matrix runs rather than after it produces a corpus-shaped lie.

The counts below are the first full run and are kept as the historical baseline.
They describe `extension@3.18.4` against a 221-sample corpus and are not the
current state.

## First full run (historical, `extension@3.18.4`)

**CLI:** `extension@3.18.4` · **Platform:** macOS · **Targets:** chrome, firefox, edge
**Corpus:** 221 samples (MDN 70 · Chrome 99 · Extension.js 52)

## Headline

**208 / 221 (94%) build cleanly** on all three browsers. Verdicts are identical
across chrome/firefox/edge: the 13 failures are source/config issues, not
browser-specific. This is the baseline the weekly job gates against.

> The committed baseline is **macOS-captured**. The gating CI lane runs on Linux
> (case-sensitive FS), so the first Linux run should be reviewed and re-baselined
> there: some `url()`/path failures below may differ.

### Update: canary re-validation (2026-06-18)

Re-ran the 13 failures on `extension@3.18.4-canary.320.767e107` (Extension.js fixes for
[bug 02](bug-reports/02-popup-top-level-await-not-treated-as-module.md) + vendored-min.js
passthrough). Corpus moves **208 → 210 / 221**: `tutorial.tabs-manager` and
`api-samples/sandbox` now build. Triage of the 11 still failing:

- **2 new framework bugs** (still open on canary) → fixing them recovers 2 more, reaching 212/221:
  [bug 03](bug-reports/03-theme-additional-backgrounds-array.md) (theme `additional_backgrounds`
  array crash) and [bug 04](bug-reports/04-chrome-extension-url-scheme-passthrough.md)
  (`chrome-extension://` URL not passed through in CSS).
- **1 corrupt-upstream** polyfill (`mocha-client-tests`: builds with the genuine file).
- **8 sample-side**: 4 reference pre-built `dist/` output (`store-collected-images`,
  `webpack-modules`, `ai.gemini-in-the-cloud`, `libraries-xhr-in-sw`); 4 missing
  source/asset files (`menu-demo`, `top-sites`, `fontSettings`, `sample.bookmarks`).

See `bug-reports/README.md` → "Open for the next canary" for the action list.

### Update: second canary `3.18.4-canary.321.403955d` (all 4 fixes)

Full 221 × {chrome,firefox,edge} corpus run, diffed against the `3.18.4` baseline:

- **212 / 221 pass · 0 regressions · 4 progressions.** The fixes introduced **no new
  errors**: notably the Bug 02 ESM change (now builds *every* page script as a module)
  broke nothing previously passing.
- Progressions are exactly the 4 filed bugs: `weta_mirror` (03), `sandbox` + `tabs-manager`
  (02), `custom-cursor` (04).
- The remaining **9 are all non-framework** (verified, no unknowns): 8 sample-side
  (4 pre-built `dist/` refs, 4 missing source/asset files) + 1 corrupt-upstream polyfill.

**Caveat: Bug 03 passes the build but the output is incomplete.** On this canary the
theme manifest references `theme/images/weta.png` + `weta-left.png` but the files are
**not emitted** to `dist/`. The crash is fixed; the array-image emission still needs
`browser-extension-manifest-fields@2.2.5` published + a dep bump + a fresh canary.

### Testbed blind spot to close (next)

The matrix scores on build exit code, so Bug 03 reads as PASS despite dropping declared
assets. Add an **asset-integrity check** to `run-matrix`: after a passing build, assert
every file referenced by the emitted `manifest.json` (icons, theme images, web-accessible
resources, HTML/script srcs) exists in `dist/`. Downgrade to `fail:missing-assets` otherwise.

## Failure taxonomy (13)

### A. Manifest references pre-built artifacts (5): *sample expects its own bundler*
These samples ship a manifest pointing at `dist/*.js`; Extension.js reads source
paths and the built files don't exist until the sample's own webpack runs.
- `mdn/store-collected-images/webextension-with-webpack/extension` → `dist/background.js`
- `mdn/webpack-modules/addon` → `popup/index.js`
- `chrome/functional-samples/ai.gemini-in-the-cloud` → `dist/sidepanel.bundle.js`
- `chrome/functional-samples/libraries-xhr-in-sw` → `dist/chrome/sidepanel/script.js`
- `mdn/menu-demo` → `sidebar/panel.css` (missing source)

*Likely legitimate skips, not Extension.js bugs. Candidate for a `known-fail` reason.*

### B. CSS `url()` asset resolution (3): *needs Extension.js triage*
Third-party CSS referencing images/fonts Extension.js can't resolve at build:
- `chrome/api-samples/fontSettings/fontSettings Advanced` → `../images/slider/*.png`
- `chrome/functional-samples/sample.bookmarks` → jquery-ui `images/ui-icons_*.png`
- `mdn/top-sites` → bootstrap glyphicon font faces

### C. Extension.js content-script wrapper breaks valid JS (2): *likely Extension.js bug*
The framework's reinjection wrapper (`__EXTENSIONJS_REINJECT_GENERATION` /
`feature-scripts-content-script-wrapper`) throws a Syntax Error on these inputs:
- `mdn/mocha-client-tests/addon`
- `chrome/functional-samples/tutorial.tabs-manager`

### D. Other (3)
- `mdn/themes/weta_mirror`: theme-only manifest; `buildCanonicalManifest` errors (no entrypoints).
- `chrome/functional-samples/tutorial.custom-cursor`: `chrome-extension:` URI scheme unhandled by plugins.
- `chrome/api-samples/sandbox/sandbox`: vendored CommonJS `require.main === module` in a bundled file.

## Recommended next actions
1. File B + C with Extension.js (real framework gaps; minimal repros available per sample).
2. Tag A as `known-fail: references-prebuilt-artifacts` so they don't read as regressions.
3. Re-baseline on the Linux CI runner; keep this macOS run as the local reference.
