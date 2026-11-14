# Bug 07: named CSS colors in `theme.colors` rejected for Chromium targets

**CLI:** reproduced on `extension@4.0.28`
**Severity:** low: blocks Firefox-style themes that use named colors when built for chrome/edge
**Status:** 🟢 FIXED in `extension@4.0.29`, `mdn/themes/temp` builds on chrome, firefox and edge on `4.1.39` (2026-11-14)

## What happens

`4.0.27` refused every `theme.colors` value that was not an `[R, G, B]` array,
which failed five of the six MDN theme samples on chrome and edge (hex strings
like `"#ffffff"`). `4.0.28` fixed the hex case: hex strings are now accepted and
the four hex-only themes build again. But the same validator still rejects
**named CSS colors** (`"blue"`, `"black"`), so `mdn/themes/temp`, which uses
only named colors, keeps failing on chrome and edge while building clean on
firefox. It is the one remaining framework failure in the corpus (217/218).

```
⏵⏵⏵ Build error in manifest.json.
    × Check the theme.colors.frame field in your manifest.json file.
    │ Chrome only accepts an [R, G, B] or [R, G, B, A] array here.
    │ Chrome rejects the whole extension when this value is malformed.
    │ The build stops here to protect you.
    │
    │ INVALID VALUE "blue"

⏵⏵⏵ Build failed with 11 errors.
```

## Why it matters

MDN's own theme documentation and examples use CSS color strings; Firefox
accepts any CSS color in `theme.colors`. Real-world cross-browser themes
therefore carry named colors, and the framework's job (as with hex in `4.0.28`)
is to convert them for the Chromium target, not to refuse the build.

## Repro

Self-contained copy (the `mdn/themes/temp` manifest, named colors only):

```
bug-reports/repro/07-theme-named-css-colors
```

```sh
cp -R bug-reports/repro/07-theme-named-css-colors /tmp/t07 && cd /tmp/t07
EXTENSION_SKIP_INSTALL=1 npx -y extension@4.0.28 build --browser chrome --silent
# exit 1: 11 errors, one per theme.colors key, INVALID VALUE "blue" / "black"
EXTENSION_SKIP_INSTALL=1 npx -y extension@4.0.28 build --browser firefox --silent
# exit 0
```

Contrast: the hex-string case is fixed, so `mdn/themes/animated`
(`"#ffffff"`, `"#000"`) builds clean for chrome on `4.0.28` and failed the same
way on `4.0.27`.

## Suggested fix

Extend the `theme.colors` normalization that `4.0.28` introduced for hex so it
parses the full CSS `<color>` grammar (named colors at minimum, ideally
`rgb()`/`rgba()`/`hsl()` too) and emits the `[R, G, B]` / `[R, G, B, A]` array
for Chromium targets. Firefox output should keep the author's value verbatim.

## Corpus evidence

- Weekly QA run [30912374327](https://github.com/cezaraugusto/browser-extension-test-data/actions/runs/30912374327)
  (2026-08-04, `extension@4.0.28`): 217/218, single framework failure
  `mdn/themes/temp`, chrome:fail firefox:pass edge:fail, confirmed twice by re-run.
- Weekly QA run [30819326430](https://github.com/cezaraugusto/browser-extension-test-data/actions/runs/30819326430)
  (2026-08-03, `extension@4.0.27`): 213/218, all five theme failures including
  the hex-only samples.
