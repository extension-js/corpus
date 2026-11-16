# Bug 08: a `manifest.json` that carries comments is refused

**CLI:** reproduced on `extension@4.1.41`
**Severity:** medium: a real extension that Chrome loads from source does not build at all
**Status:** 🔴 OPEN on `extension@4.1.41` (2026-11-16)

## What happens

`extension build` reads `manifest.json` with a strict JSON parser and stops on
the first comment, for every browser target:

```
⏵⏵⏵ Couldn't parse manifest.json as JSON.
PATH <sample>/manifest.json
REASON Expected double-quoted property name in JSON at position 87 (line 5 column 3)
Fix the syntax error, then run the command again.
⏵⏵⏵ Build failed with 1 error.
```

On the report-only sample `vimium` (`philc/vimium` at `4046615ae4`) the same
refusal reads `REASON Expected ',' or '}' after property value in JSON at
position 436 (line 15 column 5)`, and the sample fails on chrome and firefox.

## Why it matters

Chrome and Firefox both load a `manifest.json` that carries `//` comments.
Vimium keeps 20 comment lines in the manifest at its repository root, and
its contributing guide tells people to load that folder unpacked. The Chrome
Web Store is the one place that rejects comments, which is why Vimium's own
packaging script parses the file leniently and writes plain JSON. A build tool
is in the same position: read what the browser reads, emit plain JSON.

With the comments removed and nothing else changed, the same tree builds on
chrome and firefox with `4.1.41`, and all 18 files its emitted manifest names
exist in the output.

## Repro

```
bug-reports/repro/08-manifest-with-comments
```

```sh
cp -R bug-reports/repro/08-manifest-with-comments /tmp/t08 && cd /tmp/t08
EXTENSION_SKIP_INSTALL=1 npx -y extension@4.1.41 build --browser chrome --silent
# exit 1: Couldn't parse manifest.json as JSON
EXTENSION_SKIP_INSTALL=1 npx -y extension@4.1.41 build --browser firefox --silent
# exit 1, same message
```

The full sample: `node scripts/run-matrix.mjs --only vimium --browsers chrome,firefox`
after `node scripts/discover.mjs --vendored`.

## Suggested fix

Strip `//` and `/* */` comments outside strings before parsing the source
manifest, and keep emitting plain JSON. `scripts/lib/util.mjs` does this for
discovery in one expression (`stripJsonComments`).

## Corpus evidence

- Local run, 2026-11-16, `extension@4.1.41`, vendored samples, chrome and
  firefox: 240 of 240 gating samples pass, report-only 3 of 4, the one failure
  is `vimium` on both targets with the message above.
