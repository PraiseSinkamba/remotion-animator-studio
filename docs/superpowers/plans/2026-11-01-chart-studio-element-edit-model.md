# Chart Studio — the element edit model — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Make every element in the editor be picked and edited by its own shape. A trend line is picked by
its stroke and dragged by its two ends; a text's box is derived from its content and its corner handle
scales the type; the elements that genuinely are boxes keep the box they have. Nothing is selected by a
rectangle that describes nothing.

**Architecture:** One optional field on the component contract — an `edit` model saying how the element is
picked (`box` / `segment` / `point`) and which control points it shows. The editor reads that declaration
and never asks what kind of element it is looking at, which is the rule the product already applies to
transport actions and inspector panels. The pure geometry — the region an element occupies, whether a
pointer hits it, and what a drag writes — moves into `packages/editor` as pure functions, so it is
testable; the DOM stays in `apps/studio`. The drawings' stored geometry changes: a line becomes two
absolute points and loses its box, which is project schema version 4 with a migration that carries it.

**Tech Stack:** pnpm 10.28.2, Turborepo 2.11.10, Node 24.20.0, TypeScript 5.6.3, Vite 5.4.11, React 18.3.1,
Remotion 4.0.538, Zustand 5.0.3, Tailwind CSS 4.3.3, Vitest 3.2.7, Zod 4.5.4 (`packages/core` only).

**Design spec:** `docs/superpowers/specs/2026-11-01-chart-studio-element-edit-model-design.md` (edition 1.0).
**Decision:** `docs/decisions/ADR-010-ELEMENT-EDIT-MODEL.md`.

**Companion docs this plan updates as it goes:** `docs/spec/FUNCTIONAL_SPEC.md` (§2, §3, §5),
`docs/spec/COMPONENT_CONTRACT.md`, `docs/roadmap/ROADMAP.md` (R3), `docs/quality/TEST_STRATEGY.md` (§3).

---

## Global Constraints

- `packages/core` imports no React, Remotion, Zustand or storage code. Its only React contact stays the
  type-only import at `packages/core/src/contract.ts:1`.
- Cross-package imports use the package name and `workspace:*`. No TypeScript path alias crosses a package
  boundary. A package's relative imports stay extensionless, except the one documented `.ts` import in
  `packages/core/src/elements.ts` (the plain-node provenance import in `packages/video/tools/render.mjs`
  resolves a `.ts` specifier but not an extensionless one).
- Zod lives in `packages/core` only, imported as `import * as z from 'zod/v4'`, pinned at `4.5.4`.
- Strict TypeScript, discriminated unions, no `any` in domain types. `Clip.props` stays
  `Record<string, any>` at the type level (ADR-008 §"Not migrated in this slice").
- The migration stays non-destructive and idempotent: `migrateProject(migrateProject(p))` deep-equals
  `migrateProject(p)`, and unknown keys survive. It keeps its history-dependent rejections (a higher
  schema version, an unknown component type, a newer clip `propsVersion`).
- **Components declare, the shell executes.** The editor names no element kind for selection, editing or
  picking. This is the property the whole design rests on.
- Determinism is structural: the region, the pick test and the transform maths are pure functions of the
  project and the pointer.
- Local-first holds: no network call, login or server is needed to edit, save, preview or export.
- Remotion packages stay pinned to `4.0.538`. React stays on `18.3.1`.
- **The render gate `node scripts/verify-r1.mjs` is required after every slice that touches rendering.**
  The suite alone is not proof that a change reached the video path.
- Every task ends with a commit. Every task names the files it touches and the interfaces it consumes
  and produces.
- **Honesty rule for this plan and for every executor of it:** planned work is phrased as "the slice
  asserts" and "the executor must report". No slice may claim a test passed or a build succeeded on the
  strength of this document. Anything not exercised is reported as unverified.

---

## Open questions this plan proceeds on

| # | Default implemented | If overridden |
|---|---|---|
| Q1 | **The contract field.** `VideoComponentDefinition` gains an optional `edit?: ElementEditModel` — `{ pick: 'box' \| 'segment' \| 'point', handles: ElementHandle[] }`. A handle is `{ id, effect, props? }` with `effect` in `scale \| font \| wrap \| point \| level \| move`. **A handle does not declare where it is** — the shell derives it: a `scale`/`font`/`wrap` handle is a corner or side of the element's region, a `point`/`level` handle is `props.points[id]`, a `move` handle is the element's own anchor. A trend line's two ends are *not* at the corners of its bounding box, so a handle placed as a fraction of the region could not name them. | If a handle carried its own position, the diagonal case would break and every declaration would have to compute geometry. |
| Q2 | **The shell falls back to the box model** when an element declares no `edit`. That keeps the field optional and makes the exit strategy real: an element can be moved back by removing its declaration. | If the field were required, every element would have to declare one before anything could be edited, and the migration could not be rolled back field by field. |
| Q3 | **The pick tolerance is in screen pixels** — 6 for a line's body, 10 for its endpoints, 8 for a point — converted to composition pixels by the canvas scale. The swing path's 10 *composition* pixels is 2.5 screen pixels at 25% zoom, which cannot be grabbed. | A composition-space tolerance would make the feel depend on the zoom, which is the thing the change is meant to fix. |
| Q4 | **A text's box is measured from the rendered text.** The composition stamps each clip's id onto its rendered root; the editor measures that element's box. The measurement is editor-only — the renderer stays pure. The font must be loaded for the measurement to be right; before it arrives the box is an estimate and then settles. | Measuring the text in the renderer would break the renderer's purity and make the composition's pixels depend on the font's load timing. |
| Q5 | **A text's font size stays the single master** and the box follows it. A corner handle scales the font proportionally to the pointer's movement from the centre; a side handle sets the wrap width, which is a new optional `maxWidth` prop. The inspector's width and height fields disappear for a text. | Keeping a stored width and height for a text would mean two sources of truth for a box the text already determines. |
| Q6 | **The three endpoint drawings lose their box** and their points become absolute; `horizontalLine` and `verticalLine` lose their unused dimension; `textLabel` loses its box. `rectangle` and `position` keep theirs, and `position`'s three levels become absolute. That is schema version 4. | Keeping the box alongside absolute points would leave two coordinate systems for one shape and the very rectangle this design removes. |
| Q7 | **The chart's corner handles drive its plot**, not its padded outer box. The chart's own padding, label row and price axis are fixed. | Letting the handles drive the outer box would make the plot a smaller thing than the rectangle the creator is dragging. |
| Q8 | **The authoring sessions are untouched.** The swing path's anchors and the drawing path's stroke belong to a session, not to a clip's edit model, and keep their own overlay and hit test. | They are already per-session and correct; folding them into the edit model would conflate "what am I drawing" with "how is this element edited". |
| Q9 | **The multi-selection rules**: every selected element shows its own control points; a handle drag acts on the element it belongs to; a body drag still moves the whole selection; a handle drag moves one element even inside a group. | One handle set for the selection would not be able to say which element a handle belongs to. |
| Q10 | **The pick order is unchanged** — tracks top-down, later clips within a track on top. A line crossing a candle is picked where it lies over the candle. | Changing the order would change what every existing composition looks like when it is edited. |
| Q11 | **`particles`, `sunMoon` and `skyCycle` keep their box** even though it is the whole canvas, and their corners scale their own `width` and `height`. | Dropping their box would leave three elements with no way to scale them from the canvas. |
| Q12 | **Rotation is not part of this.** It is a new prop on every element, a new transform in every renderer and a new rule in the hit test — roughly double the work, and meaningless for a chart. It is recorded as a deferred item in the roadmap. | Including it would make this two designs wearing one name. |

---

## Slice priority and the pilot

The order is fixed: **S0 → S1 → S2 → S3.** The pilot is **S2**.

**S2 is the pilot.** It is the first slice a creator can feel: a trend line picked by its stroke and dragged
by its ends, a text whose corner handle scales the type. S0 and S1 are the price of that — a contract
field, a set of pure geometry functions, and a change to what the drawings store.

Why S2 and not S1:

- **S1 changes rendering but not capability.** After S1 the drawings hold two absolute points and draw
  from them, but the editor still selects everything by its rectangle and still draws a box with corner
  handles. The creator cannot yet grab a line's end, so the slice cannot be judged as the feature.
- **S2 is where the model can be falsified.** If a line is still picked by a rectangle, if a text's corner
  handle does not scale the type, if a dragged endpoint leaves the other end moving — each of those is a
  failure of S0's model or S1's data, and S2 is where it becomes visible.

S0 and S1 must land together anyway, for the reason in the atomicity note below.

### Atomicity: why S0 is not "the contract field and the migration"

The requested split put the contract field and the geometry in S0 and the migration in S1. **The code forces
the migration and the renderer change into one release unit**, and this plan says so rather than pretending
otherwise:

1. `migrateClip` rejects a clip whose `propsVersion` is newer than its component's, with the message
   `Clip "${id}" uses props version ${clipVersion} but "${element}" supports ${definitionVersion}`
   (`packages/components/src/project-migrate.ts`). The drawing definitions' `propsVersion` must move for the
   new props, and the migrated clips must carry it — so the definition bump and the migration ship
   together.
2. The renderer reads the props the migration writes. A document migrated by a build whose renderer still
   expects `points` as fractions of a box draws its lines in the wrong place.
3. The editor's producer (`addDrawing`) writes the props the renderer reads. A migrated document and a
   freshly created drawing must agree, or the editor and the export disagree.

So the plan splits S0 into:

- **S0 — the contract, the pure geometry and the declarations. Additive and invisible.** The `edit` field
  on the contract, the region derivation, the pick test and the transform maths as pure functions in
  `packages/editor`, and an `edit` declaration on every element. **No schema bump, no behaviour change,
  nothing rendered differently.** It can be landed and reviewed on its own.
- **S1 — the atomic cutover.** `CURRENT_PROJECT_SCHEMA_VERSION = 4`, the v3 → v4 migration, the drawing
  adapters rewritten to read absolute points, the definitions' `propsVersion` bumped, the store's producer
  rewritten, the `AuthoredPath` fixture rewritten to v4.

---

## Dependency order

```text
S0 the contract, the pure geometry and the declarations (additive, invisible)
     │
     ▼
S1 the atomic cutover  (schema v4 + the migration + the drawing adapters + the producer)
     │
     ▼
S2 PILOT — the editor: the overlay, the picking, the transforms, the measured text box
     │
     ▼
S3 the final sweep — the whole work, end to end
```

| Slice | Unblocks | Because |
|---|---|---|
| S0 | S1 | The geometry functions and the declarations are what the v4 props and the new renderer are written against. |
| S1 | S2 | The editor draws the new props; it can only do that once the props, the renderer and the migration agree. |
| S2 | S3 | The sweep exercises the whole thing end to end. |

---

## File Structure

| Path | Responsibility |
|---|---|
| `packages/core/src/contract.ts` | The `edit` field on the component contract: `ElementEditModel`, `ElementHandle` |
| `packages/core/src/elements.ts` | The kinds that are edited as points rather than as a box, and their prop shapes |
| `packages/editor/src/geometry.ts` | **New.** The pure geometry: an element's region, whether a pointer hits it, and what a drag writes |
| `packages/editor/src/store.ts` | The producer writes the v4 props; the selection and the drag state |
| `packages/components/src/trading/drawings/definitions.ts` | The eight drawing definitions, their `edit` declarations and their v4 props |
| `packages/components/src/trading/drawings/adapters.tsx` | The eight renderers, reading the v4 props |
| `packages/components/src/base/definitions.ts` | The 22 base definitions and their `edit` declarations |
| `packages/components/src/motion/definitions/*` | The 3 motion definitions and their `edit` declarations |
| `packages/components/src/project-migrate.ts` | The v3 → v4 migration |
| `apps/studio/src/components/selection-overlay.tsx` | The one overlay: it draws the declared control points |
| `apps/studio/src/components/canvas-hit-test.ts` | The pick list, by shape rather than by box |
| `apps/studio/src/components/PreviewPanel.tsx` | The drags, and the measurement of the rendered text |
| `packages/video/src/composition.tsx` | Stamps each clip's id onto its rendered root, so the editor can measure it |

---

## Risk table

| # | Risk | Mitigation |
|---|---|---|
| R1 | The editor's shell grows a branch per element kind, which is the thing this design exists to remove | The shell may only read the `edit` declaration. The executor reports any `switch` over element types it had to write. |
| R2 | The text's measured box is wrong while the font loads, and the creator sees the rectangle jump | The measurement is the editor's alone; the render is untouched. The executor reports the font's load state. |
| R3 | A line's new pick tolerance makes it steal clicks from what is under it | The tolerance is 6 screen pixels and the layer order is unchanged. The executor reports the observed behaviour where two elements overlap. |
| R4 | The migration loses a drawing's shape | The migration is non-destructive and idempotent, and the points are carried exactly. A drawing with missing points is left alone. |
| R5 | The `Main` render fixture's bytes move | The new migration only touches drawings, and that fixture has none. The executor reports the four hashes and they must not move. |
| R6 | The `AuthoredPath` fixture's stills move | Expected: its drawings become endpoint-based elements. The executor reports the new sizes and says plainly that the change is intended. |
| R7 | The old selection overlay and the drawings' own point overlay both survive, and the creator sees two | S2 merges them into one overlay. The executor reports that the old layer is gone. |
| R8 | A drawing's inspector loses its position fields and the creator cannot move it | The position is the element's own points; the inspector shows them, and the element moves by being dragged. The executor reports what the inspector shows for each kind. |

---

## Deferred work

- **Rotation.** A follow-up, recorded in the roadmap.
- **Snapping** a drawing's endpoint to a candle, a bar or a price. It would need the chart back, and the
  drawings are independent now.
- **A clip-level "scale" transform** that scales an element's content proportionally (an image's pixels, a
  chart's type). The corners scale the element's box; the content that does not scale with it is a
  separate question.
- **Bezier paths.** A curve with more than two points is a different element.

---

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The `Main` fixture's stills and MP4 must be **byte-identical** after every slice:
`frame-0000 6a078939e3262ea891e618d0`, `frame-0045 3993e9e8b9699ab0ad2e6a48`, `frame-0179 d123229cfc6258c2a13e247f`,
`mp4 c96d117279856fcae39daf46`. The `AuthoredPath` fixture's stills are expected to change at S1, because
its drawings become endpoint-based elements; the executor reports the new sizes and does not assert
equality.

---

### Task 1: S0 — The contract, the pure geometry and the declarations

**Requirements:** OB-001, OB-003, OB-004, CH-009, TL-006, and the rows this plan adds.

**Files:**

- Modify: `packages/core/src/contract.ts` (the `edit` field)
- Create: `packages/editor/src/geometry.ts` (the pure geometry)
- Modify: `packages/editor/src/index.ts` (export it)
- Modify: `packages/components/src/base/definitions.ts` (22 declarations)
- Modify: `packages/components/src/motion/definitions/*.ts` (3 declarations)
- Modify: `packages/components/src/trading/definitions/candlestick-chart.ts` (1 declaration)
- Modify: `packages/components/src/trading/drawings/definitions.ts` (8 declarations)
- Create: `packages/editor/src/geometry.test.ts`

**Interfaces:**

- Consumes: the component contract; the `Clip` type; the drawing props as they are today.
- Produces:
  - `packages/core/src/contract.ts` — `ElementEditModel`, `ElementHandle`, and `VideoComponentDefinition.edit?`.
  - `packages/editor/src/geometry.ts` — the pure functions:
    - `elementRegion(clip, project): Region | null` — the element's region, derived for the endpoint kinds
      from their own points and for the box kinds from `x`, `y`, `width`, `height`.
    - `hitsElement(pick: 'box' | 'segment' | 'point', region, point, tolerancePx): boolean` — the pick test,
      in **screen** pixels.
    - `handleAt(region, handle, clip): { x: number; y: number } | null` — where a handle is drawn.
    - `dragEffect(clip, handle, region, pointer, start): Record<string, unknown> | null` — what a drag writes:
      a corner scales the box or the font, a side sets the wrap width, a point or a level moves that point,
      a move shifts the element.

- [ ] **Step 1: Write the contract field**

Add `ElementEditModel` and `ElementHandle` to `packages/core/src/contract.ts` and the optional
`edit?: ElementEditModel` to `VideoComponentDefinition`. The field is optional: an element that declares
none keeps the current behaviour (Q2).

- [ ] **Step 2: Write the pure geometry, test first**

Create `packages/editor/src/geometry.ts`. Write `packages/editor/src/geometry.test.ts` first and watch it
fail.

The tests must pin:

- A **box** element is hit anywhere inside its region.
- A **segment** element is hit within the tolerance of the line and **nowhere else** — in particular, the
  pointer in the middle of a trend line's bounding box, far from the line, must **not** hit it.
- A **point** element is hit within the tolerance of the point.
- The tolerance is in **screen** pixels: the same pointer hits the same element at every zoom.
- A **zero-length line** does not divide by zero and is hit as a point.
- A **trend line's region** is the bounding box of its two endpoints.
- A **corner drag** scales the box and leaves the opposite corner where it was.
- A **corner drag on a text** writes the font size, not the width and height.
- A **side drag on a text** writes the wrap width.
- An **endpoint drag** moves one endpoint and leaves the other exactly where it was.
- A **high/low line's endpoint drag** keeps both ends on one vertical.
- A **level drag** moves one level of the position tool.

- [ ] **Step 3: Declare an edit model on every element**

Every element that can be picked on the canvas declares one, following the design spec's groups:

| Group | `pick` | `handles` |
|---|---|---|
| 1 — the box is the truth | `box` | four corners, `effect: 'scale'`, `props: ['width', 'height']` |
| 2 — the content is the truth | `box` | four corners `effect: 'font'` + four sides `effect: 'wrap'` |
| 3 — one anchor | `point` | one handle `effect: 'move'` |
| 4 — two endpoints | `segment` | two handles `effect: 'point'`, keyed `start`/`end`, `top`/`bottom`, `from`/`to` |
| 5 — a box with levels | `box` | three handles `effect: 'level'`, keyed `entry`/`stop`/`target` |
| 6 — not on the canvas | none | none |

`blob`, `cursor` and `neonSun` scale their `size`; `isoCity` scales `gridSize` and `tileSize`;
`particles`, `sunMoon` and `skyCycle` scale their `width` and `height`; the chart's corners drive the plot
(Q7).

- [ ] **Step 4: Run the suite and typecheck**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Give every element a declaration of how it is picked and edited

The editor gave every element the same selection: a dashed rectangle
with four corner handles, drawn from the element's box, and the canvas
picked elements by that same rectangle. That model is wrong for the
elements that are not rectangles.

Each element will declare how it is picked and what the creator can drag.
The geometry that decides it — the region an element occupies, whether a
pointer hits it, and what a drag writes — is now pure functions in the
editor package, so it can be tested. Nothing is rendered differently yet.
"
```

---

### Task 2: S1 — The atomic cutover: schema v4, the migration, the adapters, the producer

**Requirements:** OB-001, OB-004, CV-005 and the rows this plan adds.

**Files:**

- Modify: `packages/core/src/schemas.ts` (`CURRENT_PROJECT_SCHEMA_VERSION = 4`)
- Modify: `packages/core/src/elements.ts` (the point-based drawing kinds and their prop shapes)
- Modify: `packages/components/src/project-migrate.ts` (the v3 → v4 migration)
- Modify: `packages/components/src/trading/drawings/adapters.tsx` (the eight renderers read the v4 props)
- Modify: `packages/components/src/trading/drawings/definitions.ts` (the `propsVersion` bump, the defaults)
- Modify: `packages/editor/src/store.ts` (`addDrawing` writes the v4 props)
- Modify: `packages/editor/src/drawings.ts` (`drawingDraftFromClicks` writes absolute points)
- Modify: `packages/video/remotion/authored-path-fixture.ts` (the fixture, to v4)
- Modify: `packages/components/src/project-migrate.test.ts`, `packages/editor/src/drawings.test.ts`,
  `packages/components/src/trading/drawings/drawings.test.tsx`

**Interfaces:**

- Consumes: S0's geometry functions and the `edit` declarations.
- Produces: the v4 drawing props — `{ points: { start: {x,y}, end: {x,y} } }` for the endpoint kinds,
  `{ x, y, width }` for a horizontal line, `{ x, y, height }` for a vertical line,
  `{ x, y, points: { at } }` for a text label, the unchanged box for a rectangle, and
  `{ x, y, width, height, points: { entry, stop, target } }` with **absolute** points for the position tool.

- [ ] **Step 1: Write the migration test first**

In `packages/components/src/project-migrate.test.ts`, pin the v3 → v4 migration: a trend line's fractional
points become absolute; its `x`, `y`, `width` and `height` are dropped; a horizontal line keeps its width
as its length and drops its height; a text label's point becomes absolute and its box goes; the position
tool's three levels become absolute and its box stays; nothing else changes; the migration is idempotent
and non-destructive; a drawing with missing points is left alone.

- [ ] **Step 2: Write the migration**

In `packages/components/src/project-migrate.ts`, add `migrateV3ToV4` and chain it after the v2 → v3 step.
Bump `CURRENT_PROJECT_SCHEMA_VERSION` to 4 in `packages/core/src/schemas.ts`.

- [ ] **Step 3: Rewrite the adapters and the definitions**

The eight renderers read the v4 props. A trend line draws between `points.start` and `points.end`; the
high/low line between `points.top` and `points.bottom`; the arrow between `points.from` and `points.to`;
the horizontal line at its `x`/`y` across its `width`; the vertical line down its `height`; the text
label at `points.at`; the position tool's levels at `points.entry`, `points.stop` and `points.target`.

Bump the drawing definitions' `propsVersion` — the migration and the definition must move together
(the atomicity note).

- [ ] **Step 4: Rewrite the producer**

`packages/editor/src/drawings.ts`'s `drawingDraftFromClicks` produces absolute points and no box for the
endpoint kinds; `packages/editor/src/store.ts`'s `addDrawing` writes the v4 props.

- [ ] **Step 5: Rewrite the fixture**

`packages/video/remotion/authored-path-fixture.ts` moves to schema version 4, and its trend line holds two
absolute points.

- [ ] **Step 6: Run the render gate and report**

`node scripts/verify-r1.mjs`. The `Main` fixture's four hashes must not move. The `AuthoredPath` fixture's
stills **are** expected to change — its drawings become endpoint-based elements — and the executor reports
the new sizes and says plainly that the change is intended.

- [ ] **Step 7: Run the suite and typecheck**

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Store the drawings as the shapes they are

A trend line, an arrow and a high/low line are two points, and a text
label is one. They now store those points absolutely and drop the
rectangle they were measured in, which is what let the rectangle swallow
the canvas when a line was selected.

The migration carries existing documents across, and a position tool keeps
its box and gets absolute levels.
"
```

---

### Task 3: S2 — PILOT: the editor, the overlay, the picking and the transforms

**Requirements:** OB-001, OB-003, OB-004, CH-009, TL-006 and the rows this plan adds.

**Files:**

- Modify: `apps/studio/src/components/selection-overlay.tsx` (the one overlay)
- Modify: `apps/studio/src/components/canvas-hit-test.ts` (the pick list by shape)
- Modify: `apps/studio/src/components/PreviewPanel.tsx` (the drags, the measurement)
- Modify: `packages/video/src/composition.tsx` (stamp each clip's id onto its rendered root)
- Modify: `packages/components/src/trading/inspectors/drawing.tsx` (what the drawing inspector shows)
- Modify: `apps/studio/src/components/Inspector.tsx` (the text's font size and wrap width)

**Interfaces:**

- Consumes: S0's `geometry.ts` and the `edit` declarations; S1's v4 props.
- Produces: an editor that picks and edits by shape.

- [ ] **Step 1: The overlay draws what the element declares**

Rewrite `selection-overlay.tsx` to read `definition.edit` and draw its handles — four corners and four
sides for a text, two endpoints and **no rectangle** for a line, three levels for the position tool, one
handle for a point kind. One handle style, one layer.

The drawings' own point overlay in `PreviewPanel.tsx` goes: the selection overlay now draws those points.
The executor reports that only one overlay remains for a selected drawing.

- [ ] **Step 2: Picking by shape**

`canvas-hit-test.ts`'s `pickableClips` and the pick test use the element's declared `pick` and S0's
`hitsElement`, with the tolerance converted to composition pixels by the canvas scale.

- [ ] **Step 3: The drags**

`PreviewPanel.tsx` uses S0's `dragEffect` for the handles and the body. The swing path's anchors and the
drawing path's stroke keep their own session overlays and hit tests (Q8).

- [ ] **Step 4: The text's measured box**

`packages/video/src/composition.tsx` stamps each clip's id onto its rendered root. `PreviewPanel.tsx`
measures the selected text's rendered box and derives the region from it. The measurement is editor-only;
the renderer stays pure.

- [ ] **Step 5: The inspector**

A text shows its font size and its wrap width; the width and height fields go. The drawing inspector shows
the caption, the style and the per-kind extras, as it does now.

- [ ] **Step 6: Exercise it in a browser and report**

With a trend line, a rectangle, a text and a chart in the project, report for each: that it is picked by
its shape and not by a rectangle; that its endpoints are draggable and one end stays while the other
moves; that dragging a line's body moves the whole line; that a text's corner handle scales its type and
its side handle rewraps it; that a line no longer prevents another element underneath from being picked;
and that the layer order still decides what is on top. Report the observed results, including the
console.

- [ ] **Step 7: Run the render gate and report**

- [ ] **Step 8: Run the suite, typecheck and build**

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Pick and edit elements by their shape

A line is picked by its stroke and dragged by its ends, a text's box is
derived from its content and its corner handle scales the type, and the
elements that are boxes keep the box they have. The canvas picks by the
shape an element declares, with the tolerance in screen pixels so it
feels the same at every zoom, and one overlay draws the control points
instead of two.
"
```

---

### Task 4: S3 — The final sweep

**Requirements:** every ID this work touches.

**Files:** the four companion documents; the roadmap's deferred list.

- [ ] **Step 1: Run the whole verification set**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

- [ ] **Step 2: Confirm the cutover is clean**

Grep the workspace for `chartClipId`, `paneId`, `anchors`, `REQUIRED_ANCHORS`, `resolveAnchors`,
`drawingBarId`, `at: { x: number; y: number }` in a handle declaration, and the retired props. Every hit
must be gone except the historical references in the ADRs and the plans, and except the migration and its
tests, which must read the old shape. Report the grep output.

- [ ] **Step 3: Bring the companion documents in line**

`docs/spec/FUNCTIONAL_SPEC.md` (§2, §3, §5) — the schema version, the element rows and the new ones.
`docs/spec/COMPONENT_CONTRACT.md` — the `edit` field, the shell's obligation to read it, and the picking
rule. `docs/roadmap/ROADMAP.md` — what shipped, and **rotation** as the deferred item.
`docs/quality/TEST_STRATEGY.md` (§3) — the new test surfaces and the observed counts.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Bring the companion documents in line with the edit model

The functional spec, the component contract, the roadmap and the test
strategy now read as implemented: every element declares how it is picked
and edited, the canvas picks by shape, and rotation is recorded as the
follow-up.
"
```

---

## What the executor must report at the end

- Per slice: the observed `pnpm typecheck`, `pnpm test` and `pnpm build` results; the render gate's
  still sizes and MP4 outcome for the slices that require it; the browser interaction observed for the
  slices with a UI.
- The final test count and file count.
- The `Main` fixture's four hashes and the statement that they did not move; the `AuthoredPath` fixture's
  new sizes and the statement that they changed because the drawings became endpoint-based elements.
- The grep output from the clean-cutover check, and the observation that the only remaining mentions of the
  retired shape are in the migration, its tests, and the records that describe the change.
- **Whether the editor's shell names any element kind** for selection, editing or picking. It must not,
  and a branch that crept in is a defect the executor reports.
- Whether the text's measured box settles after the font loads, and what it measured.
- Every item in the Deferred work section, named as still deferred.
- Anything not exercised, named as unverified.
