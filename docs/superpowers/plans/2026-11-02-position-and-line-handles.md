# Position and Line Handles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make position and line manipulation match the owner's reference and eliminate clipped position levels.

**Architecture:** Component geometry declares paint placement separately from stable transform origin. Purpose-based handles and axis constraints remain generic editor capabilities. Position props migrate independently to version4; rectangle and other components retain their layout paths.

**Tech Stack:** Existing TypeScript/React/Remotion/Vitest/pnpm workspace, installed Chromium through Remotion. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-02-position-and-line-handles-design.md`; owner clarification in current chat: TP/SL fixed, entry/R:R changes.

## Global Constraints

- Exactly four position grips: target, stop, entry, width; entry moves only entry/R:R.
- Horizontal/vertical guides span the composition, move only y/x respectively, and pick along the full stroke.
- Trendline/arrow have two free endpoints; rectangle retains four scaling corners.
- No component-kind branches in shell picking or dragging; use declaration metadata.
- One Remotion composition and shared evaluated pose; no DOM/I/O in pure geometry.
- Preserve locked clips, half-open lifetimes, immutable gesture originals, atomic accepted edits and undo.
- Keep `docs/reference/` untouched. Preserve source revisions, unknown extensions and migration input.
- Work in current `codex/element-system-repair` branch; base f3b9d23 contains the completed previous repair. Do not revert it or touch its separate scratch workspace.
- Implementers never spawn subagents. Use direct installed Vitest and cached pnpm `C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs` when Corepack/sandbox blocks.

## Review Focus

- TP/SL can exceed former height without hidden paint or detached selection (Task1).
- Entry changes must not shift TP/SL; width must not shift the left edge or levels (Task1).
- Virtual width/guide points must never leak into persisted points during body drags (Task1).
- Non-default composition sizes and animated transforms must align renderer, picker and grips (Tasks1/2).
- Old sparse/partial position props and nested extensions must migrate without coordinate reinterpretation or silent loss (Task1).

## File responsibilities

Core contract/types/validation own optional geometry placement, composition context, handle capabilities and versioned drawing props. Components drawing geometry/definitions/adapters own position/guide semantics and paint. Editor geometry/drawing creation own generic drag operations and defaults. Video composition owns placement/CSS transform-origin wiring. Studio overlay owns grip appearance only. Integration script/docs own browser proof and normative contract updates.

---

### Task 1: Implement coherent position and line geometry with purpose handles

**Files:** Modify `packages/core/src/{contract.ts,elements.ts,validation.ts,registry.ts}` as needed; `packages/components/src/trading/drawings/{definitions.ts,adapters.tsx}` and new focused geometry helper; `packages/components/src/project-migrate.ts`; `packages/editor/src/{geometry.ts,drawings.ts}`; `packages/video/src/composition.tsx`; `apps/studio/src/components/selection-overlay.tsx`; relevant drawing inspector/factories and tests. Audit all position constructors/presets/fixtures for current props version.

**Interfaces:** Add optional `ComponentGeometry.placement?: EditBox`, geometry third argument `composition?: {width:number;height:number}`, optional render context geometry/composition; `ElementEditModel.moveAxis?: 'x'|'y'`, `translate?:{x?:string[];y?:string[]}`; generic width effect and optional named-point/appearance/label metadata. Keep existing APIs compatible; use declaration-owned pure helpers for actual geometry.

- [ ] **Step 1: Write regressions red.** Position fixture x=430,y=270,left=270,width=320, points entry(270,270),target(270,210),stop(270,330). Drag target to120 and stop to440: box top120,bottom440, both zones rendered. Entry to310 keeps TP120/SL440 and gives R≈1.461538; width to420 keeps left270 and all y values. Body delta(60,20) translates origin/left/points, no virtual width point stored. Exactly four purpose grips; only two endpoint grips for trendline/arrow; rectangle unchanged four corners. At project960×540, h/v pick far from center, span full width/height, and reject orthogonal drag deltas. Repeat tolerances at0.25/1/4 and use projected-after-patch assertions under scale/rotation. Add old-version migration/input immutability/idempotence/nested-extension tests, including out-of-box legacy levels.
- [ ] **Step 2: Run red.** Focused editor geometry, drawings, migration, components drawing render tests and actual overlay tests using installed Vitest; record actual expected failures before fixes.
- [ ] **Step 3: Implement shared contracts and behavior.** Position version4 adds left, retains absolute points/stable x/y origin, derives vertical paint bounds; migrate after legacy absolute conversion before normalization. Declare actual layout placement and explicit CSS transform-origin while keeping old paths for components without placement. Draw adapters consume the same computed geometry. Generic level drag preserves other levels/extensions; width-only grip writes width, named point supplies right-entry location. Body translation uses declared fields and actual stored points only. Add guide composition context/full segment and axis constraints. Style entry/width circular and TP/SL square with purpose labels. Keep entry/level overlap recoverable and ratio zero cases safe. Remove stale position height/technical-origin or guide orthogonal/length inspector fields; retain meaningful appearance and width controls. No kind dispatch in shell.
- [ ] **Step 4: Verify green.** Focused regressions and all six typechecks, then one full suite before commit. Verify direct drawing creation, legacy import and sparse defaults on non-default project sizes. Document exact new APIs and any narrow decisions in report.
- [ ] **Step 5: Commit** task files as `fix: align position and line handles with their geometry`.

### Task 2: Verify actual drawing workflow, exports and document contracts

**Files:** Create `scripts/verify-drawing-handles.mjs` (reuse installed Vite/Remotion/CDP/shared bundle helper); add integration tests only for uncovered behavior; update `docs/spec/{COMPONENT_CONTRACT.md,FUNCTIONAL_SPEC.md}`, relevant ADR/edit-model docs, plan/design and durable verification record under `docs/reviews/evidence/`.

**Interfaces:** Consume Task1's reported APIs and existing generic `elementRegion`, `handleAt`, `dragEffect`, store commands and shared renderer. No production globals for tests. Existing `scripts/verify-element-repair.mjs` remains a regression gate.

- [x] **Step 1: Add real browser assertions.** Synthetic position fixture with prior-box-extending TP/SL; trusted CDP handle drags verify actual zones/bounds, exact four grips and R:R entry-only behavior, left-fixed width and whole-body movement. Test full-span h/v near endpoints with one center grip/axis constraints, two-endpoint segment body picking and rectangle four corners. Exercise0.5/1scale and one posed position. Export stills and compare painted zones/levels with displayed geometry; handles absent from export. Save/reload/migrate position props4 using real app storage.
- [x] **Step 2: Run the workflow.** Record concrete failures, fix only in-scope integration glue or notify controller; do not relax constraints to hide failures. Capture labelled synthetic screenshots to `out/drawing-handles/` and durable result JSON under docs.
- [x] **Step 3: Run final gates.** Full Vitest; cached pnpm typecheck/build; `node scripts/verify-drawing-handles.mjs`; `node scripts/verify-element-repair.mjs`; `node scripts/verify-r1.mjs` (nine stills + full MP4). Every claimed gate must actually exit0. Inspect screenshots and representative exported stills.
- [x] **Step 4: Align docs.** Update position version/migration, four handles/entry-only semantics, full-span guide constraints, stable origin/layout distinction and actual verification results/limits. Preserve previous reports as historical evidence. Mark plan steps from observed completion only.
- [x] **Step 5: Commit** as `test: verify position and line manipulation in browser and export`. Independent task review and final whole-follow-up review follow; leave branch local.
