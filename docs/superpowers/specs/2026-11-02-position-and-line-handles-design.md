# Position and line manipulation follow-up

Implementation and observed acceptance evidence (2026-11-02): Task 1 production commit `ac6b4bc`;
the [durable verification record](../../reviews/evidence/drawing-handles-verification.md) and
[machine results](../../reviews/evidence/drawing-handles-result.json) document the real browser,
SQLite migration/reopen, static/posed export and complete still/MP4 gates. The specification below
remains the binding design; evidence limits are recorded rather than broadening its acceptance.

Owner request: the position tool clips TP/SL outside its old box; use four TradingView-like purpose handles. The owner explicitly clarified: **TP and SL stay fixed when entry/R:R moves**. Body dragging remains whole-tool movement. Horizontal/vertical guides span the composition and have one center handle constrained to the corresponding axis; segments have only two free endpoints and are selectable/draggable along their stroke. Rectangle behavior stays unchanged.

## Position geometry

- Keep independent absolute entry/target/stop points and the existing `x/y` transform origin, style, opacity, lifecycle and direction. Add an explicit `left` paint edge; width extends rightward from it. Actual vertical bounds are min/max of entry, target and stop, with a finite minimum height for a collapsed tool. Stored legacy height is recovery/compatibility data, never the new height authority.
- Position props version becomes **4**; other drawing versions remain **3**, and project schema stays **4**. Migrate old position props after existing legacy-to-absolute conversion: `left = old x - old width/2`; retain point coordinates, transform origin and extension fields. Preserve unknown nested point/style data, input immutability and idempotence. Sparse old props use the old defaults, never defaults from the new model. Invalid supplied values still reject. Audit the existing propsVersionOf helper so old fractional coordinates cannot be incorrectly stamped as current.
- Render placement is the level-derived paint box, while the transform origin remains the authored x/y. This distinction prevents pivot movement when changing TP/SL/entry/width and preserves existing animated positions. The compositor and editor use the same declaration; do not fix clipping only by making an arbitrary fixed SVG overflow.
- Four declared grips: **target** square left at TP (vertical level drag); **stop** square left at SL (vertical level drag); **entry** circle left at entry (vertical entry-only drag); **width** circle right on entry (horizontal width-only drag, left fixed). Exactly these four; no corner grips. Entry edits change only entry.y and the geometric R:R label; TP/SL remain fixed. Width edits change width only; levels and left remain fixed. Body movement translates x/y origin, left and every stored absolute point together.
- Levels may extend beyond previous bounds and remain visible, selectable, and inside the new outline when inside the composition. Do not impose new long/short crossing constraints. Define finite/clear ratio display for zero-risk and coincident levels; render order must allow overlapping level grips to be separated again.
- Inspector controls expose meaningful geometry (width and purpose-level controls where appropriate), not stale fixed height or technical pivot coordinates masquerading as body-position controls. Preserve editing via the body/handles and existing appearance/lifecycle controls.

## Shared contracts

- Add optional pure composition size context to definition geometry: `geometry(props, measured?, composition?: {width:number;height:number})`.
- Add optional `ComponentGeometry.placement?: EditBox`, the actual content layout box. For a declared placement, the compositor positions its content at left/top without center translation, and uses `geometry.origin - placement.left/top` as CSS transform-origin. Existing components without placement keep their current render path. Pass computed geometry and composition size to render adapters through optional plain render-context fields.
- Add generic edit metadata for constrained body movement (`moveAxis?: 'x'|'y'`) and extra translated scalar fields (`translate?: {x?: string[];y?: string[]}`), defaulting to ordinary x/y. Position declares x fields x+left, y field y; actual stored points translate too. Never serialize virtual geometry/control points as stored points.
- Add a generic width/span handle writing a declared scalar width relative to the region's left edge. Named geometry control points position purpose handles. Optional grip appearance/label metadata distinguishes circles/squares without element-kind branches in the editor. Existing scale/font/wrap/point/level/move semantics remain compatible.
- Preserve the shared evaluated pose, screen-pixel hit tolerance, lock/lifecycle guards, immutable gesture baseline, accepted-change undo and no future data leakage. No component kind dispatch in shell picking/drag logic.

## Lines

- Horizontal guide: segment `(0,y)` to `(composition.width,y)`, one center move grip, y-only movement. Vertical guide: `(x,0)` to `(x,composition.height)`, one center grip, x-only movement. Both body and grip obey the constraint and the entire stroke picks at the existing 6 screen pixel tolerance.
- Retain old finite length fields as inactive compatibility data; remove misleading width/height and orthogonal-position inspector controls. Use declared placement/context so global spans also render correctly on non-1920×1080 projects and export.
- Trendline and arrow retain two free endpoints, no rectangle/four corners; body drag moves both endpoints. Rectangle retains four corner scale grips and existing behavior.

## Acceptance

Reproduce TP/SL beyond the old box first. Cover four grips, entry-only ratio changes, width-left anchoring, whole-body translation, old position migration (including props1/2/3 under old/current project versions), extensions, clipping, guide full-span/axis locks and segment body picking at 0.25/1/4 zoom. Test positioned/scaled/rotated poses against rendered geometry. Real browser pointer workflow must capture the position after extended levels, entry/width changes, guides and segment handling; compare actual exported stills and confirm handles absent from export. Run full tests, six typechecks, build and real Remotion still+MP4 gate. Label fixture data synthetic. No new dependencies or TradingView branding/assets/monetary calculations.
