# Chart Studio — Functional Specification (v1.2)

**Status:** Draft for approval · **Date:** 2026-10-24  
**Normative terms:** **MUST** = required for creator-ready MVP; **SHOULD** = important but may be deferred with documented exception; **MAY** = optional.  
**Companion documents:** [Design](../design/PRODUCT_DESIGN.md), [Architecture](../architecture/TECHNICAL_ARCHITECTURE.md), [Features](../features/FEATURE_CATALOG.md), [Scenarios](../scenarios/VIDEO_SCENARIOS.md), [Test Strategy](../quality/TEST_STRATEGY.md).

## 1. Product boundary and completion

The MVP is not complete until a creator can author and export a realistic, engaging trading explanation using **manual candles or imported real OHLC**, **2–3 synchronized market instruments with assisted user-confirmed SMT**, **higher and lower timeframes individually or simultaneously**, simple **trading drawings**, natural-looking *simulated* candle formation, scene transitions, captions, images and an audio bed. Local project edits persist in SQLite WASM+OPFS and portable project archives can move to a second browser profile. Preview and exported frames must agree on logical state.

No v1 broker connection, automated trade recommendation, automatic all-market SMT search, authentic tick replay engine, native desktop shell, paid asset library, cloud login or compulsory server rendering.

## 2. Data and project behavior

### PR — Projects and portability

- **PR-001:** Users MUST create, name, duplicate, rename, open, delete/restore projects from dashboard. Default preset is editable.
- **PR-002:** UI MUST separately display unsaved changes, saved locally, external archive out-of-date, storage failure and future sync status.
- **PR-003:** Undo/redo MUST group drag sessions into one command and create a new revision on undo, without mutating immutable input datasets.
- **PR-004:** Autosave MUST commit valid revisions to SQLite WASM+OPFS locally without cloud. Failed writes MUST leave the last successful revision usable.
- **PR-005:** `Open` MUST validate a `.chartstudio` archive (schema, checksums, size/path constraints, missing asset references) then import into an independent local workspace; no arbitrary code execution.
- **PR-006:** `Save As` and `Export Project` MUST produce portable versioned archives containing required sources/media and a manifest; users MUST be told if optional assets or source ranges are excluded.
- **PR-007:** `Save` MUST commit the internal project; MUST NOT silently overwrite an external archive or pretend SQLite bytes are the portable format.
- **PR-008:** Import in a clean browser profile MUST reconstruct semantically equivalent scenes and all required dependencies without a network request.
- **PR-009:** Users MUST see actionable storage-quota/OPFS/blocked-VFS warnings and have a portable-backup path where possible.
- **PR-010:** Project and scene revisions MUST be schema versioned; migrations MUST support rollback by preserving pre-migration data when feasible.

### MD — Market data, candles and provenance

- **MD-001:** Manual and CSV/JSON imports MUST produce normalized, editable OHLC series with stable IDs and explicit origin metadata.
- **MD-002:** OHLC records MUST reject NaN/infinity, `high < max(open,close)`, `low > min(open,close)`, negative/invalid volume; imported validation reports row and source reason.
- **MD-003:** Import wizard MUST map symbol, UTC timestamp convention (bar start/end), source timezone/session, price basis and timeframe; ambiguous fields require explicit choice.
- **MD-004:** Imported source datasets MUST be immutable; insert, delete, reorder and edit use working-series overlays and retain original source references.
- **MD-005:** The editor MUST allow OHLC numeric entry and chart drag-handle editing with validation; candle-to-candle gaps are valid; linked-open is opt-in.
- **MD-006:** Reimport or modification MUST invalidate dependent MTF/SMT results and notify the user; no quiet rebinding of swing references.
- **MD-007:** Datasets MUST support indexed time-range queries and only draw visible bars; source revisions/content hashes are stable references.
- **MD-008:** Manual bar sequences without real timestamps MUST use authored logical alignment rather than fabricated UTC time; hypothetical branches MUST be flagged.

## 3. Charts, tools and object lifecycle

### CH — Chart views and groups

- **CH-001:** Users MUST add independent chart objects to scenes; each object has ID, instrument/series reference, timeframe, viewport, aspect/position, visual style and frame in/out.
- **CH-002:** User MUST be able to show HTF alone, LTF alone, two charts side by side, HTF with LTF inset, and synchronized 2/3-asset layouts via object positioning/presets—not fixed editor modes.
- **CH-003:** Each chart MUST have independent vertical price scale and viewport; market cursor linking is configurable, independent of panel size.
- **CH-004:** A chart MAY be soloed, hidden, frozen at a market instant, resized, faded, moved, zoomed, or transitioned, with keyframes separate from candle-replay state.
- **CH-005:** Chart group synchronization MUST align by actual market UTC timestamp plus sessions/intervals, NOT candle row index. Gaps, DST and calendars MUST be diagnosable.
- **CH-006:** Same dataset MUST support multiple independent chart instances and scenes without source duplication.
- **CH-007:** A chart object MUST be selectable with canvas handles and inspectable in object tree and timeline, while editing handles MUST never appear in export.
- **CH-008:** Chart group operations MUST support selecting whole group or drilling down into member charts, preserving their own lifecycles.

### OB — Drawing and media objects

- **OB-001:** Object types MUST include horizontal price line, candle high/low line, trendline, rectangle/price zone, long/short position, arrow, text/caption, image, chart and chart group.
- **OB-002:** All visible scene objects MUST have `[startFrame,endFrame)` active interval, ordered layer, opacity, placement and typed properties; relevant properties support keyframes.
- **OB-003:** Trading drawings MUST anchor to `(chartId, candle/time, price)` when market linked; scene overlays MUST anchor to scene coordinates; transforms MUST preserve anchor semantics.
- **OB-004:** Lines/zone/position tools MUST be created on canvas and editable using numeric inspector and handles. Deletion, duplication, lock, group, hide, undo/redo MUST work.
- **OB-005:** A zone MUST support price high/low, horizontal interval, fill/stroke and optional extend-right behavior. A trendline MUST retain two chart-bound endpoints and optional ray.
- **OB-006:** Position tool MUST show entry, stop, target, direction and optional distance/RR labels as geometry; MUST NOT imply a broker fill, real P&L or trading recommendation.
- **OB-007:** Text and image objects MUST accept in/out frames, transform, opacity and common entrance/exit presets; imported audio MUST be trim- and volume-adjustable at a basic level.
- **OB-008:** Clip opacity, object transform and candle replay MAY animate concurrently but must have defined composition semantics; conflicting exclusive replay clips MUST be rejected or resolved explicitly.
- **OB-009:** Text content, labels, fonts and graphics SHOULD be stored in a portable/project-aware way; missing/licensed fonts MUST show export diagnostics.

## 4. SMT and MTF workflows

### SM — Assisted SMT across 2–3 assets

- **SM-001:** Creator MUST configure an SMT comparison group with exactly 2 or 3 distinct instrument identities, each referencing a chart/series and chosen comparable timeframe.
- **SM-002:** User MUST select a **prior and current high** or **prior and current low** on an anchor asset. A single point alone is insufficient to define a swing-direction comparison.
- **SM-003:** After anchor selection the assistant MUST propose *time-aligned prior/current swing pairs* on one or two counterpart assets, ranked deterministically within configurable UTC/session window and swing-pivot policy.
- **SM-004:** User MUST accept, reject or manually replace counterpart swings; classification remains a draft until user confirms each A↔B and (where applicable) A↔C comparison.
- **SM-005:** Candidate explanations MUST expose chosen timestamps, prices, relative high/low classification, bar-confirmation state and source warnings; no black-box one-click trading signal.
- **SM-006:** For correlated instruments, explain HH vs LH/EH (bearish-style nonconfirmation) and LL vs HL/EL (bullish-style nonconfirmation), with configurable per-instrument equality tolerance. User may record a custom narrative; no automated trade call.
- **SM-007:** An SMT observation MUST retain all four swing references per pair (two per instrument), source revisions, policy, comparison window, interpretation, confirmation status and author note.
- **SM-008:** SMT drawings MUST animate as linked cross-chart annotations, optionally revealing anchor sweep, comparator nonconfirmation, label and explanation sequentially.
- **SM-009:** When any dependency or source series changes, affected observation MUST become stale/invalid with explicit reconfirmation flow; previously confirmed video graphics MUST indicate stale state before export.
- **SM-010:** A pivot that requires future right-side bars MUST not appear confirmed earlier than its actual right-window close; candidate suggestions must apply the as-of replay timestamp.
- **SM-011:** Three-asset result MUST preserve separate pairwise states; disagreeing A↔B and A↔C comparisons cannot be collapsed silently into one label.

### TF — Multi-timeframe analysis

- **TF-001:** Users MUST import multiple TF datasets or derive coarser TF candles from valid finer data, using declared session buckets, price basis and timeframe conventions.
- **TF-002:** The editor MUST prevent representing fine bars as historically authentic when only coarser OHLC is available; simulated downsampling may be explicitly authored but labeled hypothetical.
- **TF-003:** During synchronized replay, incomplete HTF bars MUST display only OHLC aggregated from already eligible finer-source observations; no use of future constituent values.
- **TF-004:** If source granularity cannot establish an authentic partial HTF bar, the UI MUST offer closed-bars-only or explicitly simulated developing-bar display, not secretly use finalized values.
- **TF-005:** HTF and LTF MUST have individually controllable lifecycles, camera zoom, visibility and replay policies, while sharing market-time cursor when enabled.
- **TF-006:** Timeframe focus transitions MUST be editable as object transform/lifecycle keyframes, not destructive transformations of candle datasets.
- **TF-007:** Timestamp gaps, session holidays, closed markets, mismatched data sources, price bases and daylight-saving shifts MUST preserve truthful state and show diagnostics.

## 5. Candle animation, scene and timeline

### AN — Animation/replay

- **AN-001:** Discrete completed-candle reveal and simulated dynamic intrabar formation MUST both be first-class choices per chart replay clip.
- **AN-002:** Discrete options MUST include instant/sequential/batch and a limited fade/grow/wipe set; visual growth MUST not be presented as historical trading ticks.
- **AN-003:** Synthetic intrabar paths MUST be deterministic from `(OHLC, algorithmVersion, seed, settings)`, remain inside `[low,high]`, visit both extremes, begin at open and finish at close.
- **AN-004:** Intermediate partial candle state MUST update open, current high/low, current close/body and price cursor correctly for any direct seek frame.
- **AN-005:** Imported historical OHLC with synthetic path MUST identify simulation in editor and export/source metadata; **actual tick replay is out of MVP**.
- **AN-006:** Replay has time remap (`localFrame→marketTime/progress`) with holds and speed changes; preview transport speed MUST NOT modify saved clip durations.
- **AN-007:** Two/three charts with shared market-time policy MUST evaluate at a common source instant while respecting independent closed/open session bars and independent styles.
- **AN-008:** Frozen chart clips may hold last-known values; no new bar may be fabricated to fill a market gap.

### TL — Hierarchical timeline

- **TL-001:** Project-level timeline MUST order scenes, control start/duration, cut/fade overlaps, and support full-video preview.
- **TL-002:** Scene-level tracks MUST edit chart clips, visual-object clips, text/image/audio clips and camera/transform keyframes separately.
- **TL-003:** Double-click scene instance MUST navigate to local timeline; back/breadcrumb MUST return to composition and preserve previous playheads/zoom context.
- **TL-004:** Clip drag, trim, duplicate, split if safely supported, track reorder, snapping, lock/hide/solo, zoom, scrub, frame step and loop MUST be predictable with undo/redo.
- **TL-005:** All clip intervals MUST be integer frames and half-open `[start,end)`; define global-to-local mapping for crossfade overlaps.
- **TL-006:** Scene shortening MUST non-destructively hide out-of-range content; stretching MUST be explicit; transition duration MUST NOT retime underlying market history.
- **TL-007:** Every frame MUST be evaluable directly from frozen project snapshot and frame index independent of prior preview state.
- **TL-008:** Audio MUST remain aligned during preview/export transitions with basic volume and trim support; no unexpected repetition due to overlapping scenes.

### SC — Scenes and reusable compositions

- **SC-001:** A project MUST support multiple named scenes, duplication, reordering, deletion/recovery and scene thumbnails.
- **SC-002:** Scene objects MAY be independent charts; chart group is convenience association, not ownership requirement. A scene can have zero, one, two or three charts in v1; chart count is limited by supported render/layout budgets, not by a fixed 2-panel widget.
- **SC-003:** Scene object local lifecycles MUST be independent: one HTF chart may fade out as an LTF chart grows while both reference synchronized or independent data.
- **SC-004:** Reusable v1 templates MUST be copy-on-insert definitions, with shared immutable asset references and no hidden network dependencies.
- **SC-005:** Project composition MUST freeze a scene/asset revision for export, preventing edits during render from changing output frames.

## 6. Media, export and reliability

### EX — Export

- **EX-001:** Users MUST export PNG still and MP4/H.264 video on supported browser configurations, using Remotion's browser-rendering path after capability detection. Unsupported combinations MUST report diagnostics; no false completion message.
- **EX-002:** Export settings MUST include 16:9, 9:16 and 1:1 presets, 720p/1080p resolutions, supported 24/30 FPS, full composition or selected range and output filename.
- **EX-003:** Preview and export MUST use the same scene-domain frame evaluation and Remotion compositions; logical geometry, data visibility, annotation timing and transition state must match.
- **EX-004:** Export MUST freeze project revision, data revision, assets, seed and algorithm versions. Progress, cancellation and result validation MUST exist.
- **EX-005:** Audio import/clip MUST include project timing, basic fade/volume/trim; exported result must play correctly in the supported target player.
- **EX-006:** Missing audio/image/font, codec inability, quota exhaustion, unreadable video asset or unsupported CSS feature MUST be detected before or during render and return meaningful recovery guidance.
- **EX-007:** No experimental browser flags may be required for normal v1 export on the reference supported Chromium environment.

### QA — Release acceptance

- **QA-001:** A 3-asset SMT + MTF 60–90s sample must import, save, reopen, preview, export MP4 and portable project, and reimport in clean origin without broken dependencies.
- **QA-002:** Direct seek to arbitrary video frame must produce same logical evaluated state as sequential playback; partial OHLC and HTF bars pass property tests.
- **QA-003:** Failed OPFS/SQLite save or exhausted quota leaves previously committed project intact with understandable status.
- **QA-004:** No confirmed SMT before pivot confirmation; changing source bars/revisions marks dependent annotations stale before render.
- **QA-005:** Source provenance and simulation labels survive save/reopen/archive import.
- **QA-006:** Preview/export parity must be tested at scene cuts/fades, multi-chart focus transitions and object entry/exit boundaries.

## 7. Common edge cases and error semantics

| Condition | Required response |
|---|---|
| CSV has duplicated timestamp | Explicit dedup policy choice or error; original preserved |
| CSV source time zone unclear | Prompt user to choose, no local-zone guess |
| Instruments have non-overlapping sessions | Show gap/hold-last-known config, do not align by row |
| Chart has zero or one candle | Render reasonable empty/partial view; don't crash / fake future bars |
| Input candle invalid | Explain precise field and reject that edit atomically |
| 3-asset SMT pair comparisons disagree | Show pairwise outcome separately; user controls narration |
| Pivot right confirmation unavailable | Show candidate as provisional or unavailable, not confirmed |
| HTF-only source, request truthful partial replay | Offer closed-candle-only or explicitly simulated mode |
| User trims a scene below annotation start | Retain out-of-range object/clip for undo/extension, hide during playback |
| Local MP4 unsupported | Show capability reason and supported alternative (PNG/other codec), no server required to edit |
| Corrupt `.chartstudio` | Reject entire import without altering existing projects |
| Two tabs try to write SQLite | Prevent concurrent writes; user receives read-only or takeover guidance |
| Archive saved outside web-origin | Local Save is still separate; external file status stays accurate |

## 8. Developer interface expectations

Every requirement ID should have an automated test (unit, integration, browser or E2E) or a documented manual verification step. Major types and interfaces are specified in [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md). Feature-to-requirement mapping is in [Feature Catalogue](../features/FEATURE_CATALOG.md). The test fixtures intentionally include synthetic OHLC, mixed source revisions, DST/session gaps and three correlated-index aliases that are treated as distinct feeds.

## 9. Deferred behavior (not implementation tasks for v1)

True tick ingestion and authentic tick-order reconstruction; automatic SMT scanner and strategy alerts; support for inverse-correlated SMT rules; broker/API integrations; backtesting; full rich audio mixer; subtitling/transcription AI; fully nested NLE compositions; collaboration; network/cloud export; full mobile authoring; paid Remotion starter purchase unless separately approved.

## 10. Sign-off checklist

Owner is asked to sign off on: Remotion as the unified video runtime, typed scene-chart object lifecycles, basic trading tools, v1 local MP4 gate, SQLite WASM/OPFS strategy, user-confirmed assisted SMT semantics, no-lookahead MTF, local Save vs external Save As, and the creator-ready MVP list. A signed-off spec is the input to Superpowers implementation plans; no code or package installation is authorized merely by writing this document.
