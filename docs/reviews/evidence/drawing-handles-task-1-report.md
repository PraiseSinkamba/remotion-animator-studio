# Task 1 report

Status: COMPLETE for Task 1 production code and automated regressions. Browser workflow, production build, real Remotion still/MP4 gate and final feature documentation remain Task 2. No claim of complete feature acceptance is made here.

Base: `58eaed2` (`docs: plan position and line handle follow-up`). Preserved and completed the interrupted nine-file implementation. Commit: `ac6b4bc` (`fix: align position and line handles with their geometry`).

## Requirements and behavior

- OB-003/005/006/011/012, EM-001/002/004/005/006, PR-003/010; SC-03 position/entry explanation is the relevant synthetic drawing workflow.
- Position props version is 4; other drawing props remain 3; project schema remains 4. Explicit `left` defines paint placement; level min/max defines height with a one-pixel collapsed minimum. Authored x/y remains the transform origin, and height remains inactive compatibility data.
- Four grips, painted in recoverable order: Target square, Stop square, Entry circle, Width circle. Entry changes only stored entry.y (including exact preservation of stored x and nested data); target/stop remain fixed. Width edits only width with left fixed. Body translation changes x/y, left and real points, without serializing the virtual width point.
- Shared pure `purpose-geometry.ts` calculations feed declarations and drawing rendering. CSS content placement and explicit transform origin preserve the authored pivot through level and width edits, scale and rotation. Existing components without placement retain centered layout.
- Guides span the supplied composition, with one center move grip and y-only/x-only body and grip movement. Guides, trendlines and arrows have no selection rectangle. Segments retain two endpoint grips; rectangle retains four corners. Screen-space tolerance remains 6 pixels and is tested at 0.25/1/4 zoom.
- Removed position x/y/height and guide orthogonal/length inspector parameters. Width, opacity and existing style/direction/ratio controls remain. No element-kind dispatch was added to generic geometry or overlay code.
- Normal geometric ratios show two decimals. Nonzero reward with zero risk reads `R — (zero risk)`; coincident levels read `R 0.00`. Overlapping grips can be separated in their declared paint order.
- Creation audit: click and drop factories write left; generic addClip translates declared extra scalars and absolute points to the project center; direct addDrawing fills a draft at the actual project size. Presets contain no position constructors requiring a version update. Factories stamp the registry's current props version.
- Integration audit found a pre-existing resizeProject defect: absolute points were not scaled. The resize path now uses coordinate/translation declarations to scale real absolute points and extra scalar coordinates such as left, preserving nested data, fractional props, locks and undo. No element-kind branch was introduced.

## Public interfaces

- `ComponentGeometry.placement?: EditBox`: actual layout box, separate from origin.
- `VideoComponentDefinition.geometry(props, measured?, composition?: {width:number;height:number})`: optional composition size.
- `ComponentRenderContext.geometry?` and `.composition?`: plain optional computed context.
- `ElementEditModel.moveAxis?: 'x'|'y'`: body/move-grip axis constraint.
- `ElementEditModel.translate?: {x?:string[]; y?:string[]}`: scalar coordinate fields, in addition to actual absolute points; default x/y behavior remains.
- Generic handle effect `width`, with a declared scalar `props[0]`, measured from the region's left edge; named geometry points position it.
- `ElementHandle.appearance?: 'circle'|'square'` and `.label?: string`: generic grip styling/tooltips/accessibility.
- `PositionProps.left?: number`, validated at input/storage boundaries. No new dependencies.

## Migrations

Legacy fractional positions are defaulted using an explicit frozen-in-code old model, validated before arithmetic, converted to absolute coordinates, then given `left = old x - old width/2` and propsVersion 4. v3 absolute points are retained. Migration passes now respect clip props versions independently of project version. Nested point/style/extension data, input immutability and idempotence are covered, including out-of-box legacy levels and sparse props. Invalid supplied values reject. Retired high/low-to-trendline conversion is stamped 2 while still fractional, rather than claiming current absolute coordinates.

SQLite/archive/project schema: unchanged. Position props migration only.

## Executed verification

Commands used the cached pnpm entry point `node C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs` with elevated workspace-symlink access.

- Initial expanded red run: 5 files, 121 tests; 7 failed / 114 passed. Failures proved sparse/default/versioned migration data loss, invalid left overwrite and level x rewriting.
- Overlay/factory red run: 7 files, 227 tests; 5 failed / 222 passed. Failures proved stale direct-drawing defaults and selection rectangles on all four line kinds.
- Zero-risk rendering red run: 2 files, 17 tests; 1 failed / 16 passed.
- Nested legacy point preservation red run: 1 file, 17 tests; 1 failed / 16 passed.
- Resize red run: store.test.ts, 44 tests; 1 failed / 43 passed, proving unscaled left/absolute levels.
- Focused green run: 8 files, 234 tests passed before the final overlap/body/precision/resize additions.
- Final `pnpm test`: **38 files, 637 tests passed**, exit 0, 111.72 seconds. Includes actual PreviewPanel/SelectionOverlay pointer-event tests at 0.25/1/4, exact state/undo assertions, pose projection, migration, drawing SVG and compositor layout coverage. The sidecar test intentionally logs a malformed-input warning and passes.
- Final `pnpm exec turbo run typecheck --force`: **6 successful, 6 total, 0 cached**, exit 0, 74.906 seconds. Core/components/ui/editor/video/studio; video also runs node syntax checks for render/server tools. A prior run caught TS test-fixture union inference; explicit Clip annotations fixed it before this green run.
- `git diff --check`: clean. Git reports expected LF/CRLF normalization notices, no whitespace errors.
- No lint script exists in the workspace root. No fake browser/render result is claimed.

Platform: Windows PowerShell, Node/pnpm/Vitest. DOM workflows use jsdom with real application components and pointer handlers; they do not replace Task 2 Chromium pointer/export evidence.

## Self-review and concerns

Reviewed the complete delta against base, including migration sequencing, scalar/point persistence, virtual point exclusion, stable pivot placement, projected-after-patch geometry, compatibility APIs, inspector metadata and resize integration. All tests were executed and their final summaries inspected. No unresolved Task 1 correctness concern is known.

Narrow decisions: collapsed paint minimum is one composition pixel; zero-risk display is textual rather than Infinity; overlapping grips recover in declaration paint order. Width minimum reuses the existing one-pixel geometry minimum. Existing authoring precision is retained for drags/resizes, while a level drag preserves untouched x exactly.

Preview/export visual evidence: automated SVG/compositor markup checks only in Task 1. Task 2 must capture the real synthetic fixture workflow, verify actual exported stills without grips, and run production build plus `node scripts/verify-r1.mjs` before the overall feature is declared done.
