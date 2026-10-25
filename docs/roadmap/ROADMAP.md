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
| W1 Application/UX | dashboard, inspector, canvas tool overlays, project/scene navigation | `apps/studio`, `ui`, `editor-core` |
| W2 Trading domain | OHLC, manual series edits, MTF, SMT, coordinate transforms | `market-data`, `smt-mtf`, `domain` |
| W3 Video + component catalog | Remotion scene compositions, first-party trading video components, Remocn source-owned motion components, SVG visuals, keyframes, preview, export | `chart-renderer`, `trading-components`, `motion-components`, `scene-compositor`, `export` |
| W4 Storage | SQLite WASM worker, OPFS, migrations, assets, portable archive | `storage-sqlite`, `project-archive` |
| W5 Quality | fixtures, browser flows, render parity, perf benchmarks | `testing`, `tests` |

**Ownership rule:** W1/W2/W3/W4 share typed schemas from `domain`; change them via reviewed contracts, not unilateral ad-hoc fields. W5 participates from the first spike, not only at the end.

## 2. Delivery stages and gates

### R0 — Design and feasibility approval (must happen before code)

**Purpose:** resolve library compatibility/cost risks cheaply.  
**Inputs:** this doc set, ADR-001, target browser, owner approval.  
**Deliverables:** version-pinned dependency matrix; baseline hardware/browser profile; minimal spike findings; license review; signed-off architecture adjustments if needed.

- [ ] Owner approves product/scope and Remotion-first ADR.
- [ ] Establish ADR-003 as the R1 component contract: first-party trading catalog and Remocn motion registry adapters are both mandatory foundations.
- [ ] Evaluate and pin 2–3 Remocn motion components for titles, effects or transitions; keep framecn out of runtime.
- [ ] Review paid Remotion Editor Starter/Timeline procurement decision; maintain free DIY path until purchased.
- [ ] Validate Next.js client-only offline App Router route behavior, service worker/pre-caching of WASM chunks and fonts; if unnecessary Next-specific complexity blocks offline use, propose Vite SPA alternative via ADR rather than silently switch.
- [ ] Verify commercial data/licensing use case and copied component notices.

**Gate R0:** implementation planning is allowed only after owner approves the final revised design; spikes may be separately approved as throwaway validation.

### R1 — Foundational technical spike / first video vertical slice

**Goal:** one editable OHLC chart object that appears and evolves within a Remotion video composition and exports locally.  
**Owner:** W3 with W2/W4 integration.  
**Requirements:** CH-001, AN-001–005, EX-001/003, QA-002.  
**Candidate files:** `packages/domain/src/project.ts`, `packages/market-data/src/ohlc.ts`, `packages/chart-renderer/src/CandlesSvg.tsx`, `packages/scene-compositor/src/SceneVideo.tsx`, `apps/studio/src/components/VideoPreview.tsx`, `packages/export/src/exportLocal.ts`.

- [ ] Define typed `VideoComponentDefinition` and object registration for all exportable scene-object types (see ADR-003).
- [ ] Build first-party `CandlestickChart`, `HighLowLine` and a simple `TextLabel` as registered domain video components (not embedded editor-only widgets).
- [ ] Adopt one source-owned Remocn title/transition component behind the same object lifecycle and store its license/provenance.
- [ ] Create minimal typed project/scene/chart object schema and static handcrafted bars.
- [ ] Implement pure `evaluatePartialCandle` and `evaluateSceneAtFrame` for discrete and simulated mode.
- [ ] Render SVG chart with object transform through Remotion Player.
- [ ] Add minimal editable inspector for O/H/L/C and frame in/out; test arbitrary seeking.
- [ ] Export PNG and supported-browser MP4 via Remotion web-renderer; verify logical parity and audio+caption test.
- [ ] Record codec/support limitations, frames, memory and render behavior, not inferred guarantees.

**Demo:** scene SC-01 simplified (at least one dynamic candle, horizontal line and text).  
**Gate R1:** real local Remotion render succeeds on target Chromium *without experimental flags* or a formally documented fallback decision is approved.

### R2 — SQLite + local persistence + source import

**Goal:** genuine local project autosave and source-aware OHLC import.  
**Owners:** W4/W2 with W1 shell.  
**Requirements:** PR-001–004/009/010, MD-001–008.  
**Candidate files:** `packages/storage-sqlite/src/worker.ts`, `src/client.ts`, `src/migrations/0001.ts`, `packages/market-data/src/importCsv.ts`, `src/importJson.ts`, `src/sourceOverlay.ts`.

- [ ] Prove chosen official SQLite WASM VFS in worker and OPFS-backed reopen on supported Chromium.
- [ ] Define migrations, single-writer/tab lock, optimistic head-revision CAS and repository RPC.
- [ ] Build CSV/JSON import with timestamps/price basis/session mapping and data validation.
- [ ] Implement immutable source dataset + overlay edits with source revision IDs and indexed range reads.
- [ ] Implement dashboard and auto-save/dirty/status indicators; error handling for blocked storage/quota.
- [ ] Test interrupted stage/commit and duplicate source asset treatment.

**Demo:** import/construct, close browser, reopen, source unchanged after edit, no cloud.  
**Gate R2:** roundtrip project and dataset survive reload; two-tab writers cannot silently corrupt or overwrite state.

### R3 — Chart-object editing and core trading tools

**Goal:** creator can make a polished manually authored or imported chart clip without video screenshots.  
**Owners:** W1/W2/W3.  
**Requirements:** CH-001/004/006–008, OB-001–009, SC-003, AN-001–006.  
**Candidate files:** `packages/chart-renderer/src/ChartSvg.tsx`, `src/DrawingsSvg.tsx`, `packages/editor-core/src/commands/`, `apps/studio/src/editor/Inspector/`, `src/editor/ToolRail/`.

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
**Candidate files:** `packages/market-data/src/aggregateAsOf.ts`, `src/sessionCalendar.ts`, `packages/domain/src/chartGroup.ts`, `packages/chart-renderer/src/MultiChartScene.tsx`, `apps/studio/src/editor/ChartLayoutInspector.tsx`.

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
**Candidate files:** `packages/smt-mtf/src/pivots.ts`, `src/candidates.ts`, `src/observations.ts`, `apps/studio/src/editor/SMTInspector.tsx`, `packages/chart-renderer/src/SMTLinkSvg.tsx`.

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
**Candidate files:** `packages/timeline/src/ProjectTimeline.tsx`, `src/SceneTimeline.tsx`, `packages/scene-compositor/src/ProjectVideo.tsx`, `apps/studio/src/editor/SceneBrowser.tsx`, `src/editor/AssetPanel.tsx`.

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
**Candidate files:** `packages/project-archive/src/exportArchive.ts`, `src/importArchive.ts`, `packages/export/src/exportJob.ts`, `apps/studio/src/editor/ExportDialog.tsx`.

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
