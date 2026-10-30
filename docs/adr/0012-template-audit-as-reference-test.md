# The template audit is the reference test

**Status:** accepted (2026-10-30)

Unit tests cannot use real templates ([ADR-0002](0002-no-game-content-in-app-or-repo.md)). Thus `scripts/audit-templates.ts` is the test against real data. For each template, it reports the guide layers, the warnings, the PSD features, the region coverage, and a comparison of our compositor with the composite image saved by Photoshop (same visibility).

Reference result (October 2026, 60 templates): all guide layers found, 5 region layers each, at most 0.41 % of pixels with a difference above 16 levels, mean difference 0.09.

## How to run it

```sh
npm run audit:build          # makes out/audit/audit-templates.cjs (one file, no dependencies)
node out/audit/audit-templates.cjs <folder or .psd> [--json report.json] [--dump folder] [--no-compare]
```

On a Windows PC without Node.js, use the packaged app as the interpreter: set `ELECTRON_RUN_AS_NODE=1`, then run `"LMU Livery Editor.exe" audit-templates.cjs <folder>`. A full run takes about 5 minutes and up to 2.5 GB of RAM. `--dump` writes raw RGBA files; convert them with `magick -size 4096x4096 -depth 8 rgba:file.rgba file.png`.
