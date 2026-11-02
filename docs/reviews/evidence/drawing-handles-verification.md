# Position and line handles — observed verification, 2026-11-02

This record covers the owner-approved [position and line follow-up](../../superpowers/specs/2026-11-02-position-and-line-handles-design.md).
It preserves the earlier [element repair report](element-repair-verification.md) as historical evidence.
Machine observations are in [drawing-handles-result.json](drawing-handles-result.json).

## Scope and contracts

Requirement IDs: OB-003/005/006/011/012, EM-001/002/004/005/006, PR-003/010, CPT-005,
EX-003. Scenario: **SC-03 drawing manipulation subset**, entirely synthetic geometry, no market
dataset, broker fills, monetary calculations or trading signals. This is not the complete SC-03
creator workflow, import/archive acceptance, or an SMT/MTF release gate.

Task 1 production commit: `ac6b4bc`. Task 2 adds an installed Vite/Remotion/CDP gate at
`scripts/verify-drawing-handles.mjs`. Fixture setup and observation import canonical app source
modules; manipulation uses trusted CDP mouse events through actual PreviewPanel/SelectionOverlay
handlers. No production globals, extra dependencies or shell kind dispatch were introduced.

Position props version is **4**, other drawing props remain **3**, project schema remains **4**.
`left` and level-derived vertical bounds determine paint; x/y remains the authored transform
origin. The shared declaration supplies layout placement, composition size, constrained movement,
translated scalars and purpose-grip metadata. SQLite/archive schemas are unchanged.

## Browser observations

Windows Chromium `157.0.8080.0`, 1800×1100 viewport, DPR 1, cross-origin isolated, real SQLite
OPFS backend. Composition is 960×540 at 30fps; direct manipulation runs at stage scale 1 and .5.

- Initial position: origin `(430,270)`, left 270, width 320, legacy height 120, entry 270,
  target 210, stop 330. Trusted grip drags extend target to 120 and stop to 440. Actual SVG/root
  bounds become top 120, height 320; both zones are visible beyond the former box.
- Exactly Target/Stop square grips and Entry/Width circle grips. Entry to 310 leaves target 120
  and stop 440 unchanged and displays `R 1.46`. Width to 420 preserves left 270 and all levels.
  Body delta `(60,20)` yields origin `(490,290)`, left 330 and level y values 140/330/460.
  The virtual width point does not enter stored points.
- Half-scale Entry manipulation adds one history entry; undo restores the complete prior props.
  Horizontal/vertical guides pick near their distant endpoints, span the actual composition,
  have one center grip and constrain both body/grip movement to y/x respectively at both scales.
  Trendline and arrow each retain two endpoints, no selection rectangle, and whole-body motion
  moves both endpoints. Rectangle keeps four corners and its resize/undo behavior.
- A position with scale .8 and rotation 15° has Chromium layout bounds within 1 composition pixel
  of projected geometry. A trusted posed Entry drag changes the local entry by 20 while TP/SL
  remain fixed.
- A genuine props-v3 position, with left absent, is committed by application autosave. Normal
  application reload migrates it to props v4 with `left = old x - width/2` and unchanged levels.
  A subsequent edit commits props v4, and a second reload restores the whole project exactly.
  The actual status tooltip identifies `SQLite (OPFS) — stored in this browser`.

## Export paint and overlay exclusion

The same edited static and posed projects are rendered through `bundleVideo`, `selectComposition`
and real Remotion `renderStill` at frame 0. Actual preview screenshots are compared with exported
PNGs. Zone masks use the explicit .28 alpha composites over `#101018`: reward `(22,58,60)` and
risk `(78,35,40)`, ±2 RGB units. Magenta level and cyan/yellow guide masks are separate.

All reward/risk/level/horizontal/vertical mask extent differences were **0 composition pixels**
for both static and posed cases, under an unchanged 3-pixel gate. Each of the three declared level
strokes is also sampled at unobscured 10%, 30%, 50% in preview and export within a one-pixel neighborhood.
Exported horizontal/vertical paint reaches composition endpoints.

The selected screenshot proves every purpose grip is visible. The clean preview is used for
paint bounds because the selected grips cover the left stroke ends. At each 9×9 grip neighborhood,
the selected preview differs from the clean preview by mean RGB **96–105.66** (>5 required).
Actual export matches the clean preview: mean RGB error **0** for all static grips and at most
**0.07819** for posed grips (<3 required). This tests actual absence of the painted editor grips,
in addition to their editor-only ownership.

## Gates executed and inspected

Cached pnpm entry: `node C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs`.
Windows sandbox symlink restrictions required elevated execution of the installed tools.

| Command | Observed result |
|---|---|
| `pnpm test` | Exit 0; 637 tests, 38 files, 80.62s |
| `pnpm exec turbo run typecheck --force` | Exit 0; 6/6 successful, 0 cached, 57.359s |
| `pnpm build` | Exit 0; studio production build, 1/1 task successful, 68.222s |
| `node scripts/verify-drawing-handles.mjs` | Exit 0; trusted drawing gestures, SQLite migration/reopen, static/posed still raster/grip assertions |
| `node scripts/verify-element-repair.mjs` | Exit 0; existing trusted-browser, persistence and preview/export regression |
| `node scripts/verify-r1.mjs` | Exit 0; six Main stills, three AuthoredPath stills, full 240-frame MP4 (212711 bytes) |
| `node --check scripts/verify-drawing-handles.mjs`, `git diff --check` | Exit 0 |

The build logs Zod pure-annotation removal and bundle-size warnings. Browser development output
logs the existing Remotion `ref` special-prop warning. The malformed-input sidecar negative test
intentionally warns and passes. There is no lint script; no lint success is claimed.

## Visual evidence and limits

Inspected using the image viewer: extended-level screenshot, selected posed screenshot, static and
posed exported stills, and representative authored-path R1 still. Generated files remain under
`out/` (not committed):

- `out/drawing-handles/01-extended-levels-synthetic.png`
- `out/drawing-handles/02-entry-width-body-synthetic.png`
- `out/drawing-handles/03-half-scale-synthetic.png`
- `out/drawing-handles/04-full-span-guide-synthetic.png`
- `out/drawing-handles/06-posed-position-synthetic.png`
- `out/drawing-handles/07-sqlite-migrated-props4-synthetic.png`
- `out/drawing-handles/preview-{static,posed}-{selected,clean}.png`
- `out/drawing-handles/export-{static,posed}.png`, `project-{static,posed}.json`, `evidence.json`
- `out/verify/` (nine stills), `out/chart-studio-r1.mp4`

An early half-scale fixture placed the horizontal center grip under the floating transport's
Next frame button. `elementFromPoint` identified the button. The fixture moved the guide from
y470 to y80, a clear canvas location; application chrome was unchanged. The gate now asserts
each grip's actual pointer target before dragging. This records toolbar occlusion rather than
claiming all canvas pixels are unobscured. Early broad color masks also matched unrelated editor
pixels; exact fixture colors and clean-preview paint comparison corrected the measurement without
loosening any geometry tolerance. No production integration defect or fix was needed.

An additional individual-level probe originally sampled the target at 75%, under the intentionally
overlaid rectangle's white border (export RGB 242/125/247). The strict magenta check correctly
rejected that occluded pixel. Final level probes use unobscured 10/30/50% portions with the same
color threshold and one-pixel neighborhood. All nine level samples pass in each static/posed
preview and export; the complete paint-mask extents remain compared independently.

Raster assertions cover these two deterministic synthetic stills, not arbitrary font/media parity
or full-video pixel equality. The MP4 gate proves actual rendering, not browser-side codec support
or visual equality at every frame. Earlier pure/DOM tests cover the .25/1/4 scale edge cases and
legacy migration matrix; the real-browser follow-up specifically covers .5/1 and one posed tool.
