[weekly-image]: https://img.shields.io/github/actions/workflow/status/extension-js/corpus/weekly-qa.yml?branch=main&label=Weekly%20QA
[weekly-url]: https://github.com/extension-js/corpus/actions/workflows/weekly-qa.yml
[smoke-image]: https://img.shields.io/github/actions/workflow/status/extension-js/corpus/smoke.yml?branch=main&label=Smoke
[smoke-url]: https://github.com/extension-js/corpus/actions/workflows/smoke.yml

# Corpus [![Weekly QA][weekly-image]][weekly-url] [![Smoke][smoke-image]][smoke-url]

> Real browser extensions, built with every [Extension.js](https://github.com/extension-js/extension.js) release before it ships.

This repository holds 532 extension samples from ten upstream sources and the harness that builds them. A run takes one exact Extension.js version from npm, builds every buildable sample on Chrome, Firefox, Edge and Safari, and answers `CLEAN` or `NOT CLEAN`.

```
✅ CLEAN · 4.1.39
Framework health: 240/240 buildable samples pass (100.0%) · 4 skipped (sample-side/upstream)
```

[Extension.js](https://github.com/extension-js/extension.js) · [Templates](https://github.com/extension-js/templates) · [Documentation](https://extension.js.org/docs) · [Release process](https://github.com/extension-js/extension.js/blob/main/docs/RELEASING.md)

## What is in it

| Folder | Source | Samples |
| :----- | :----- | ------: |
| [`chrome/`](chrome) | [GoogleChrome/chrome-extensions-samples](https://github.com/GoogleChrome/chrome-extensions-samples), plus retired MV2 samples under `_archive/` | 302 |
| [`chromium/`](chromium) | Chromium test extensions, a frozen subset that includes broken manifests on purpose | 87 |
| [`mdn/`](mdn) | [mdn/webextensions-examples](https://github.com/mdn/webextensions-examples) | 71 |
| [`extension.js/`](extension.js) | Extension.js first-party examples | 60 |
| [`wpt/`](wpt) | [web-platform-tests/wpt](https://github.com/web-platform-tests/wpt), the test extensions under `web-extensions/resources/` | 6 |
| [`webextension-demos/`](webextension-demos) | [dotproto/webextension-demos](https://github.com/dotproto/webextension-demos) | 2 |
| [`vimium/`](vimium) | [philc/vimium](https://github.com/philc/vimium), report-only | 1 |
| [`privacy-badger/`](privacy-badger) | [EFForg/privacybadger](https://github.com/EFForg/privacybadger), report-only | 1 |
| [`keepassxc-browser/`](keepassxc-browser) | [keepassxreboot/keepassxc-browser](https://github.com/keepassxreboot/keepassxc-browser), report-only | 1 |
| [`multi-account-containers/`](multi-account-containers) | [mozilla/multi-account-containers](https://github.com/mozilla/multi-account-containers), report-only | 1 |

Each folder is a copy of its source at one pinned commit. `VENDORED.json` in the folder records the source repository, that commit and a hash of the tree. Every run recomputes the hash, so a sample edited by hand fails the run.

Of the 532 samples, 248 are in the build matrix. The rest are kept as data: archived samples and manifests that are invalid by design. Four of the 248 are the report-only extensions described below. Four more cannot build for reasons of their own, such as a manifest that points at output the sample's own bundler must produce first. They are listed in [`skips.json`](skips.json) with the reason and the date each was last verified. That leaves 240 buildable samples, and a failure in any of them is an Extension.js defect.

Five sources are real extensions that a run builds and only reports. Their result is printed under the verdict and never changes it. Four of them load from source with no build step and are small enough to vendor, so every run builds them, the release gate included: Vimium, Privacy Badger, KeePassXC-Browser and Firefox Multi-Account Containers. The fifth, the release builds of [uBlock Origin Lite](https://github.com/uBlockOrigin/uBOL-home), is about 65 MB and is not vendored, so only Weekly QA builds it. A report-only sample that fails is a finding to read, with its report under [`bug-reports/`](bug-reports) when the cause is Extension.js.

## Browsers

<div align="center">

| <img alt="Chrome" src="https://media.extension.land/logos/browsers/chrome.svg" width="70"> | <img alt="Edge" src="https://media.extension.land/logos/browsers/edge.svg" width="70"> | <img alt="Firefox" src="https://media.extension.land/logos/browsers/firefox.svg" width="70"> | <img alt="Safari" src="https://media.extension.land/logos/browsers/safari.svg" width="70"> |
| :-: | :-: | :-: | :-: |
| <sup>Google Chrome<br>✅ Every release</sup> | <sup>Microsoft Edge<br>✅ Every release</sup> | <sup>Mozilla Firefox<br>✅ Every release</sup> | <sup>Apple Safari<br>✅ Every release</sup> |

</div>

Every sample is built once per browser. Safari builds go through the converter and Xcode on a macOS runner, and nothing opens Safari: the corpus proves the build, not the run.

## What a run checks

1. The vendored folders match their recorded hashes.
2. Each sample builds in its own throwaway workspace, once per browser.
3. Every file the emitted `manifest.json` names exists in the output. A build that exits 0 and drops an icon is a failure.
4. The result is compared with [`baseline.json`](baseline.json), or [`baseline.safari.json`](baseline.safari.json) on macOS, the last accepted run of a stable version. A failing sample is built again before it counts, so a flaky runner is not reported as a regression.

## When it runs

| Workflow | Scope | Effect |
| :------- | :---- | :----- |
| [Corpus gate](.github/workflows/corpus-gate.yml) | All 240 samples on Chrome, Firefox, Edge and Safari, at the commit the release pins, plus the four vendored report-only extensions | A stable Extension.js release does not publish unless the canary built from the same commit is `CLEAN`. Every release is then read again with the exact version that reached npm |
| [Weekly QA](.github/workflows/weekly-qa.yml) | All samples at the latest upstream commits, against `extension@latest`, with Safari on a macOS lane | Opens an issue for a regression that survives a second build |
| [Smoke](.github/workflows/smoke.yml) | 12 samples on Chrome and Firefox, on every push and pull request | Guards the harness itself |

Run the gate by hand for any version on npm:

```bash
gh workflow run corpus-gate.yml --repo extension-js/corpus -f cli-version=4.1.40-canary.458.001a6a0 -f safari=true
```

## Run it locally

```bash
npm run smoke    # 12 vendored samples, a few minutes
npm run qa       # sync upstream, discover, build everything, report, verdict
npm run status   # print the last verdict
```

| Setting | CLI under test |
| :------ | :------------- |
| _(default)_ | `extension@latest` |
| `EXTENSION_TAG=4.1.40-canary.458.001a6a0` | That exact version or dist-tag from npm |
| `EXTENSION_CLI_PATH=/abs/path/cli.cjs` | A local, unreleased build |

Scope a run with `node scripts/run-matrix.mjs --source mdn --browsers chrome,firefox --limit 20`. Safari builds through Xcode and runs on macOS only.

## Use the samples in your own tests

Read [`catalog.json`](catalog.json) instead of searching for `manifest.json`. It lists every sample with its folder, manifest path, manifest version, API namespace (`chrome.*` or `browser.*`), entry points and whether it has a build step.

## Refresh the corpus

A refresh is a reviewed commit, never automatic.

```bash
npm run qa                  # build the latest upstream commits
npm run status              # must be CLEAN
npm run vendor              # copy the validated snapshot into the tracked folders
npm run discover:vendored   # regenerate catalog.json
npm run baseline:update     # accept the run as the new baseline
```

To add a source, add one entry to [`sources.json`](sources.json) with its repository, the folders to scan and the tracked folder to vendor into. No code changes are needed. Check the license first: a source joins only when its license allows a redistributed copy, and the entry records the SPDX id. Set `sparse: true` for a repository far larger than its samples, `submodules: true` for one that keeps part of the extension in a submodule, and `gate: false` for a source that is reported and never decides the verdict. A real extension joins as report-only, and a source over 20 MB is not vendored. `node scripts/sync.mjs --source <id>` fetches one source and leaves the other pins alone.

## License

MIT for the harness. The vendored samples keep the license of their source.
