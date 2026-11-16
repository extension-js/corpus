# Bug 09: a file fetched at runtime is dropped with no warning

**CLI:** reproduced on `extension@4.1.41`
**Severity:** high for the extension it hits: the build exits 0, prints nothing, and the output cannot load its own data
**Status:** 🔴 OPEN on `extension@4.1.41` (2026-11-16)

## What happens

A service worker that fetches a packaged file by a relative path gets that
file copied into the output:

```js
const CONFIG = {local: '../config/sites.config'}
```

`dist/chrome/config/sites.config` is written. Add a second property that names
a remote copy of the same file through a template literal and the local file is
no longer written, on chrome and on firefox, with exit 0 and no `Runtime-risk`
warning:

```js
const CONFIG_URL_BASE = 'https://example.com/config'
const CONFIG = {remote: `${CONFIG_URL_BASE}/sites.config`, local: '../config/sites.config'}
```

```
dist/chrome/background/service_worker.js
dist/chrome/manifest.json
```

The emitted worker still holds `'../config/sites.config'`, so the fetch fails
at runtime.

## Why it matters

This is the shape Dark Reader uses for all six of its site lists
(`remote: \`${CONFIG_URL_BASE}/dark-sites.config\`, local: "../config/dark-sites.config"`).
Building Dark Reader's own release output (`darkreader/darkreader` at
`ad17337499`, folder `build/release/chrome-mv3`) with `extension build` exits 0
with no warning, and the output has no `config/` folder, 6 files. Two icons the worker sets at runtime
(`icons/dr_active_light_19.png`, `icons/dr_active_light_38.png`) are missing
the same way, and `ui/popup/index.html` is written without the `index.js` and
`style.css` beside it.

The corpus passes that sample, because the asset check reads only the files
the emitted manifest names. So this one is invisible to the verdict and was
found by comparing the input folder with the output folder by hand.

## Repro

```
bug-reports/repro/09-runtime-fetched-file-not-shipped
```

```sh
cp -R bug-reports/repro/09-runtime-fetched-file-not-shipped /tmp/t09 && cd /tmp/t09
EXTENSION_SKIP_INSTALL=1 npx -y extension@4.1.41 build --browser chrome --silent
# exit 0, no warning
ls dist/chrome/config
# No such file or directory
```

Delete the `remote:` property from `background/index.js`, build again, and
`dist/chrome/config/sites.config` exists.

## Suggested fix

Whatever decides that `'../config/sites.config'` is a packaged file should not
be undone by an unrelated template literal that ends in the same file name.
When a relative path literal in a worker resolves to a file that exists in the
project and is not in the output, either copy it or print the `Runtime-risk`
warning the build already prints for an icon path.

## Corpus evidence

- Local run, 2026-11-16, `extension@4.1.41`: `dark-reader/build/release/chrome-mv3`
  and `dark-reader/build/release/firefox` pass on chrome and firefox, and both
  outputs lack `config/`.
