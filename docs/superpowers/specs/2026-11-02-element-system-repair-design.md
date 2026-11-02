# Element geometry and editing repair

The owner requested planning and execution of the ten findings in `docs/reviews/2026-11-02-element-system-review.md` on 2026-11-02. This document makes the implementation decisions for that authorized repair. Existing independent drawing semantics and non-destructive migrations remain binding.

## Required behavior

- An element's visible position, canvas hit region and handles agree after move, resize, seek, animation and content layout changes. An old location ceases to select the moved element.
- Canvas eligibility is `[from,from+durationInFrames)`, not hidden, not locked, and explicitly canvas-capable. Timeline selection remains possible outside that interval but exposes no active canvas handles.
- Lock is enforced at user-mutation boundaries, including selected handles and grouped movement. Internal loading/migration and explicit unlock remain available.
- Body and handle drags update from immutable originals. One changed gesture creates one undo step; a click creates none. Cancellation/capture loss finalizes the last applied valid state and clears the gesture. Multi-object movement is atomic.
- Missing optional edit metadata on content means box fallback; audio/background/transition objects explicitly do not participate. Registration rejects duplicate IDs and invalid handle declarations.
- Free segment endpoints remain free across vertical and horizontal alignment. Coordinate space is explicit metadata, never inferred from a component's props-version number.
- Handles describe real capabilities. Content wrapping has east/west grips only. Counter and NodeTrail have no wrap grips until their renderer supports wrapping. NodeTrail label-font grips are not presented as whole-path scaling; expose a moveable box and inspector label font control instead.
- Scalar-sized objects resize uniformly and retain the opposite corner under their actual geometry. IsoCity corners change `tileSize` only; gridSize remains a topology inspector setting. Bounds use the renderer's clamped grid and buildingHeight formula. Shape variants whose dimensions differ from width/height use their actual geometry and constraints.
- Every registered component has a props-validation contract. Load/migration and edit boundaries reject malformed known values with actionable paths; defaults normalize once for rendering and geometry. Preserve extension fields and original input. No silent destructive repair.
- HTML remains a useful static visual element but must not execute scripts, event attributes, navigation or fetch arbitrary resources from imported markup. Parse using a proper HTML parser, allow a documented static subset and safe style declarations, and render the sanitized result identically in preview/export. Preserve authored source; display safe output. No regex-only sanitizer.

## Geometry and frame evaluation

Local authoring geometry belongs to component definitions. Pure geometry must consult that declaration instead of re-deriving size from handle property names. Registry bounds and primary picking must agree. DOM measurements are untransformed local content sizes, never cached positions; only content-sized definitions use them. Repositioning derives fresh positions from current props. Invalidate measurements on content/font/media/layout changes, with observers that clean up and avoid update loops.

Effects retain the existing Remotion output and CSS transform order. A shared `evaluateElementPose(clip, sceneFrame, fps)` in components owns effect evaluation and transform mapping used by video and editor. Its result includes the existing effect style, forward/inverse point transforms and pose invertibility. For centered elements the transform origin is the anchor; unanchored absolute-point elements transform about their actual wrapper origin. Perspective/rotateX/rotateY use a projected plane transform and inverse; singular projections cannot be dragged. Do not pretend a rotated AABB is the element's body. Constant-distance screen tolerance is evaluated after the relevant transform.

Rendering stays one Remotion composition. The editor projects local geometry/handles using the shared pose, inverse-projects handle pointers and movement deltas, and writes authored base geometry without changing animation parameters. At a fixed displayed frame a drag tracks the pointer through the inverse pose. At zero/singular pose no canvas manipulation is offered. Ordinary clips retain current output; corrections to inaccurate element dimensions/unsafe HTML are intentional.

## Validation and dependency decisions

Zod stays inside core. Expose plain validation results, not Zod types, through registration. Component definitions declare validation metadata/callbacks for scalar and nested known props, including chart/drawing domain validation. Add generic typed validator interfaces; do not add new `any` or casts that merely claim unvalidated input is valid. Existing catalogue compatibility must be preserved while making malformed input fail before render/storage. Full-project validation must run after legacy conversion.

The HTML parser candidate is the already locked `parse5@7.3.0` (MIT). If adopted, declare it as an exact direct components dependency, document its local installed package metadata, browser support, bundle cost/tree-shaking, security boundary and replacement strategy, and update the lockfile with the local pnpm cache. A parser is not a sanitizer by itself: emit only the allowlisted output. No other new dependency is authorized without its required recorded adoption evidence.

## Verification

Regressions must assert correct behavior, replacing the review's defect-asserting diagnostics. Cover actual PreviewPanel/SelectionOverlay with controlled layout, pure production geometry, frame boundaries, locks/groups, pointer completion/cancellation, invalid input, safe HTML and all catalogue capability declarations. Include tests at fitted scales 0.25, 1 and 4 and seek-direction independence. Test rotated/projected poses against the actual video transform semantics.

Run the workspace tests, all package/app typechecks and production build, and `node scripts/verify-r1.mjs` (real stills and MP4). A browser-based SC-01 manipulation subset and preview/export comparison are required where runnable with installed Chromium tooling; record exact evidence and any environmental limitation. Synthetic data must be labelled. No claim of full SC-01/manual OHLC/import/archive features that are not implemented.

No new project schema version is required if only runtime metadata changes. If serialization must change, version it and test old/current round trips without input mutation. Keep `docs/reference/` untouched.

## Execution status — 2026-11-02

- [x] Geometry/lifecycle/lock/fallback repair with permanent correct-behavior regressions.
- [x] Component-owned geometry and meaningful handles.
- [x] Shared evaluated planar pose and camera visibility.
- [x] Runtime component validation and static HTML isolation.
- [x] Browser integration, actual preview/export comparison and real render evidence.

See [durable verification](../../reviews/evidence/element-repair-verification.md) for exact commands,
observed results, scope and limitations. The final broad independent review is controller-owned.
