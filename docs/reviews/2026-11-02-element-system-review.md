# Element system and canvas selection review

Date: 2026-11-02 · Baseline: `ad39ed4` plus the existing uncommitted working tree.

## Assessment

**The reported selection separation has a confirmed implementation cause. The element system also has architectural gaps that would allow similar failures after that bug is fixed.** A complete editor rewrite or a replacement video framework is unnecessary. A focused redesign of geometry evaluation, element capabilities, and edit commands is justified before extending the catalogue.

The immediate cause is a measurement-cache early return: if the number of measured elements is unchanged, the editor discards every new measurement. Rendering moves the element, while picking and the selection overlay retain its old rectangle. This affects ordinary box and content elements once measured; it is not limited to text or trading tools.

The architectural cause is that there is no single frame-specific geometry contract shared by rendering and editing. Static props, DOM measurements, registry bounds, inferred geometry and animation effects each describe part of an element's position. The editor can consequently agree with its own selection rectangle while disagreeing with the actual rendered element.

**Recommendation:** repair the immediate cache/lifecycle/lock defects, then introduce a shared frame evaluation and explicit geometry contract. Keep Remotion, the registry, independent drawing objects, and the separation of editor overlays from export. Do not add another renderer or a generic editor framework to solve this.

## Scope and evidence

Reviewed the current canvas pointer flow, overlay, pure geometry, registry and component contracts, base/motion/trading adapters, clip mutation/history, migrations and validation boundaries, and existing relevant tests. Read the required specification, architecture, decisions, roadmap and quality documents. SC-01 (manual lesson with chart, lines, zone, arrow and title) is the relevant creator scenario; its complete workflow was not executed.

The working tree already contained edits in 19 files, including the preview, overlay and drawing migration. Those files were preserved. Findings apply to this checkout, not exclusively to committed HEAD. No production implementation was changed by this review. New files are this report and its isolated diagnostic suite.

Evidence levels below distinguish executed diagnostics from source inspection. The UI diagnostic mounts the **actual PreviewPanel and SelectionOverlay**, with a mocked Player, controlled DOM rectangles, requestAnimationFrame and ResizeObserver. It proves the editor's cache/overlay behavior; it does not reproduce browser layout or video rendering. There was no interactive Chromium session, real-pointer browser reproduction, screenshot comparison, or export run in this review.

## Findings at a glance

P1 = address before building further manipulation behavior; P2 = correctness/extension defect to resolve in the same subsystem redesign.

| ID | Priority | Finding | Classification | Evidence |
|---|---|---|---|---|
| EL-01 | P1 | Measured boxes freeze when the measured-element count is unchanged | Implementation | UI diagnostic + pick diagnostic |
| EL-02 | P1 | Picking and handles do not share the rendered frame's pose | Architecture + implementation | Effect/geometry diagnostic + source |
| EL-03 | P1 | Inactive clips can intercept the canvas; inactive selection handles remain | Implementation / missing shared eligibility rule | Pick diagnostic + source |
| EL-04 | P1 | Locking does not protect selected handles, group members or mutation commands | Implementation / command boundary | Store diagnostic + source |
| EL-05 | P1 | Element props are not validated by the registration/load/edit contract | Architecture | Malformed-load diagnostic + source |
| EL-06 | P1 | Project HTML reaches the editor DOM with executable event attributes | Implementation / trust boundary | DOM attribute diagnostic + source |
| EL-07 | P2 | Vertical trendlines/arrows acquire an undeclared axis constraint | Implementation / geometry inference | Drag diagnostic |
| EL-08 | P2 | Several declared handles have no corresponding editing/render behavior | Implementation + capability contract | Wrap diagnostics + source |
| EL-09 | P2 | Optional edit declarations do not have the documented box fallback | Implementation / contract inconsistency | Registry diagnostic |
| EL-10 | P2 | Multiple size/geometry authorities produce incompatible resize behavior | Architecture + implementation | Source inspection |

## EL-01 — Measurements freeze, leaving selection and picking behind

Sources: [PreviewPanel.tsx:261](../../../apps/studio/src/components/PreviewPanel.tsx#L261), especially line 289; [geometry.ts:204](../../../packages/editor/src/geometry.ts#L204).

The measurement effect builds a new map, then executes:

```ts
if (previous.size === next.size) return previous;
```

Moving or resizing usually preserves the number of rendered elements. The comparison below this return is therefore bypassed on precisely the normal update path. `frameFor()` gives a supplied measurement precedence over the new props. The same stale map feeds both the overlay and the pick list.

Executed example: start a 100×100 shape at `(300,200)`, flush its initial measurement, then change its props to `x=800,width=200` and flush another measurement. The overlay remains `left=250,width=100`; the expected box is `left=700,width=200`. With that stale map the canvas misses at `(800,200)` and still picks the element at `(300,200)`. Dragging uses `updateClipProps`, the same mutation used in this diagnostic. This explains the reported symptom without requiring accumulated pointer deltas or a Remotion bug.

Removing only the early return is insufficient: the remaining equality check compares width/height but never left/top. An equal-size translation would still be discarded. Same-count replacements can also leave measurements associated with obsolete clip identities.

Small repair: compare IDs and every stored coordinate, and invalidate stale entries. Stronger repair: cache only content layout size where it is actually needed; derive position from current evaluated geometry. A position change must never depend on a successful DOM remeasurement.

Requirement impact: EM-004, EM-006, EM-007, CH-007, OB-012.

## EL-02 — The editor does not evaluate the rendered pose

Sources: [composition.tsx:61](../../../packages/video/src/composition.tsx#L61), [composition.tsx:132](../../../packages/video/src/composition.tsx#L132), [PreviewPanel.tsx:263](../../../apps/studio/src/components/PreviewPanel.tsx#L263), [geometry.ts:292](../../../packages/editor/src/geometry.ts#L292).

The compositor applies `computeEffectStyle()` translation, scale, rotation and perspective at the clip-relative frame. `elementRegion()` has no frame argument and works from static props. The measurement path reads the transformed DOM rectangle's width/height, discards its actual left/top, and reconstructs a centered box at static `props.x/y`.

Executed example: a transform effect translates a shape by 500 pixels. Effect evaluation returns `translateX=500`, but geometry still hits the original anchor and misses the rendered anchor. The cache repair in EL-01 cannot fix this. Rotated elements have a related problem: an axis-aligned DOM bounding rectangle is not an oriented shape and cannot supply the inverse transform needed for correct handle drags.

The measurement effect also runs only on project/frame changes. Asynchronous font or media layout and stage resizing have no dedicated content-measurement invalidation. The overlay watches its own size, but that does not refresh the measured content map.

Required design: share a frame evaluation containing local geometry and local-to-composition pose. Use the pose for rendering, selection and hit testing, and its inverse for pointer conversion. Define whether animated objects are edited at the displayed pose and how that writes base properties or animation data. Keep projected appearance, layout bounds and pick geometry distinct. Perspective effects need an explicit supported editing policy rather than an assumed 2D inverse.

Requirement impact: EM-002, EM-004, EM-007, OB-008, determinism and the common scene evaluation contract. This is an editor-to-visible-content mismatch, not evidence that preview and export currently render different video frames.

## EL-03 — Clips outside their lifetime can steal clicks

Sources: [canvas-hit-test.ts:124](../../../apps/studio/src/components/canvas-hit-test.ts#L124), [selection-overlay.tsx:65](../../../apps/studio/src/components/selection-overlay.tsx#L65), [composition.tsx:198](../../../packages/video/src/composition.tsx#L198).

`pickableClips()` filters hidden and locked clips but accepts no frame and never checks `[from,from+durationInFrames)`. Remotion's Sequence does enforce that range. Inactive clips therefore retain estimated geometry and participate in topmost picking, even when no DOM measurement exists.

Executed example: two overlapping shapes, one active from frame 0 and a later clip starting at 100. Picking at the visible shape's center returns the future clip. Expired clips have the same structural problem. The overlay also filters only for an existing clip/edit/region, so timeline selection can expose handles outside the element's visible interval.

Repair: a shared frame-aware eligibility rule and current frame in pick-list cache dependencies. Keep timeline selection available for inactive objects, but distinguish it from canvas handles and canvas manipulation. Preserve the existing topmost order among eligible objects. Specify zero-opacity/clipped-object policy separately; do not accidentally make opacity the only way to determine lifetime.

Requirement impact: OB-002, OB-010, EM-005, CH-007.

## EL-04 — Lock protects initial picking, not editing

Sources: [store.ts:978](../../../packages/editor/src/store.ts#L978), [store.ts:611](../../../packages/editor/src/store.ts#L611), [selection-overlay.tsx:65](../../../apps/studio/src/components/selection-overlay.tsx#L65), [PreviewPanel.tsx:447](../../../apps/studio/src/components/PreviewPanel.tsx#L447).

Locking a clip leaves its selection intact. The overlay does not filter `locked` or `hidden`, and its pointer handler directly calls `updateClipProps`, which does not enforce a lock. Group selection expands IDs and the whole-selection body drag collects origins without a lock check, so dragging an unlocked group member can move a locked member. The inspector likewise continues to expose writable controls.

Executed: lock a selected shape; it remains selected and is excluded from initial picking, but `updateClipProps` still changes its position. Source inspection confirms that selected handles call that same unguarded method.

Repair: define mutation permissions centrally for user edit commands; filter canvas eligibility independently of selection. Allow explicit unlock and internal migration operations without opening a bypass for UI mutations. Filter locked members when creating a manipulation transaction. Hidden objects may remain editable in the inspector if that is the intended policy, but should not have invisible canvas handles.

Requirement impact: OB-004, OB-015; `Clip.locked` documents protection from editing as well as picking.

## EL-05 — The registry does not enforce typed, validated props

Sources: [contract.ts:1](../../../packages/core/src/contract.ts#L1), [contract.ts:181](../../../packages/core/src/contract.ts#L181), [schemas.ts:107](../../../packages/core/src/schemas.ts#L107), [project-migrate.ts:42](../../../packages/components/src/project-migrate.ts#L42), [project-migrate.ts:857](../../../packages/components/src/project-migrate.ts#L857).

`ComponentProps` and `Clip.props` are `Record<string,any>`. A definition supplies no props validator. Loading checks project scalar facts, component existence and an upper props-version bound, but carries component props through. Zod domain validators do exist; their existence does not validate every registered component at this boundary. Even the general clip schema accepts an unknown-valued prop record.

Executed: loading a current-version shape with `x:'wrong',width:-100,height:'wrong'` succeeds unchanged. Adapters then use these values as CSS/SVG inputs or convert them with `Number()`. Invalid data can consequently produce invisible content, invalid geometry or render failures instead of an actionable load error. Partial props also encounter different defaults behavior in geometry and render adapters.

Repair: each definition owns a typed props validator and explicit migration steps. Migrate legacy input, validate the migrated component props, then normalize defaults once into a validated snapshot. Validate mutations through typed commands. Preserve the original document and report invalid known fields; do not silently coerce or discard them. Unknown extension fields can still be preserved under the documented compatibility policy.

Requirement impact: ADR-003 component protocol, CPT-006, PR-010 and the strict validated domain-data convention.

## EL-06 — Imported HTML is active content in the editor origin

Sources: [adapters.tsx:513](../../../packages/components/src/base/adapters.tsx#L513), [project-migrate.ts:68](../../../packages/components/src/project-migrate.ts#L68).

`HtmlAdapter` assigns project-controlled `props.html` directly to `dangerouslySetInnerHTML`. No sanitizer or sandbox boundary was found in the reviewed source. The Player is rendered within the editor document; `pointerEvents:none` is not a script-execution boundary.

The diagnostic renders a harmless button and verifies that its raw `onclick` attribute survives. It deliberately does not invoke the handler. In a normal browser without a blocking CSP, such event attributes can execute when their events occur; media error/load attributes also do not require clicking. This creates a path from opening an untrusted project to active content in the editor origin. A full browser exploit and its available privileges were not tested. Merely rejecting `<script>` tags would not address this path.

Repair before treating project files as safe: support a constrained, validated HTML/SVG subset with sanitization and resource rules, or remove/disable this element for untrusted project input until that capability is designed. A sandboxed iframe would need a Remotion preview/export compatibility design; do not adopt it as a presumed drop-in fix. A sanitizer dependency, if chosen, needs the repository's normal dependency review.

Requirement impact: PR-005 and COMPONENT_CONTRACT invariant “No executable code in project files.”

## EL-07 — Geometry accidentally creates behavioral constraints

Source: [geometry.ts:478](../../../packages/editor/src/geometry.ts#L478).

`pointDrag()` treats any pair of endpoints with the same x coordinate as a vertically constrained line. A trendline or arrow that happens to be vertical can no longer move an endpoint sideways. Its shape becomes a hidden editing mode.

Executed: `(100,100)→(100,300)`, drag the first endpoint to `(250,120)`; the stored result is `(100,120)`.

Repair: remove the inferred constraint for free endpoints. If future tools need axis constraints, declare them in the element's geometry/edit capability, or apply a documented modifier-key constraint. The user’s current coordinates must not decide what kind of tool it is.

Requirement impact: EM-001, EM-002, OB-005, OB-012.

## EL-08 — Declared handles promise behavior that does not exist

Sources: [definitions.ts:56](../../../packages/components/src/base/definitions.ts#L56), [geometry.ts:457](../../../packages/editor/src/geometry.ts#L457), [adapters.tsx:169](../../../packages/components/src/base/adapters.tsx#L169), [scenes.tsx:436](../../../packages/components/src/base/scenes.tsx#L436).

Content elements declare four side wrap handles, but north/south return `null` unconditionally. Counter handles write `maxWidth`, but CounterAdapter never uses it and keeps `whiteSpace:'pre'`. NodeTrail similarly declares font/wrap behavior despite rendering a path anchored in a zero-size root; its `maxWidth` is not a layout input. A corner's font-size change only affects its labels, not the path's geometry.

Executed: dragging the declared north text handle produces no patch; rendering a counter with `maxWidth=40` sets no max-width style and remains unwrapped.

Repair: expose only meaningful handles. Represent counter/text layout capabilities explicitly. Give NodeTrail path-derived bounds that include nodes/labels, and distinguish label font editing from whole-path scaling. A registry contract test should verify each declared handle's patch is valid and has the promised rendered effect, not merely assert that the handle is listed.

Requirement impact: EM-002, EM-003, EM-007. The specification currently lists some of these handles itself; correct the design and implementation together rather than preserving inert controls to satisfy the list.

## EL-09 — Missing edit metadata silently disables selection

Sources: [contract.ts:134](../../../packages/core/src/contract.ts#L134), [geometry.ts:301](../../../packages/editor/src/geometry.ts#L301).

The contract and EM-001 promise plain box behavior when optional `edit` is absent. `elementRegion()` instead returns `null` immediately. Executed: temporarily removing shape's edit metadata removes its region entirely.

This is currently masked because the pickable catalogue declares edit metadata, but makes a newly registered or adapted element silently unselectable.

Repair: distinguish explicit `not-on-canvas` capability from omitted metadata. Apply a documented box fallback to content elements, and exclude audio/background through an explicit capability/render mode. Validate registration so accidental omissions fail visibly.

Requirement impact: EM-001 and the component extension contract.

## EL-10 — Geometry and resizing have several competing authorities

Sources: [canvas-hit-test.ts:59](../../../apps/studio/src/components/canvas-hit-test.ts#L59), [geometry.ts:108](../../../packages/editor/src/geometry.ts#L108), [geometry.ts:204](../../../packages/editor/src/geometry.ts#L204), [geometry.ts:396](../../../packages/editor/src/geometry.ts#L396), [scenes.tsx:100](../../../packages/components/src/base/scenes.tsx#L100), [contract.ts:97](../../../packages/core/src/contract.ts#L97).

`clipGeometry()` uses registry `bounds`, while the primary `elementRegion()` does not consult that callback. Instead it infers dimensions from handle prop names and data fields, or uses DOM measurements and text estimates. Render adapters derive actual dimensions separately.

Concrete mismatch: IsoCity's geometry estimate is a square `gridSize*tileSize`; its renderer uses width `(2*n+1)*tileSize` and height `n*tileSize+buildingHeight+tileSize`, clamping `n` to 2…9. Its corner drag changes both gridSize and tileSize using square-root scaling and moves the anchor using the requested rectangular dimensions. Even with fresh measurements, a single scalar/square-sized element cannot generally satisfy an arbitrarily stretched rectangular target. Similar shape variants render dimensions differently: a circle uses `min(width,height)` and a triangle is driven by width.

Additionally, `propsVersion>=3` globally means “absolute points” inside geometry, even though props versions belong to individual component schemas. A future unrelated component reaching version 3 would inherit drawing coordinate semantics. This is extension debt, not a demonstrated current-catalogue failure.

Repair: make geometry and resize semantics component-owned typed declarations. Declare aspect constraints and which quantity a corner changes. Rendering and editing consume the same resolved dimensions. Normalize legacy coordinate conventions in migration; runtime geometry must not infer coordinate space from a catalogue-wide version threshold.

Requirement impact: EM-001, EM-003, EM-009 and ADR-003's common component protocol.

## Recommended architecture

Retain the component catalogue, source-owned motion adapters, independent drawing lifecycles, deterministic market functions, Remotion composition and editor-only handles. Their boundaries are useful. The issue is the incomplete data shared across them.

Introduce one pure evaluation pipeline:

```text
validated project snapshot + scene frame
  → active clips in render order
  → resolved props + component evaluation + animation pose
  → local geometry + composition transform + capabilities
     ├─ Remotion renderer
     ├─ canvas picker (inverse-transform the pointer)
     └─ selection/handles (transform local geometry forward)
```

Proposed contracts, to turn into a scoped design before implementation:

1. **Validated element instances.** A discriminated component-to-props mapping, per-component validator, defaults normalization and versioned migration. Separate serializable domain metadata from React render/inspector bindings where needed to keep core pure.
2. **Explicit geometry variants.** Box, segment, point and content/path geometry with declared coordinate space, intrinsic layout origin, actual local bounds and resize constraints. Use one geometry source for body picking and handle placement. Avoid inferring an element's meaning from field names or collinearity.
3. **Frame pose.** Shared transform/effect evaluation used by composition and editor. Authoring geometry and visible pose are related by explicit transforms. Distinguish paint overflow from layout/pick bounds. Document policies for clip masks, full transparency and perspective.
4. **Content-layout service.** Measure only content that needs layout knowledge, in its untransformed local space. Cache by clip/content/style/wrap/font or asset revision, not by rendered-element count. Observe font/media readiness and layout changes. Derive placement from current pose rather than storing screen rectangles as scene truth. Do not add DOM reads to deterministic rendering or persist transient measurements as domain geometry.
5. **Manipulation transactions.** Begin with immutable originals, target IDs, current pose and pointer transform; update from that baseline; commit one undo command on an actual change; cancel or explicitly finalize on pointer cancellation/capture loss. Re-check locks and target existence. Group drags should apply one atomic patch set.
6. **Validated registry capabilities.** Explicit canvas participation, meaningful handles, constraints and mutation permissions. Fail on duplicate registrations and invalid handle references rather than silently replacing definitions or exposing inert grips.

This is a contract refactor across core/components/editor/video plus a smaller shell. It does not require new empty packages, another animation implementation, mandatory services or a second video runtime. Breaking schema changes are reasonable at this stage, but retain non-destructive migration and original-document recovery.

## Suggested sequence and acceptance gates

| Slice | Deliverable | Gate |
|---|---|---|
| A — Correctness repair | Fresh measurements; frame-aware picking; locked/hidden canvas filtering; remove accidental vertical constraints | Regression for move/resize/reselect and a full drag undo, plus exact lifecycle boundaries |
| B — Geometry design | Agree geometry/pose/measurement ownership, animated-edit semantics, capabilities and migration | Reviewed contract with worked examples for shape, text, arrow, position, chart and NodeTrail |
| C — Shared evaluation | Renderer, picker and handles consume the same frame pose and geometry | Translated/scaled/rotated element remains selectable at beginning/middle/end and direct seeks |
| D — Commands and validation | Typed validated props, central edit permissions, atomic gesture transactions, safe HTML policy | Malformed imports rejected; lock/group/cancel/undo tests; storage/migration round trips |
| E — Catalogue audit and browser proof | Reconcile every declared handle and dimension with rendering; add browser coverage | SC-01 manipulation subset in Chromium; full creator workflow separately; real render gate and preview/export still comparisons |

Slice A is a limited repair, not a replacement for B/C. Do not expand into new trading features while geometry still has multiple authorities. This sequence is a recommendation, not implementation approval.

Minimum regression matrix:

- Move a box and text beyond the old rectangle, deselect, then pick and drag at the new visible location. Old location must miss. Repeat resize, duplicate, undo/redo and same-count clip replacement.
- Seek to `from-1`, `from`, `out-1`, `out` with overlapping clips. The rendered and pickable lists must agree. Reversing seek order must not alter results.
- Repeat animated movement, scale and rotation at fitted scales 0.25, 1 and 4; handles remain on the evaluated geometry and tolerances stay in screen pixels.
- Select, lock, and attempt a handle drag and group drag; locked props stay unchanged. Hiding removes canvas handles. Unlock remains available from the timeline/inspector.
- Drag free endpoints through vertical/horizontal alignment; every declared grip produces its promised behavior. Test size/aspect limits using actual component geometry.
- Change text, font, wrap and font readiness; resize panels; verify the measured layout updates without moving the anchor or depending on prior seeks.
- Cancel or lose pointer capture during body and handle drags; one coherent outcome and undo transaction. Existing body dragging has no `onPointerCancel`/`onLostPointerCapture` handler; treat interruption recovery as an untested follow-up risk.
- Load malformed component props and active HTML input; verify clear, non-destructive rejection or sanitization. Then save/reopen a valid migrated project and verify equivalent geometry.

## Verification actually executed

| Command | Observed result |
|---|---|
| `pnpm exec vitest run --config docs/reviews/evidence/vitest.config.ts` | Did not run tests: Corepack attempted pnpm 10.28.2 download; DNS/network unavailable |
| `node node_modules/vitest/vitest.mjs run packages/editor/src/geometry.test.ts packages/components/src/registry.test.ts packages/components/src/project-migrate.test.ts` | 77 passed, 3 files |
| `node node_modules/vitest/vitest.mjs run` | 482 passed, 30 files |
| `node node_modules/vitest/vitest.mjs run --config docs/reviews/evidence/vitest.config.ts --maxWorkers 1` | 10 diagnostic assertions passed, 1 file |

The local Node runner needed execution outside the filesystem sandbox after an initial Windows `EPERM` realpath error. The first UI harness run failed because its Player mock did not resolve across workspace packages; the isolated config was corrected and the final ten-case run passed.

**Diagnostic assertions deliberately assert the observed defects. Their passing means the defects were reproduced, not fixed.** They live outside the normal suite include paths and must be converted into desired-behavior regression tests when repairs land. The Player/layout mocks are explicit limitations; the pure picking, geometry, mutation and load diagnostics call production functions directly. The HTML diagnostic inspects the surviving attribute only.

No typecheck, production build, real render verification, complete SC-01 workflow, browser export or pixel parity test was run. No claim of feature completion or video parity is made. This review changes documentation and diagnostic files only.

Evidence: [diagnostic suite](evidence/element-system.test.tsx), [isolated test configuration](evidence/vitest.config.ts).

## Repository/documentation discrepancies

- AGENTS says the repository is design-only; the checkout plainly contains the working implementation. This review inspected it without treating roadmap text as permission to implement features.
- README describes npm and a single `src/` tree; the checkout and current package manifests use the pnpm workspace. Follow the manifests/current architecture for reproduction.
- ADR-001/002 retain older Next.js/dnd-kit suggestions, superseded by the Vite shell and native pointer decisions. This report proposes neither dependency.
- EM-001 promises fallback behavior that the implementation omits (EL-09). EM-003 lists inert content handles (EL-08). Align the normative edit contract with the chosen corrected behavior.

## Completion record

Requirement IDs: EM-001…009; OB-002/004/005/008/010/012/015; CH-007; CPT-006; PR-005/010. SC-01 used as review context, not executed acceptance.

Affected package contracts: core component/clip/geometry types; components definitions/validation/render adapters; editor geometry/commands/selection; video frame pose; studio pointer/measurement layer. These are findings and proposed changes, not modifications performed.

Behavior and edge cases: ten findings above; immediate selection drift reproduced; lifecycle, lock, transforms, malformed props and handle semantics examined.

Tests executed and observed results: existing 482-case suite passes; isolated 10-case diagnostic suite reproduces defects.

Browser/platform tested: Windows, Node 24.20.0, Vitest 3.2.7, jsdom; no interactive browser validation.

Dependencies/licenses added: none. SQLite/schema/archive migrations: none. Preview/export visual evidence: none; controlled DOM evidence only.

Known limitations and follow-ups: report reflects a changing uncommitted checkout; no production fixes; proposed contract requires design approval, browser validation and render verification before implementation can be called complete.
