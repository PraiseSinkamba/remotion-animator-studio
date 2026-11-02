# Final whole-follow-up review

Controller closure: both task reviews and final review approved. Completed Task1 checkboxes
were reconciled after review; the two remaining minor assertion/logging suggestions are
nonblocking follow-ups. No production code changed after the recorded gates.

Durable records: [verification](evidence/drawing-handles-verification.md),
[Task1 report](evidence/drawing-handles-task-1-report.md),
[Task1 review](evidence/drawing-handles-task-1-review.md),
[Task2 report](evidence/drawing-handles-task-2-report.md),
[Task2 review](evidence/drawing-handles-task-2-review.md).

Controller decisions, in order:

1. Execute the requested follow-up without another approval pause; mistaken interpretation
   would cost reversible rework.
2. Reuse the existing repair branch/checkout to preserve prior work and dependencies;
   shared edits require coordination.
3. Treat horizontal/vertical lines as composition-spanning guides; a finite-line interpretation
   would require changing that behavior.
4. Include generic canvas-resize coordinate handling because unscaled left/absolute points
   would corrupt the new layout; this expands shared mutation coverage slightly.
5. Accept the final review's stated scope limits: complete creator/import/archive/SMT/MTF
   acceptance, arbitrary media/every-frame parity, cross-browser codecs, transport redesign,
   historical documentation cleanup and re-review of the predecessor repair remain separate.
   Those broader guarantees remain unverified by this follow-up.

Range: `f3b9d23..16d546b` (planning, Task 1 production/regressions, Task 2 browser/export evidence).
Binding design: `docs/superpowers/specs/2026-11-02-position-and-line-handles-design.md`.
Read-only review except this report; no source, index, HEAD or branch mutation. No subagents and no test/gate reruns.

### Strengths

- **The owner-requested behavior is integrated across paint and editing.** `packages/components/src/trading/drawings/purpose-geometry.ts:4` derives the position box from left/width and all three absolute levels, with a one-pixel collapsed minimum. `packages/components/src/trading/drawings/definitions.ts:354` declares exactly Target/Stop square and Entry/Width circle grips. `packages/editor/src/geometry.ts:431` changes only the dragged level's y while retaining its x and nested extensions; `:483` writes width alone. Body movement translates the authored origin, left and real stored points, excluding the virtual width grip (`:505`). The normal and zero-risk ratio paths are explicit (`packages/components/src/trading/drawings/adapters.tsx:363`).
- **The placement/pivot distinction fixes the actual architecture.** Optional plain geometry/composition context extends the common contract (`packages/core/src/contract.ts:32`, `:150`, `:267`). The compositor consumes that declaration and offsets CSS transform-origin from the paint placement (`packages/video/src/composition.tsx:76`, `:146`). The editor supplies the same actual composition size and shared pose (`packages/editor/src/geometry.ts:185`, `:233`). Geometry remains pure TypeScript; the new helper has no DOM, editor state, network or browser I/O. Components without declared placement retain the existing layout path.
- **Lines remain declaration-driven.** Guides use full composition segments and one constrained center move grip (`packages/components/src/trading/drawings/purpose-geometry.ts:19`, `packages/components/src/trading/drawings/definitions.ts:250`). Axis constraints are generic metadata consumed by shared movement code (`packages/editor/src/geometry.ts:528`). The overlay draws outlines only for box picks (`apps/studio/src/components/selection-overlay.tsx:158`); trendline/arrow keep two endpoint grips and rectangle keeps its four scale corners. No new component-kind dispatch appears in shell picking or manipulation.
- **Creation, resizing and migration were treated as part of the same geometry contract.** `packages/core/src/registry.ts:32` translates absolute default points and declared scalar coordinates when centering a new positioned instance; drawing factories supply left (`packages/editor/src/drawings.ts:100`, `packages/editor/src/store.ts:1040`). Project resize scales absolute points and declared coordinates while preserving nested data and locked clips (`packages/editor/src/store.ts:365`). Position props become version 4 after legacy conversion; the project schema remains 4 and other drawings remain props 3 (`packages/components/src/project-migrate.ts:739`, `:946`). Frozen legacy defaults, invalid supplied values, old/current project versions, nested extensions, input immutability and idempotence have focused regressions (`packages/components/src/position-migrate.test.ts:11`).
- **The existing safety boundaries remain connected.** Actual body and handle handlers use immutable gesture baselines and live lifetime/lock eligibility; store prop batches retain validation and lock guards (`apps/studio/src/components/PreviewPanel.tsx:531`, `apps/studio/src/components/selection-overlay.tsx:123`, `packages/editor/src/store.ts:649`). The new width/level paths do not introduce storage access or an independent renderer. The approved resize expansion is justified integration work, documented in the ledger and covered by a nonuniform resize/undo regression (`packages/editor/src/store.test.ts:46`).
- **Acceptance evidence crosses real boundaries.** The trusted Chromium pointer gate checks the actual app, genuine SQLite OPFS reopen/migration, and real Remotion static/posed stills (`scripts/verify-drawing-handles.mjs:26`, `:125`, `:144`). Paint masks, three individually sampled strokes, and selected/clean/export grip neighborhoods make the export assertions substantive. Evidence is plainly synthetic and its limits are recorded.

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

- None found.

#### Minor (Nice to Have)

1. **Complete the symmetric posed invariant assertion.** `scripts/verify-drawing-handles.mjs:121` verifies the posed Entry change and target invariance, but does not explicitly verify stop invariance before undo. Add an assertion against the captured prior stop point. Static browser assertions (`:76`) and the pure/actual-DOM regressions already cover fixed TP/SL, so this is a narrow evidence improvement rather than a production blocker.
2. **Keep expected warnings distinguishable from regressions.** `packages/video/src/provenance-sidecar.test.ts:62` deliberately emits the malformed-input warning; `docs/reviews/evidence/drawing-handles-verification.md:83` also records pre-existing build and Remotion warnings. Capture/assert the intentional negative-test warning, and track unexpected runtime/build warning cleanup separately. These warnings are disclosed and do not originate in this follow-up's production delta.
3. **Reconcile the completed task's checklist.** `docs/superpowers/plans/2026-11-02-position-and-line-handles.md:45` leaves Task 1's five steps unchecked, although its report, approved review and ledger record completion. Mark those steps from the observed evidence so the durable plan does not imply unfinished implementation. This does not affect runtime readiness.

### Verification reviewed

- Read the supplied whole-range review package in passes, recovering truncated sections, and inspected concrete migration, renderer/pose, drawing inspector, creation/resize, gesture and mutation callsites for the cross-contract risks above.
- Read Task 1/2 briefs, reports, independent approved reviews, the progress ledger, binding design/plan and applicable architecture/component/functional contracts. The prior element repair remains its own previously reviewed scope.
- Inspected existing Task 2 logs: Vitest ends with **637 tests/38 files passed**; forced typecheck ends with **6 successful/6 total, 0 cached**; production build ends successfully; drawing and element browser logs complete; R1 lists **six Main plus three AuthoredPath stills** and the complete **212711-byte MP4**. The MP4 exists with the recorded size. Reported command exit codes are historical implementer observations, not independently reconstructed from redirected logs.
- Inspected committed result JSON: actual SQLite OPFS backend, static and posed cases, completion `2026-11-02T16:04:23.995Z`, matching paint-mask extents, all level probes true, and all four selected/clean/export grip comparisons within their recorded limits.
- Viewed `out/drawing-handles/01-extended-levels-synthetic.png` and `out/drawing-handles/export-posed.png`: extended zones, four purpose grips, full-span guides, synthetic labeling and posed export without editor grips agree with the code and machine evidence.
- No heavy gate was repeated. The reviewed task reports and independent reviews disclose the browser coverage (.5/1 plus one posed tool), broader pure/DOM coverage (.25/1/4), unchanged schema/dependencies and lack of a lint script accurately.

### Declined to judge

- Complete SC-03 authoring/import/archive delivery and SC-08/SMT/MTF/no-lookahead release acceptance: this follow-up is explicitly the synthetic SC-03 drawing manipulation subset, and changes no market-data evaluator.
- Browser-side MP4 codec support on every browser and arbitrary media/font or every-frame raster parity: the recorded still comparisons and real R1 MP4 gate establish narrower claims only.
- Redesigning the floating transport's canvas occlusion behavior: pre-existing shell behavior, disclosed with actual target checks in the verification record; the approved task concerns drawing geometry and handles.
- Repository-wide cleanup of historical README/architecture status and technology prose: pre-existing documentation inconsistencies are outside this approved follow-up; its current normative component/functional/ADR additions were reviewed.
- Re-reviewing the entire predecessor element repair: that change already received independent review; this pass checked the relevant unchanged pose, eligibility, lock/history and validation seams for integration regressions.

### Recommendations

Retain the two approved task reviews and their evidence with this final report. The three minor items can be addressed independently without reopening the production geometry design or repeating unrelated heavy gates.

### Assessment

**Ready to merge? Yes.**

The complete follow-up matches the clarified entry-only/fixed-TP-SL behavior and integrates position, guides, segments and rectangle through generic declarations and the shared Remotion path. No blocking correctness, data-preservation, architectural or verification defect was found; remaining items are nonblocking assertion, logging and checklist improvements.
