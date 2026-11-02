# Element System Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Resolve all ten element review findings and make rendered geometry, selection and editing agree.

**Architecture:** Components declare geometry and validated props; shared frame-pose evaluation feeds Remotion and canvas manipulation. Local content measurement supplies size only. User commands enforce locks and atomic gesture history.

**Tech Stack:** pnpm workspace, strict TypeScript, React, Remotion 4.0.538, Vitest/Testing Library, core-owned Zod 4.5.4; parse5 7.3.0 only if adopted under the design.

**Spec:** `docs/superpowers/specs/2026-11-02-element-system-repair-design.md`; findings EL-01…EL-10 in `docs/reviews/2026-11-02-element-system-review.md`.

## Global Constraints

- Rendering stays one Remotion composition.
- Keep `docs/reference/` untouched.
- Zod stays inside core.
- Preserve extension fields and original input. No silent destructive repair.
- Coordinate space is explicit metadata, never inferred from a component's props-version number.
- Body and handle drags update from immutable originals. One changed gesture creates one undo step; a click creates none.
- Cancellation/capture loss finalizes the last applied valid state and clears the gesture. Multi-object movement is atomic.
- No new project schema version is required if only runtime metadata changes.
- Preserve the checkpointed user baseline; no reverting unrelated changes, pushing, merging or publishing.
- Implementers never spawn subagents. Reviews are dispatched by the controller.
- Use installed tools directly when Corepack cannot run: `node node_modules/vitest/vitest.mjs`, `node node_modules/typescript/bin/tsc --noEmit -p <package>/tsconfig.json`. A cached pnpm is at `C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs`.

## Review Focus

- Same-count move/resize/replacement must invalidate stale geometry (Task 1).
- Inactive/hidden/locked members of a selection must not receive canvas mutations (Task 1).
- Non-centered paths, zero-size roots, scalar dimensions and late font loads must retain correct geometry (Tasks 2/3).
- Rotated, projected or singular animated poses must use forward/inverse transforms consistently (Task 3).
- Legacy/partial documents and malicious HTML must remain recoverable without executing active content (Task 4).

## File responsibilities

- `packages/core/src/contract.ts`, `registry.ts`, `validation.ts`: plain typed metadata/validation and registration rules.
- `packages/editor/src/geometry.ts`: authored geometry and handle effects; `store.ts`: permissions and atomic mutations.
- `packages/components/src/base/definitions.ts`, `base/adapters.tsx`, `base/scenes.tsx`, trading/motion definitions: actual component geometry/capabilities and rendering.
- New `packages/components/src/element-pose.ts`: shared frame effects and projected coordinate mapping.
- New `apps/studio/src/components/content-measurements.ts`: local content layout only.
- `apps/studio/src/components/PreviewPanel.tsx`, `selection-overlay.tsx`, `canvas-hit-test.ts`: event coordination and presentation using the contracts.
- New component validation/safe-HTML modules beside their owners; new focused tests beside each behavior.

---

### Task 1: Repair stale geometry, lifecycle and manipulation permissions

**Files:** Modify `apps/studio/src/components/{PreviewPanel.tsx,selection-overlay.tsx,canvas-hit-test.ts}`, `packages/editor/src/{geometry.ts,store.ts,index.ts}`; create regression tests beside these files and `apps/studio/src/components/content-measurements.ts` if the measurement extraction is needed. Own EL-01/03/04/07/09.

**Interfaces:** Preserve existing callers with optional `sceneFrame` where necessary; produce `pickableClips(project, measured?, sceneFrame?): PickableClip[]`, shared `isClipActive(clip, sceneFrame): boolean`, and `updateClipsProps(patches: ReadonlyArray<{clipId:string;patch:Record<string,unknown>}>): void` for atomic unlocked edits. Implementers may add a focused measurement helper but must document its exported signature in the report for Task 3.

- [x] **Step 1: Write failing regressions.** Test actual preview move `x:300→800` on a 100px shape and resize to 200px: overlay left=700,width=200 and old position misses. Test equal-size move and same-count ID replacement too. For overlapping clips test `from-1/from/out-1/out`, hidden/locked selected handles absent, locked group members unchanged, cancelled gestures clear, unchanged handle click adds no history. Test vertical endpoint `(100,100)→(100,300)` dragged to `(250,120)` stores `(250,120)`. Test missing edit on content falls back while audio/background stay excluded.
- [x] **Step 2: Run focused tests red.** `node node_modules/vitest/vitest.mjs run apps/studio/src/components/element-interaction.test.tsx packages/editor/src/geometry.test.ts packages/editor/src/store.test.ts`; record actual failures.
- [x] **Step 3: Implement correctness repairs.** Store measured local sizes or compare all fields/IDs without the faulty count return; derive current anchors. Share frame eligibility, enforce locked edits in store and group target collection, add atomic patches and cancellation/capture-loss finalization. Defer handle history until first changed patch. Remove collinearity inference. Make edit fallback explicitly exclude non-content render modes.
- [x] **Step 4: Verify green and typecheck touched packages.** Same tests must pass; add frame cache invalidation tests and use observer cleanup to avoid leaks. Run full suite once before commit. Defect-asserting review diagnostics are historical and not part of the normal suite.
- [x] **Step 5: Commit** only task files as `fix: keep canvas selection coupled to editable active elements`.

### Task 2: Make component geometry and meaningful handles authoritative

**Files:** Modify `packages/core/src/{contract.ts,registry.ts}`, `packages/editor/src/geometry.ts`, `packages/components/src/base/{definitions.ts,adapters.tsx,scenes.tsx}`, trading/motion definitions and corresponding tests; `canvas-hit-test.ts` only to delegate existing legacy geometry API. Own EL-08/10 and registration validation.

**Interfaces:** Add explicit edit coordinate/resize metadata and component-owned geometry callback returning anchor, box/local origin and named points through core plain types. `elementRegion(clip,project,measured?)` consumes that declaration and registry `bounds` consistently; export `resolveEditModel(definition)` for fallback consumers. Keep existing Region API usable for Task 3 and document exact additions. No version-number coordinate inference.

- [x] **Step 1: Write failing contract/geometry tests.** Assert every catalogue declaration resolves valid handles; no n/s wrap handles; counter/NodeTrail have no unsupported wrap. Test NodeTrail non-centered waypoints and label extents; IsoCity n=2 and n=9 formulas; circle/triangle dimensions; scalar corner resize retains actual opposite corner; duplicate registration throws clearly without replacing original.
- [x] **Step 2: Run red.** `node node_modules/vitest/vitest.mjs run packages/editor/src/geometry.test.ts packages/components/src/registry.test.ts` plus new focused geometry tests.
- [x] **Step 3: Implement metadata and catalogue corrections.** Resolve dimensions via definitions instead of handle-key heuristics. Declare absolute points explicitly on drawings. East/west wrap for supported text/motion elements only; counter font corners only; NodeTrail movable region and inspector label-font control, no misleading scaling grips. IsoCity corner props=['tileSize'] with uniform resize and renderer-consistent clamped grid dimensions. Shape dimensions/constraints must match its rendered variant. Unknown optional edit gets box fallback. Reject invalid registration and use explicit replacement only in tests that restore a registry entry.
- [x] **Step 4: Verify green, affected render adapter tests and typechecks.** Include negative coordinates, non-square scalar drag and omitted/partial defaults. Run full suite once before commit.
- [x] **Step 5: Commit** as `refactor: derive editing geometry from component capabilities`.

### Task 3: Share evaluated animation pose across renderer and editor

**Files:** Create `packages/components/src/element-pose.ts` and tests, add export in index; modify `packages/video/src/composition.tsx`, `packages/editor/src/geometry.ts`, studio preview/overlay/hit-test/measurement helper and tests. Own EL-02 and architectural part of EL-01/10.

**Interfaces:** Produce `evaluateElementPose(clip:Clip,sceneFrame:number,fps:number): ElementPose`; ElementPose contains the existing computed effect style, `toComposition(point:Point):Point|null`, `toAuthored(point:Point):Point|null`, and `invertible:boolean`. Exact public Point and pose types belong in pure core or component module exports with no editor import. Preserve old clip-relative animation semantics. Add optional frame/pose arguments to geometry APIs without a second effect evaluator.

- [x] **Step 1: Write red pose and integration tests.** A 500px transform moves hit and handles by 500; rotated 200×100 rectangle hits inside oriented shape and misses an AABB-only corner. Test uniform scale, rotateX/Y with perspective=1200, singular scale/edge-on cases, absolute-point arrows around wrapper origin, inverse round trips and seek order. Repeat tolerance at 0.25/1/4 and body/handle pointer deltas at a fixed animated frame.
- [x] **Step 2: Run red.** `node node_modules/vitest/vitest.mjs run packages/components/src/element-pose.test.ts apps/studio/src/components/element-interaction.test.tsx` plus new posed-hit tests.
- [x] **Step 3: Implement shared pose and consumers.** Preserve CSS transform order and use projected-plane mapping/inverse for perspective. Video consumes the same effect evaluation. Overlay draws oriented geometry and projected grips; picker transforms geometry/pointers with constant screen-pixel tolerance. Inverse-map pointer edits to authored geometry. Skip singular manipulation. Content measurement reads untransformed local layout, measures only definitions needing it, and observes font/media/stage changes with cleanup; never store a transformed screen rectangle as authoring truth.
- [x] **Step 4: Verify green and video evaluation tests/typechecks.** Add late font/layout readiness and panel resize tests. Run full suite once before commit. Record supported projection behavior explicitly.
- [x] **Step 5: Commit** as `refactor: share frame pose between rendering and canvas editing`.

### Task 4: Validate component boundaries and render safe static HTML

**Files:** Modify core contract/validation/registry and tests, component definitions/project migration/render dispatch and tests, editor mutation/store tests; create focused `packages/components/src/base/safe-html.ts` and tests and component props-validation module if needed; package manifest/lockfile only for parser adoption. Own EL-05/06.

**Interfaces:** Plain `ValidationResult<T>` stays core-owned. Add a per-definition validation contract accepting unknown input and producing normalized props or field issues. Provide `normalizeComponentProps(definition,raw): ValidationResult<ComponentProps>` and use it after legacy conversion and before user mutation acceptance. Renderer/geometry consume normalized props consistently. Provide `sanitizeStaticHtml(source:string):string` via parser-based allowlist; authored source remains stored unchanged.

- [x] **Step 1: Write red boundary tests.** Current-version invalid shape `{x:'wrong',width:-100,height:'wrong'}` rejects with clip/path; partial legacy props obtain defaults without input mutation; valid current documents and all defaults roundtrip; unknown extensions survive. Test invalid nested chart/drawing points, nonfinite values, invalid lifetime/ID/version, and invalid mutation leaves project/history unchanged. Safe HTML strips event handlers, script/iframe/object/embed/form/SVG active content, javascript/data URL navigation, resource-loading CSS and remote src, while preserving safe formatted text and colors.
- [x] **Step 2: Run red.** Run focused new validation/safe-HTML tests and project-migrate tests with installed Vitest.
- [x] **Step 3: Implement validation and sanitization.** Zod implementation remains core-only. Definitions own typed validator metadata/callbacks; validate scalar types and meaningful size/range constraints plus nested domain schemas, without silently applying inspector min/max restrictions that invalidate existing presets. Use generics/unknown at new boundaries, add no new any. Full migrated document validates before use; version gates precede default normalization. User mutation errors surface through notice and retain original state. For HTML adopt already locked parse5@7.3.0 only with exact direct dependency and adoption record (license/browser/bundle/security/exit); no regex-only sanitizer. Static safe formatting is retained and rendered identically in preview/export.
- [x] **Step 4: Verify green, all presets/defaults/storage roundtrips and typechecks.** Run full suite once before commit; invalid imported props must fail early without mutating originals or losing extension fields.
- [x] **Step 5: Commit** as `fix: validate element props and isolate static HTML content`.

### Task 5: Integrate regression evidence, documentation and real rendering

**Files:** Update `docs/spec/{COMPONENT_CONTRACT.md,FUNCTIONAL_SPEC.md}`, design/plan checkboxes, review completion appendix, relevant ADR-010 text and `docs/quality/TEST_STRATEGY.md`; convert `docs/reviews/evidence/element-system.test.tsx` to correct-behavior assertions or replace it with pointers to permanent tests; add browser/render verification script/tests under `scripts/` only when they exercise the user workflow. Own complete EL-01…10 closure evidence.

**Interfaces:** Use all APIs documented by prior task reports. Preserve original review findings as historical evidence; append exact closure mapping. No unrelated feature implementation.

- [x] **Step 1: Add missing integration regressions first.** SC-01 subset: chart + title + rectangle + arrow, move past old bounds, deselect/reselect, resize, grouped locked member, seek boundaries, undo/redo, save/reopen and render at selected frames. Label synthetic data. Assert overlay is editor-only. Replace original diagnostic assertions that intentionally expected bugs.
- [x] **Step 2: Run focused integration tests red where a gap exists.** Report failures to controller rather than hiding them in docs; implement integration glue within this task or request the responsible implementer's fix.
- [x] **Step 3: Run final gates.** `node node_modules/vitest/vitest.mjs run`; `node C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs typecheck`; same prefix `build`; `node scripts/verify-r1.mjs`. Tests/typecheck/build exit 0; render must produce inspected stills and MP4. If cached pnpm is unusable call installed tsc/Vite for each package/app. There is no lint script; do not invent a passing lint result.
- [x] **Step 4: Produce browser/visual evidence and align docs.** Use installed Chromium automation if available (Remotion's existing browser helper/CDP is acceptable without a new dependency); demonstrate move/reselect and posed selection, inspect generated stills, compare preview and export geometry, and record platform/limitations honestly. Do not call the complete future SC-01 roadmap workflow implemented. Update normative handle/fallback/validation semantics and dependency record; preserve all source/license provenance.
- [x] **Step 5: Commit** as `test: verify element editing and render contract end to end`. Final broad independent review follows this task; address its findings in one coordinated fix wave.
