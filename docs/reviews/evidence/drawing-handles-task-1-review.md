### Spec Compliance

- ✅ Spec compliant for Task 1, base `58eaed2`, head `ac6b4bc`. Four purpose grips and translation fields are declared in `packages/components/src/trading/drawings/definitions.ts:354`; level-derived placement and virtual control points share pure calculations in `packages/components/src/trading/drawings/purpose-geometry.ts:4`; compositor placement preserves the authored pivot in `packages/video/src/composition.tsx:146`.
- ✅ Entry edits preserve the stored x and nested data while changing only y (`packages/editor/src/geometry.ts:431`); width writes only its declared scalar (`packages/editor/src/geometry.ts:483`); body movement uses stored points and declared scalar coordinates, excluding virtual grips (`packages/editor/src/geometry.ts:532`). Posed after-patch and whole-body regressions cover these contracts (`packages/editor/src/geometry.test.ts:550`, `packages/editor/src/geometry.test.ts:562`).
- ✅ Guides declare full-composition segments and constrained movement (`packages/components/src/trading/drawings/purpose-geometry.ts:19`, `packages/components/src/trading/drawings/definitions.ts:250`); generic axis constraints live in `packages/editor/src/geometry.ts:528`. Overlay rectangles are limited to box picks (`apps/studio/src/components/selection-overlay.tsx:158`), leaving segment endpoints and rectangle corner declarations compatible. No component-kind dispatch was added to shell picking or dragging.
- ✅ Position version 4 migration follows fractional-to-absolute conversion and independently respects clip props versions (`packages/components/src/project-migrate.ts:739`, `packages/components/src/project-migrate.ts:946`). Old defaults, out-of-box levels, nested extensions, invalid supplied values, immutability and idempotence have explicit regressions (`packages/components/src/position-migrate.test.ts:11`). New factory placement at 960×540 is covered in `packages/editor/src/store.test.ts:37`.
- ✅ The additionally authorized generic project-resize fix scales absolute points and declared extra scalar coordinates while retaining the existing locked-clip guard (`packages/editor/src/store.ts:376`). Its regression covers nonuniform project ratios, position origin/left/width/levels, guides, segment endpoints, nested point data, unchanged fractional data, input immutability and undo (`packages/editor/src/store.test.ts:46`). This is justified integration scope.
- ⚠️ Cannot verify from this diff: real Chromium pointer capture/hit targeting, preview/export raster parity, production build and complete Remotion still/MP4 gate. These are explicitly assigned to Task 2 (`.superpowers/sdd/2026-11-02-position-and-line-handles/task-1-report.md:59`). Automated markup/jsdom tests do not establish them.
- ⚠️ Lock/lifecycle eligibility, immutable gesture baselines and atomic rejected-change behavior rely substantially on unchanged surrounding infrastructure. No weakening appears in this task's diff; retain the existing regressions and include the relevant real browser workflow in Task 2.

### Strengths

- `packages/components/src/trading/drawings/purpose-geometry.ts:4` separates paint placement from transform origin without duplicating position bounds arithmetic across editor and renderer.
- `packages/editor/src/geometry.test.ts:531` asserts exact state changes, including preserved nested data and exclusion of the virtual width point, rather than merely checking that a drag returned a patch.
- `apps/studio/src/components/element-interaction.test.tsx:46` exercises actual preview/overlay pointer handlers at 0.25/1/4 zoom, grip purpose styling and accepted-edit history; the overlap regression verifies recoverable paint order.
- `packages/video/src/composition.test.tsx:15` checks actual compositor markup for placement, pivot, pose, nondefault composition spans and absence of editor grips. Its limits are accurately disclosed.

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

- None found.

#### Minor (Nice to Have)

- `packages/video/src/provenance-sidecar.test.ts:62` — The reported full suite emits an expected malformed-input warning (`.superpowers/sdd/2026-11-02-position-and-line-handles/task-1-report.md:46`). This is pre-existing test-output noise, not a regression in the reviewed diff. Capture and assert the expected warning in that negative-path test so unexpected warnings remain visible. Nonblocking for Task 1.

### Review Checks

- Read the supplied review diff; the tool truncated the middle of the initial display, so recovered only the omitted ranges. Did not fetch another git diff, rerun reported suites or mutate source/index/branch state.
- Completed cut-off function context only for migration orchestration, authored-region/posed-drag handling and drawing adapter placement. Named cross-contract risk: shared geometry must match the existing pose evaluator; inspected `packages/components/src/element-pose.ts:20` and confirmed explicit origin controls its projection.
- Named inspector risk: deleting generic parameters might leave stale custom controls; inspected `packages/components/src/trading/inspectors/drawing.tsx:38`, whose custom controls remain caption, appearance, direction and ratio visibility.
- Named boundary risk: guide declarations could accidentally contain stored points and take the unanchored segment translation path; inspected `packages/core/src/validation.ts:610`, which rejects points for horizontal/vertical guides.
- Named migration-version risk: checked `packages/components/src/project-migrate.ts:43` and the completed orchestration to confirm unsupported supplied versions still reject and fractional legacy points are not stamped current before conversion.
- Inspected the reported warning's existing negative-path test (`packages/video/src/provenance-sidecar.test.ts:62`); no tests executed during this review. The report records 637 passing tests and six successful uncached typechecks; those execution results were not independently regenerated.

### Assessment

**Task quality:** Approved.

**Reasoning:** The production delta implements the approved geometry and declaration contracts, with meaningful migration, pose, interaction and resize regression coverage. No blocking correctness or maintainability defect was found; overall feature acceptance remains dependent on Task 2 browser/build/render evidence.
