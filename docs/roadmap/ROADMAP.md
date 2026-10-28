# Chart Studio — Creator-Ready MVP Roadmap and Agent Workstreams

**Status:** Proposed sequencing, not an authorized implementation plan.  
**Design edition:** 1.2 draft · **Date:** 2026-10-24  
**Depends on:** [Functional Specification](../spec/FUNCTIONAL_SPEC.md), [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md), [Test Strategy](../quality/TEST_STRATEGY.md), [Video Scenarios](../scenarios/VIDEO_SCENARIOS.md).

## 1. Delivery strategy

Deliver **working end-to-end slices** rather than separately implementing "all charts", "all timelines", "all UI" and "all exports". The early proof must establish that one React chart component can be edited, animated and exported through Remotion using a pure frame evaluator. Then add data integrity, multiple charts, MTF/SMT, creator media and project portability.

The roadmap is a dependency-aware sequence of release gates. It avoids calendar/date promises until the initial spikes establish performance and difficulty. Agent teams can work in parallel only where contracts are frozen; integration is performed after each slice.

### Workstreams

| Workstream | Owns | Primary packages |
|---|---|---|
| W1 Application/UX | dashboard, inspector, canvas tool overlays, project/scene navigation | `apps/studio`, `packages/ui`, `packages/editor` |
| W2 Trading domain | OHLC, manual series edits, MTF, SMT, coordinate transforms | `packages/core`, `packages/smt-mtf` (deferred) |
| W3 Video + component catalog | Remotion scene compositions, first-party trading video components, Remocn source-owned motion components, SVG visuals, keyframes, preview, export | `packages/components`, `packages/video` |
| W4 Storage | SQLite WASM worker, OPFS, migrations, assets, portable archive | `packages/editor` (storage), `packages/project-archive` (deferred) |
| W5 Quality | fixtures, browser flows, render parity, perf benchmarks | `packages/testing` (deferred) |

**Ownership rule:** W1/W2/W3/W4 share typed schemas from `packages/core`; change them via reviewed contracts, not unilateral ad-hoc fields. W5 participates from the first spike, not only at the end.

### Where the code stands

This document is the delivery sequence. The code is a **pnpm workspace with five packages and one
application** — `packages/core`, `packages/components`, `packages/ui`, `packages/editor`,
`packages/video`, and `apps/studio` — not the fourteen-package layout the original design assumed. The
five that hold real code are described in `docs/architecture/TECHNICAL_ARCHITECTURE.md` §2; the rest of
this document's package names are the planned homes for work that has not landed yet. The design that
produced the current layout is
`docs/superpowers/specs/2026-10-28-chart-studio-platform-and-catalogue-reorganisation-design.md`, and
the plan that executed it is `docs/superpowers/plans/2026-10-28-chart-studio-platform-restructure.md`.

**R1 has landed** — the typed registry, the first-party candlestick chart, the project schema and
migration, the storage port and its backends, and three adapted Remocn components. **R2 is half
landed** — the persistence side is complete; the source-import side has not started. **R3 has not
started**: there are no drawing objects, no keyframes and no chart viewport.

**A numbering collision to be aware of.** `docs/architecture/UPSTREAM_AUDIT.md` uses R1 to R4 for the
*implementation slices* that were taken (component system; shadcn and the editor shell; the cinema
shell; the upstream catalogue on the record). This roadmap uses R1 to R8 for the *delivery stages*.
Where both appear, this roadmap's numbers are authoritative for delivery stages.

## 2. Delivery stages and gates

### R0 — Design and feasibility approval (must happen before code)

**Purpose:** resolve library compatibility/cost risks cheaply.  
**Inputs:** this doc set, ADR-001, target browser, owner approval.  
**Deliverables:** version-pinned dependency matrix; baseline hardware/browser profile; minimal spike findings; license review; signed-off architecture adjustments if needed.

- [ ] Owner approves product/scope and Remotion-first ADR.
- [ ] Establish ADR-003 as the R1 component contract: first-party trading catalog and Remocn motion registry adapters are both mandatory foundations.
- [x] Evaluate and pin 2–3 Remocn motion components for titles, effects or transitions; keep framecn out of runtime. — pinned: `marker-highlight`, `soft-blur-in` and `typewriter`, vendored as source with their MIT licence, provenance record, registry definition, `ElementType` id and tests.
- [x] Adopt Tailwind CSS v4 and shadcn/ui for the editor controls and record the dependency decision (versions, licences, browser support, bundle cost, security posture, exit strategy).
- [ ] Review paid Remotion Editor Starter/Timeline procurement decision; maintain free DIY path until purchased.
- [x] Validate Next.js client-only offline App Router route behavior, service worker/pre-caching of WASM chunks and fonts; if unnecessary Next-specific complexity blocks offline use, propose Vite SPA alternative via ADR rather than silently switch. — resolved by ADR-006: the shell stays a Vite SPA at `apps/studio` and Next.js is deferred with a stated trigger to revisit.
- [ ] Verify commercial data/licensing use case and copied component notices.

**Gate R0:** implementation planning is allowed only after owner approves the final revised design; spikes may be separately approved as throwaway validation.

### R1 — Foundational technical spike / first video vertical slice

**Goal:** one editable OHLC chart object that appears and evolves within a Remotion video composition and exports locally.  
**Owner:** W3 with W2/W4 integration.  
**Requirements:** CH-001, AN-001–005, EX-001/003, QA-002.  
**Candidate files:** `packages/core/src/schemas.ts`, `packages/core/src/market.ts`, `packages/components/src/trading/chart.tsx`, `packages/video/src/composition.tsx`, `apps/studio/src/components/PreviewPanel.tsx`, `packages/video/tools/render.mjs`.

- [x] Define typed `VideoComponentDefinition` and object registration for all exportable scene-object types (see ADR-003). — landed: the registry, its contract and 26 registered components.
- [ ] Build first-party `CandlestickChart`, `HighLowLine` and a simple `TextLabel` as registered domain video components (not embedded editor-only widgets).
- [x] Adopt one source-owned Remocn title/transition component behind the same object lifecycle and store its license/provenance. — landed: three adapted components with their MIT licence and provenance record. The transition half is still open: the object model has no transition slot yet.
- [ ] Build first-party `CandlestickChart`, `HighLowLine` and a simple `TextLabel` as registered domain video components (not embedded editor-only widgets). — `CandlestickChart` landed; the other two belong to R3.
- [x] Create minimal typed project/scene/chart object schema and static handcrafted bars. — landed: `packages/core/src/schemas.ts` and the seeded bar generator.
- [x] Implement pure `evaluatePartialCandle` and `evaluateSceneAtFrame` for discrete and simulated mode. — landed: `evaluateBarsAtFrame` with discrete and simulated reveal modes.
- [x] Render SVG chart with object transform through Remotion Player. — landed: the chart renderer, the composition and the Player preview.
- [ ] Add minimal editable inspector for O/H/L/C and frame in/out; test arbitrary seeking.
- [ ] Export PNG and supported-browser MP4 via Remotion web-renderer; verify logical parity and audio+caption test. — partially landed: PNG stills and MP4 through the Node renderer, with the render gate proving preview/export parity frame for frame. The browser-side web-renderer and the audio+caption parity check are still open.
- [ ] Record codec/support limitations, frames, memory and render behavior, not inferred guarantees.

**Demo:** scene SC-01 simplified (at least one dynamic candle, horizontal line and text).  
**Gate R1:** real local Remotion render succeeds on target Chromium *without experimental flags* or a formally documented fallback decision is approved.

### R2 — SQLite + local persistence + source import

**Goal:** genuine local project autosave and source-aware OHLC import.  
**Owners:** W4/W2 with W1 shell.  
**Requirements:** PR-001–004/009/010, MD-001–008.  
**Candidate files:** `packages/editor/src/storage/sqlite/worker.ts`, `src/client.ts`, `src/schema.ts`, and — for the import half — `packages/core/src/import/csv.ts`, `src/import/json.ts`, `src/source-overlay.ts`.

- [x] Prove chosen official SQLite WASM VFS in worker and OPFS-backed reopen on supported Chromium. — landed: the SQLite WASM worker over OPFS, with localStorage and in-memory fallbacks.
- [x] Define migrations, single-writer/tab lock, optimistic head-revision CAS and repository RPC. — landed: the versioned project migration, the one-writer lock and the revision compare-and-set.
- [ ] Build CSV/JSON import with timestamps/price basis/session mapping and data validation.
- [ ] Implement immutable source dataset + overlay edits with source revision IDs and indexed range reads.
- [x] Implement dashboard and auto-save/dirty/status indicators; error handling for blocked storage/quota. — landed: the storage indicator, continuous autosave, save-on-hide and the quota error path.
- [ ] Test interrupted stage/commit and duplicate source asset treatment.

**Demo:** import/construct, close browser, reopen, source unchanged after edit, no cloud.  
**Gate R2:** roundtrip project and dataset survive reload; two-tab writers cannot silently corrupt or overwrite state.

### R3 — Chart-object editing and core trading tools

**Goal:** creator can make a polished manually authored or imported chart clip without video screenshots.  
**Owners:** W1/W2/W3.  
**Requirements:** CH-001/004/006–008, OB-001–009, SC-003, AN-001–006.  
**Candidate files:** `packages/components/src/trading/chart.tsx`, `src/trading/drawings/`, `packages/editor/src/commands/`, `apps/studio/src/components/Inspector.tsx`, `apps/studio/src/components/ToolRail.tsx`.

- [ ] Implement chart viewport/pan/zoom with market-to-scene coordinates and drawing anchor transforms.
- [ ] Create manual candle builder with precise numeric inspector and draggable wick/body handles.
- [ ] Implement high/low and horizontal price line, trendline, zone, position, arrow and text tools as typed objects.
- [ ] Provide selection, object tree, snapping, duplicate/group/lock, grouped undo/redo and transform keyframes.
- [ ] Implement chart object in/out and independent opacity/scale/move/hold while candles keep replaying.
- [ ] Test chart-anchor stability when resizing/moving/replaying chart.

**Demo:** SC-01, SC-02 and SC-03 in a real interactive editor.  
**Gate R3:** a manual candle **develops naturally as partial OHLC**, not just popping in; basic trading tools render correctly in MP4 and remain editable after reload.

### R4 — Multi-chart and honest MTF

**Goal:** HTF/LTF each behave as independently editable video objects and may share an actual market-time cursor.  
**Owners:** W2/W3/W1.  
**Requirements:** CH-002–006/008, TF-001–007, AN-007/008.  
**Candidate files:** `packages/core/src/aggregate-as-of.ts`, `src/session-calendar.ts`, `packages/components/src/trading/chart-group.ts`, `src/trading/multi-chart.tsx`, `apps/studio/src/components/Inspector.tsx`.

- [ ] Add N chart objects to one scene with independent price scale, source view and object lifecycle.
- [ ] Implement presets: HTF alone, LTF alone, horizontal split, vertical split, PIP, focus/fullscreen and 3-grid.
- [ ] Introduce UTC market cursor and per-chart `shared/independent/hold` policies; don't align by row index.
- [ ] Import separate TF sources and derive valid coarser TF from finer data with as-of partial-bar evaluation.
- [ ] Animate chart layout transform keyframes and independent camera zoom without changing source prices.
- [ ] Add missing-session and mismatched-source diagnostics.

**Demo:** SC-04 complete.  
**Gate R4:** two chart objects can animate into a split layout, one freeze while other advances, no HTF lookahead, and both survive portable-style data reconstruction.

### R5 — Assisted SMT 2/3 asset engine and linked story objects

**Goal:** real creator-confirmed divergence storytelling, not automated trade signals.  
**Owners:** W2/W1/W3.  
**Requirements:** SM-001–011.  
**Candidate files:** `packages/smt-mtf/src/pivots.ts`, `src/candidates.ts`, `src/observations.ts` (the package is deferred to this stage), `apps/studio/src/components/Inspector.tsx`, `packages/components/src/trading/smt-link.tsx`.

- [ ] Implement deterministic swing detection with left/right pivot confirmation time, equality tolerance and source revision.
- [ ] Build user anchor pair selection for two same-type highs/lows and counterpart pair suggestions with timestamp evidence.
- [ ] Implement 2 and 3 asset pairwise A↔B/A↔C confirmation, notes and stale detection.
- [ ] Render/animate linked swing pair marks, sweep/nonconfirmation lines and labels as independent scene objects.
- [ ] Verify no-lookahead pivot evidence and explicit trade interpretation policy.

**Demo:** SC-05 and SC-06.  
**Gate R5:** creator can select, confirm and explain SMT; editing any referenced bar invalidates linked confirmation, and three-asset contrary outcomes remain separate.

### R6 — Hierarchical video editor and creator media

**Goal:** full multi-scene video workflow with Remotion timing, captions, images, audio, transitions and reusable presets.  
**Owners:** W1/W3/W4.  
**Requirements:** TL-001–008, SC-001–005, OB-007, EX-005.  
**Candidate files:** `packages/editor/src/timeline/ProjectTimeline.tsx`, `src/SceneTimeline.tsx`, `packages/video/src/composition.tsx`, `apps/studio/src/components/SceneBrowser.tsx`, `apps/studio/src/components/AssetPanel.tsx`.

- [ ] Create project-level scene strip with cuts/crossfade, reorder/duplicate and global frame ruler.
- [ ] Create scene detail timeline with tracks, trim/snap/drag, keyframe lanes and playhead; dnd-kit components can be adapted.
- [ ] Implement scene breadcrumb, per-scope transient session state and global/local time mapping.
- [ ] Implement image and text/caption assets, basic audio import, trim/volume/fade, and export audio synchronization.
- [ ] Implement editable presets `HTF→LTF`, `SMT 2-asset`, `SMT 3-asset`, `Entry`, `Outcome`.
- [ ] Define overlapping transitions and prevent duplicated narration at scene crossfade.

**Demo:** four-scene project with timing independent inside each scene.  
**Gate R6:** project preview seeks to scene overlap boundaries and makes the same object/candle states as local scene preview; audio stays aligned.

### R7 — Portable file system + production export

**Goal:** reproducible creator outputs, complete media packaging and frozen revision export.  
**Owners:** W4/W3/W1.  
**Requirements:** PR-005–008, EX-001–007, QA-001/005/006.  
**Candidate files:** `packages/project-archive/src/export-archive.ts`, `src/import-archive.ts` (the package is deferred to this stage), `packages/video/tools/render.mjs`, `apps/studio/src/components/RenderDialog.tsx`.

- [ ] Build logical `.chartstudio` archive + checksum/hash manifest + self-contained assets/data.
- [ ] Validate path safety, size limits, media references, migrations and atomic import into clean origin.
- [ ] Support 16:9, 9:16, 1:1; 720p/1080p and 24/30fps; frame-range export with capability checks.
- [ ] Freeze project and all market/asset source revisions prior to render; snapshot not affected by user edits.
- [ ] Add progress, cancel, cleanup, export result validation, output filename and meaningful errors.
- [ ] Test codec, audio/image, font/clip ordering and portable reimport parity.

**Demo:** SC-08 exported as video and `.chartstudio`, both reopen/play correctly.  
**Gate R7:** clean-profile import reconstructs scene/SMT/MTF source graph; supported browser emits correctly verified playable MP4.

### R8 — Release hardening and quality gate

**Goal:** production-worthy data integrity and user trust.  
**Owners:** all workstreams, quality leads integration.  
**Requirements:** QA-001–006 and complete P0 feature catalogue.

- [ ] Run all eight video scenarios, in particular SC-08 end-to-end.
- [ ] Validate source mismatch, gaps/DST, pivot confirmation and no-lookahead.
- [ ] Exercise storage quota/interruption, two tabs, missing media, bad archive, browser codec incompatibility.
- [ ] Measure 100k bar query, 3-chart playback, SVG viewport nodes, 90s export memory and timeline latency; document reference platform/results.
- [ ] Run cross-frame visual diff at scene and object boundaries and verify audio timing.
- [ ] Accessibility review: keyboard shortcuts, focus, contrast, labels, semantic controls, error feedback.
- [ ] Final dependency/license audit and schema/portable archive version freeze.

**Gate R8:** no unresolved data corruption, false historical replay, fatal export mismatch or blocked creator journey. Product-owner sign-off required for launch.

## 3. Dependency graph

```
Owner design approval
  └─ R0 spikes & licenses
      ├─ R1 single-chart Remotion video vertical slice
      └─ R2 SQLite/import foundation
           └─ R3 drawing/object editing
                └─ R4 independent charts + MTF
                     └─ R5 assisted SMT
                           └─ R6 nested video editor + media
                                 └─ R7 portable+export
                                      └─ R8 QA release gate
```

This is the integration order, not a rule against parallel work. Within R3, W2 can implement pure tool geometry while W1 builds inspector controls. Within R6, media preloading and scene strip can proceed in parallel once the inputProps/scene schema is frozen.

## 4. Parallel-agent collaboration contracts

| Milestone | May develop in parallel | Cannot merge before |
|---|---|---|
| R1 | SVG chart renderer, Remotion composition proof, synthetic path unit tests | Common `OHLCBar`, `Frame`, `ChartObject`, `Eval` signatures |
| R2 | DB worker/VFS spike, importer row validator, dashboard shell | Schema migration ID and repository RPC defined |
| R3 | Tool geometry, inspector widgets, selection overlay | Typed object union and transform/market anchor API |
| R4 | MTF aggregation, layout presets, chart-to-time map | Source time/session conventions and frame evaluator |
| R5 | SMT pivot ranking, inspector wizard, linked drawing layer | SMTObservation/SwingPair contract and as-of validation |
| R6 | Project strip, scene detail track controls, media asset loader | Global/local frame-mapping and frozen composition schema |
| R7 | Archive import/export, encoder dialog, capability report | Snapshot/asset manifest and media resolver interface |

Every handoff must include a schema example, test fixture, expected edge behavior and explicit warnings. If two agents touch the same canonical type file, integrate sequentially or through a single interface owner, not competing branches with incompatible changes.

## 5. Proposed implementation-plan breakdown (after approval)

Superpowers writing-plans should produce smaller plans for independent work, rather than one giant plan:

1. **Plan A — Remotion/SQLite feasibility and app shell:** toolchain, browser export/OPFS gates, critical contracts.
2. **Plan B — Data + first chart video:** manual/imported OHLC, React/SVG chart, synthetic path, simple drawing, save/reopen.
3. **Plan C — Multi-chart, MTF, SMT:** time sync, partial HTF, pivot pairs, assisted wizard, linked animation.
4. **Plan D — Editor timeline + creator tools:** project/scene hierarchy, object lifecycle and controls, media/captions/audio.
5. **Plan E — Portability, export and release:** archive, encoder, full e2e scenarios, errors/performance/licensing.

Each plan (generated only after approval) should use exact file paths, producer/consumer interfaces and TDD steps per task. A fresh agent executes only its approved plan, then a reviewer validates tests, architecture boundaries and the acceptance IDs. Preserve an issue/decision log between plans.

## 6. Release criteria and prohibited shortcuts

**Must ship:** independent HTF/LTF objects and side-by-side presentation, basic trading tools, exact price anchors, realistically evolving simulated candles, 2–3 asset assisted user-confirmed SMT, no-lookahead MTF, Remotion local MP4 on supported browser, editable multi-scene videos, SQLite autosave, portable archive and audio/captions.

**Cannot substitute:** screen recordings instead of editable chart objects; screenshots instead of live dynamic candles; final HTF candle data leaked into earlier replay; SMT annotations automatically asserted as signals; cloud-only rendering replacing local output; local SQLite DB byte dump mislabeled as portable project.

**May defer:** full authentic tick replay, advanced chart/drawing patterns, automatic SMT scanning, 4+ instrument engine UX, high-end transitions, waveform mixer, cloud sync/server render, third-party plugin marketplace and AI assistant.

## 7. Progress tracking and evidence

Recommended tracking template for each roadmap milestone:

```
Milestone:
Requirement IDs:
Agent owner and reviewers:
Interface/API versions:
Fixtures and scenario:
Tests failing before implementation:
Tests passed after implementation (commands/results):
Browser/device evidence:
Preview/MP4 parity evidence:
Migration/archive notes:
Remaining issue and severity:
Gate: PASS | BLOCKED | APPROVED EXCEPTION
```

Do not report complete based solely on a feature screen appearing. `PASS` requires actual observable behavior, storage roundtrip and appropriate frame/export verification. If the scope changes, update functional spec and at least one scenario before proceeding.
