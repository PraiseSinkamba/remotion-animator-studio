# Element repair final integration verification — 2026-11-02

Requirement IDs: EL-01…EL-10; EM-001…EM-009, OB-002/004/008/010/012/015, CH-007.
Scenario: SC-01 **manipulation subset**, using clearly labelled synthetic data. This does not
claim complete future manual OHLC/import/archive/SMT/MTF workflows.

## Executed final gates

Windows 10, Node 24.20.0, installed HeadlessChrome 157.0.8080.0, Vite 5.4.21 and Remotion
4.0.538. Commands ran from the repository root. Logs/artifacts are reproducible under
`out/element-repair/`; [browser results](element-repair-browser-results.json) are retained here.
All final commands below exited **0**, and their output was inspected:

| Command | Observed final result |
|---|---|
| `node node_modules/vitest/vitest.mjs run` | 36 files, **569 tests passed**, 36.91s. |
| `node C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs typecheck` | **6 successful / 6 total**, 4 cached, 24.817s. |
| Same pnpm prefix, `build` | Studio production build passed; one build task, 66.571s; 2380 modules. |
| `node scripts/verify-element-repair.mjs` | Actual app/browser workflow and strict geometry/raster assertions passed; screenshots + five preview/export frame pairs. |
| `node scripts/verify-r1.mjs` | Six Main stills (0/20/45/100/140/179), three AuthoredPath stills (45/100/179), complete 240-frame 1920×1080 30fps H.264 MP4, **212,711 bytes**. |
| `git diff --check` | Exit 0; CRLF normalization notices only. |

No lint script exists; no lint pass is claimed. Initial sandbox Vitest failed with pnpm symlink
`realpath` EPERM (no tests ran); the same command outside the sandbox produced the passing
results above. Build emitted existing third-party PURE annotation and >500kB chunk warnings.

## Actual browser coverage and comparison

The script starts Vite with the app's config and installed Remotion Chromium. Canonical Vite
source imports reach normal production store commands; there is no production global testing
API. Trusted CDP `Input.dispatchMouseEvent` events perform body and corner drags. Test-only
stage sizing/pixel alignment gives one display pixel per composition pixel for raster checks.

- Synthetic chart, title, rectangle, arrow and safe static HTML fixture; 34 registered definitions,
  **32 scene-object types / 30 canvas-capable**, plus two explicitly non-canvas transitions.
- Rectangle moves from x=200 to x≈400 beyond its old bounds; old position misses after deselect;
  new position reselects. Corner resize changes width; unchanged click adds no drag history;
  changed move has one entry, with undo/redo restoring dimensions.
- Grouping + locking the arrow leaves its props unchanged during trusted unlocked-member drag.
- Rotation + perspective: trusted selection and displayed-pose body drag succeed. Browser root
  geometry agrees with pure projected geometry at **10/25/59/25**, tolerance **1 composition px**;
  observed errors below **0.0001px**, including reverse seek.
- Frame 60 removes the rectangle DOM and selected grips at its half-open out boundary. Frame 0
  has a singular flip pose. Unit tests additionally cover from−1/from/out−1/out, hidden/locked
  grips, cancellation/capture loss, invalid batches and 0.25/1/4 fitted scales.
- Actual app autosave followed by page reload restores the complete edited project by deep
  equality. The **observed UI tooltip says `SQLite (OPFS) — stored in this browser`**; isolation
  and OPFS are available. This is actual durable save/reopen, not an inferred fallback claim.
- Actual preview screenshots vs exported PNGs of that same final project at **0/10/25/59/60**:
  magenta rectangle raster bounds match **exactly** at 10/25/59 (asserted tolerance <3px); both
  are absent at singular frame 0 and inactive frame 60. This is geometric raster parity, not
  byte-identical whole-frame pixels.
- Chart-label crop `(532,214,260,24)` mean absolute RGB-channel error is **2.528098/255** at
  0/10/25/59, **0** at 60; assertion threshold **<3/255**, no tolerance relaxation. Text raster
  antialiasing differs slightly. This crop is the chart heading, not every chart pixel/axis label.
- The actual scene DOM cloned into an iframe with **no editor CSS** keeps chart wrapper 360×240,
  rectangle wrapper within 0.00004px, and identical computed `Arial, sans-serif` chart typography.
  Unstyled safe HTML h1/list/li/pre/code computed font/size/weight/line-height/margin/padding/list
  markers also match. Inline authored styles remain stronger than adapter baseline CSS.

Editor handles are separate from MainComposition. Export PNGs were visually inspected without
editor overlays. This is not a full per-pixel diff of all catalogue components or an all-HTML
layout guarantee. No real-market claims are made.

## Artifacts inspected

`out/element-repair/01-moved-reselected.png`, `02-rotated-projected-selection.png`,
`03-out-boundary.png`, `04-saved-storage-backend.png`, `preview-{0,10,25,59,60}.png`,
`export-{0,10,25,59,60}.png`, `project.json`, `evidence.json`, `browser-run.log` and gate logs.
Screenshot 02 is before the final posed drag; the corresponding parity pair is preview-25 and
export-25, captured after that drag/save/reopen. Main frame-0045 and AuthoredPath frame-0100
were opened and visually inspected. `out/chart-studio-r1.mp4` is the completed actual render;
its visual inspection here uses representative rendered stills, not a manual full playback.

## Integration failures corrected

1. Actual Remotion bundle failed resolving `./element-pose.js` against source TypeScript.
   Shared `packages/video/tools/bundle.mjs` adds Webpack extension aliases, used by server,
   CLI and both verification scripts; package `.js` import conventions remain intact.
2. Actual authored fixture failed strict validation because current-schema clocks carried
   `framesPerBar` instead of `framesPerStep`. A new fixture-boundary test failed 1/7 before
   correction and passed 7/7 after. Correcting both clock fields preserves effective 15-frame pace.
3. Actual visual inspection found inherited chart typography and SVG baseline differences.
   Composition now owns Arial/line-height and narrowly scoped SVG/img/video display defaults.
   New composition regression failed before the font fix. Explicit component fonts still win.
4. No-editor-CSS measurement exposed stage border shrink: outer 960×540 but Player fit inner
   958×538. An inset outline preserves chrome without changing canvas content dimensions.
5. Catalogue browser assertion failed 32 canvas vs expected30. Explicit transition render mode
   and registry regression exclude crossfade/wipe from content fallback without kind branches.
6. HTML browser clone assertion failed on preflight-vs-UA heading/list/code styles. HtmlAdapter
   owns those supported semantic defaults; sanitization and authored source are unchanged.

Earlier harness-only failures (CDP screenshot result envelope, canonical module identity and
initial workspace-restore readiness) were corrected without changing product behavior or
weakening assertions. The original defect diagnostics were retired in favor of the permanent
[regression guide](element-system.md); the historical review retains its findings and closure map.

## Bundle, contracts and limits

Final app JS: **1,351.22kB / 417.11kB gzip**; CSS: **66.31kB / 11.19kB gzip**. SQLite worker
233.83kB, SQLite WASM 879.08kB (Vite decimal kB). A separate production `write:false` Rollup
measurement retained 14 parse5 modules with **274,350 rendered source bytes** and 3 entities
modules with **66,109**. These are pre-minification module rendered lengths, **not** isolated
minified/gzip marginal dependency costs. Exact measurement command/log is in the task report
and `out/element-repair/parser-build.log`; no dependency-free baseline was built.

No new dependencies/licenses in Task5; Task4 adopted exact MIT parse5@7.3.0. No SQLite/project/
archive schema migration; only the current verification fixture's invalid clock metadata changed.
Core adds explicit transition render mode, components own safe HTML baseline layout, video owns
bundler/scene defaults, studio owns stage chrome. The mistakenly tracked Task4 scratch report is
now [durable validation evidence](task-4-validation-report.md); ignored working copy remains.

Legacy `ComponentProps`/adapters still have compatibility any types; runtime validators are now
installed but this is not a full static typing rewrite. Validators retain unknown extensions and
check known fields. Static HTML is deliberately narrow; no vulnerability audit was run. Camera
projection remains a planar model, not a separate 3D engine. Browser coverage is one installed
Windows Chromium, not Safari/Firefox/mobile/codec/storage-failure coverage. Final broad
independent review remains controller-owned. No complete future creator release gate is claimed.

## Final review fix wave — 2026-11-02

The final review's lock, validation and arrow findings were addressed in the subsequent fix wave.
User mutations filter locked members from mixed clip selections; destructive track removal and layer
swaps involving locked clips are rejected; chart-group relayout is rejected when a member is locked.
Project settings and edits through an unlocked chart can still affect derived appearance or shared data.
The common inspector and effect controls record a snapshot only on the first accepted change in a
focus/drag gesture; custom controls retain their own history policies. Tests cover locked deletion,
layer movement, grouping, path completion, drawing updates and actual inspector/effect undo.

Known effect names, supplied parameter types/options and render-sensitive frame/spring constraints
are checked at migration and edit boundaries, while allowed extension fields survive. Counter
precision uses the JavaScript `toFixed` integer range 0–100. Shape point counts respect the installed
Remotion helper and JavaScript array preconditions; pie progress is clamped by the helper and finite
star inner radii remain supported. Shared arrow head and stroke geometry supplies both SVG rendering
and generic editor picking; coincident endpoints render as a diamond.

The isolated browser verifier exited 0 after idempotent test-only stage alignment. It measured stage
origin (338,134) at all sampled frames, non-null visible rectangle bounds at 10/25/59, and chart-label
mean RGB error 2.528098/255 at frames 0/10/25/59 and 0 at 60, retaining the original <3 threshold.
An earlier run while source changed failed that threshold at 6.689850/255 and is superseded. The
updated [browser results](element-repair-browser-results.json) contain the actual frame measurements.
These observations remain limited to the synthetic fixture, rectangle geometry and chart-label crop;
they do not claim whole-frame or all-catalogue pixel parity.

Final frozen-source gates: full Vitest **37 files / 582 tests**, six typechecks **6/6**, and
production build **1/1** all exited 0. The real R1 verifier exited 0 after producing six Main
stills, three AuthoredPath stills, and the 240-frame H.264 MP4 (212,711 bytes). Main frame 45 and
browser preview frame 25 were inspected. Build retained the existing third-party PURE-annotation
and large-chunk warnings. No lint script is available.
