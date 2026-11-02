# Task 2 report

Status: COMPLETE. Base `ac6b4bc`; final commit is recorded below after creation. Independent task
review and final whole-follow-up review remain controller responsibilities. Branch stays local.

## Requirement IDs

OB-003/005/006/011/012; EM-001/002/004/005/006; PR-003/010; CPT-005; EX-003.
SC-03 drawing manipulation subset, synthetic geometry only. No complete SC-03 creator/import/
archive workflow, SMT/MTF workflow or browser-side MP4 capability claim.

## Affected package contracts

No production package edits. Consumes Task 1 geometry/placement/composition context, shared
elementRegion/handleAt/pose, generic pointer handlers and store commands. Added
`scripts/verify-drawing-handles.mjs` using installed Vite/Remotion/CDP and shared bundleVideo.
The script imports canonical source modules for fixture setup/observation; actual manipulation
uses trusted CDP mouse input through the app. No production globals or added dependencies.

## Behavior and edge cases observed

- Position origin (430,270), left 270, width 320, legacy height 120, initial levels entry 270,
  target 210, stop 330. Trusted TP→120/SL→440 yields real SVG/root top 120, height 320 and visible zones outside
  the old bounds. Four actual grips: Target/Stop squares, Entry/Width circles.
- Entry→310 keeps TP 120/SL 440 and displays R 1.46. Width→420 preserves left 270 and every level.
  Body (+60,+20) changes origin to (490,290), left 330 and stored levels to 140/330/460. No virtual width
  point is serialized. Half-scale Entry gesture makes one history entry and undo restores props.
- Full-span h/v guides pick near far endpoints, have exactly one center grip, and body/grip obey
  y-only/x-only constraints at scales 1/.5. Trendline/arrow pick and move along their stroke,
  have exactly two endpoints/no rectangle, and move both points. Rectangle has four corners,
  resize still works and undo restores it.
- Scale .8/rotation 15° position root bounds agree with projected geometry within 1px. Trusted
  posed Entry drag changes local entry by 20 and keeps TP/SL fixed.
- Actual app autosave commits old props 3 with no left. Normal reload migrates to props 4 with
  `left = old x - width/2` and preserves levels. A new edit saves migrated props 4; second reload
  restores the whole project exactly. Tooltip confirms genuine SQLite (OPFS).
- Real static/posed Remotion stills match clean-preview reward/risk/level/guide mask extents with
  **0px** differences (gate <3px). Three actual declared strokes yield nine paint samples at
  unobscured 10/30/50% across preview/export; all pass. Guides reach full 960/540 endpoints.
- All four selected grips visibly change 9×9 neighborhoods by mean RGB 96–105.65432 (>5).
  Actual exported grip neighborhoods match clean preview: static mean RGB 0, posed max 0.0781893
  (<3). This is actual painted absence proof, not merely DOM ownership.

## Tests executed and observed results

Cached pnpm: `node C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs`.
Windows workspace-symlink operations used require_escalated. Every command below exited0 and
its final output was inspected:

- `pnpm test`: 637/637 tests, 38/38 files, 80.62s. Existing intentional malformed-input sidecar
  warning; no new Vitest tests needed because Task1 already covers the pure/DOM contract and the
  uncovered actual-browser/export/persistence paths are now asserted by the new script.
- `pnpm exec turbo run typecheck --force`: 6 successful/6 total, 0 cached, 57.359s.
- `pnpm build`: studio 1/1 task successful, 68.222s; Vite built 2383 modules. Zod pure-annotation and
  >500kB chunk warnings are recorded, not hidden. No lint script exists/no lint claim.
- `node scripts/verify-drawing-handles.mjs`: final complete run exit 0; durable JSON completedAt
  2026-11-02T16:04:23.995Z. This final run includes every committed individual-level probe.
- `node scripts/verify-element-repair.mjs`: exit 0, actual existing trusted manipulation/pose/
  lock/group/lifecycle/SQLite reopen and preview/export regression.
- `node scripts/verify-r1.mjs`: exit 0, six Main stills at 0/20/45/100/140/179 and three AuthoredPath
  stills at 45/100/179 plus complete 240-frame MP4, 212711 bytes. No --stills shortcut.
- `node --check scripts/verify-drawing-handles.mjs`; `git diff --check`: exit 0.

Browser development logs the existing Remotion ref special-prop warning. This task changed no
production source and found no unresolved production defect.

## Browser/platform tested

Windows Chromium 157.0.8080.0, 1800×1100, DPR 1, crossOriginIsolated=true, OPFS selected.
Composition 960×540, 30fps. Browser scale 1/.5 plus one scaled/rotated position. Task 1 pure/DOM
regressions cover .25/1/4 and the broader migration matrix; they are not claimed as real-browser
coverage here.

## Dependencies/licenses added

None. Installed dependencies only.

## SQLite/schema/archive migrations

Project schema 4 and SQLite/archive schema unchanged. Actual position props 3→4 is exercised through
app storage and reload. Task 1's version 1/2/3/sparse/fractional/extension validation matrix is in
the 637-test suite. Other drawing props stay 3. Docs align stable origin/paint placement distinction,
four handles with entry-only semantics, guide constraints and inactive compatibility lengths.

## Preview/export visual evidence

Durable record: docs/reviews/evidence/drawing-handles-verification.md and drawing-handles-result.json.
Inspected with view_image: 01-extended-levels-synthetic.png, 06-posed-position-synthetic.png,
export-static.png, export-posed.png, representative out/verify/authored/frame-0100.png.

Screenshot paths for controller inspection(all under E:/4004/orca/remotion-animator-studio):

- out/drawing-handles/01-extended-levels-synthetic.png
- out/drawing-handles/02-entry-width-body-synthetic.png
- out/drawing-handles/03-half-scale-synthetic.png
- out/drawing-handles/04-full-span-guide-synthetic.png
- out/drawing-handles/06-posed-position-synthetic.png
- out/drawing-handles/07-sqlite-migrated-props4-synthetic.png
- out/drawing-handles/preview-static-selected.png
- out/drawing-handles/preview-posed-selected.png
- out/drawing-handles/export-static.png
- out/drawing-handles/export-posed.png

## Concrete failures, corrections and limits

No production integration glue fixes were required. Four test-measurement iterations are retained
in this report rather than described as application bugs:

1. At half scale, guide y460 center grip was under floating transport Next frame. elementFromPoint
   identified the button. Fixture uses y80 clear canvas; chrome unchanged. Each grip drag now
   asserts actual unobscured target. This does not claim all pixels are free of toolbar occlusion.
2. Broad teal mask matched unrelated editor colors. Final mask uses exact .28 alpha composites
   reward RGB 22/58/60 and risk 78/35/40 ±2, retaining the 3px extent threshold.
3. Selected grips cover left stroke ends by 5px. Actual paint comparison uses clean preview;
   separate selected/clean/export 9×9 checks prove handles absent. No tolerance relaxed.
4. Added 75% target probe lay under the intentional foreground rectangle border (RGB 242/125/247),
   correctly failing strict magenta threshold. Final probes use unobscured 10/30/50%, same strict
   color threshold/1px neighborhood. Complete paint extents still compared independently.

Rulings: fixture corrections above are measurement choices, not design changes. If wrong, a
specific occluded region could be untested; complete-mask bounds, three individual strokes and
separate overlap-free export checks reduce that risk. No other scope deviation.

Known limits: two synthetic stills/static+posed paint only, not arbitrary media/font or full-video
pixel equality. R1 validates actual MP4 rendering, not codec capability on every browser. Full
creator scenarios/import/archive/SMT/MTF remain outside this follow-up. Existing sidecar warning,
Remotion ref warning and build warnings remain unchanged.

## Completion/commit

All Task2 steps completed from observed runs; controller owns independent review and final review.

Commit: 16d546bdb8bf285d29b706f49d9f44654a7a539b (test: verify position and line manipulation in browser and export). Working tree clean after commit. No push or merge performed.
