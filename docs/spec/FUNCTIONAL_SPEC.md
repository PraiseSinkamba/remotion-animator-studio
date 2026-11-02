# Chart Studio — Functional Specification (v1.5)

**Status:** Draft for approval · **Date:** 2026-11-01  
**Normative terms:** **MUST** = required for creator-ready MVP; **SHOULD** = important but may be deferred with documented exception; **MAY** = optional.  
**Companion documents:** [Design](../design/PRODUCT_DESIGN.md), [Architecture](../architecture/TECHNICAL_ARCHITECTURE.md), [Features](../features/FEATURE_CATALOG.md), [Scenarios](../scenarios/VIDEO_SCENARIOS.md), [Test Strategy](../quality/TEST_STRATEGY.md), [ADR-007 — Chart element model](../decisions/ADR-007-CHART-ELEMENT-MODEL.md), [ADR-009 — Independent drawing elements](../decisions/ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md), [ADR-010 — Element edit model](../decisions/ADR-010-ELEMENT-EDIT-MODEL.md).

## 1. Product boundary and completion

The MVP is not complete until a creator can author and export a realistic, engaging trading explanation using **manual candles or imported real OHLC**, **2–3 synchronized market instruments with assisted user-confirmed SMT**, **higher and lower timeframes individually or simultaneously**, simple **trading drawings**, natural-looking *simulated* candle formation, scene transitions, captions, images and an audio bed. Local project edits persist in SQLite WASM+OPFS and portable project archives can move to a second browser profile. Preview and exported frames must agree on logical state.

No v1 broker connection, automated trade recommendation, automatic all-market SMT search, authentic tick replay engine, native desktop shell, paid asset library, cloud login or compulsory server rendering.

## 2. Data and project behavior

The current project schema version is **4**. A v1 document is lifted to v2, then to v3 and then to
v4 in one pass; the v2 → v3 conversion is **CV-005** and the v3 → v4 conversion is **CV-006**, both
recorded in §3 with the other drawing requirements, because they are requirements about drawings
rather than about data.

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
- **PR-010:** Project and scene revisions MUST be schema versioned; migrations MUST support rollback by preserving pre-migration data when feasible, and MUST be non-destructive and idempotent. The drawing migrations are **CV-005** and **CV-006**.

### MD — Market data, candles and provenance

- **MD-001:** Manual and CSV/JSON imports MUST produce normalized, editable OHLC series with stable IDs and explicit origin metadata.
- **MD-002:** OHLC records MUST reject NaN/infinity, `high < max(open,close)`, `low > min(open,close)`, negative/invalid volume; imported validation reports row and source reason.
- **MD-003:** Import wizard MUST map symbol, UTC timestamp convention (bar start/end), source timezone/session, price basis and timeframe; ambiguous fields require explicit choice.
- **MD-004:** Imported source datasets MUST be immutable; insert, delete, reorder and edit use working-series overlays and retain original source references.
- **MD-005:** The editor MUST allow OHLC numeric entry and chart drag-handle editing with validation; candle-to-candle gaps are valid; linked-open is opt-in.
- **MD-006:** Reimport or modification MUST invalidate dependent MTF/SMT results and notify the user; no quiet rebinding of swing references.
- **MD-007:** Datasets MUST support indexed time-range queries and only draw visible bars; source revisions/content hashes are stable references.
- **MD-008:** Manual bar sequences without real timestamps MUST use authored logical alignment rather than fabricated UTC time; hypothetical branches MUST be flagged.
- **MD-009:** The editor MUST expose a typed datasource seam carrying source identity, provenance/origin, a revision/content hash, ascending bar order and stable bar identifiers; a series' origin is one of `authored-path`, `manual`, `synthetic` or `imported`, and no importer ships in this slice.
- **MD-010:** A chart MUST consume its series by reference, by id, so the same dataset can back several chart instances without duplication.

### AP — Authored swing paths and candle generation

- **AP-001:** A swing-path tool MUST let the creator place swing anchors on the chart, and the generated candles MUST follow the drawn path, with the close of each anchor bar equal to the placed price exactly. The drawn path is the skeleton of the series, not a corridor: closes MAY overshoot the anchors between them.
- **AP-002:** Candle generation MUST be a pure function of the path, a seed, an algorithm version and the generator settings; the same inputs MUST always produce the same bars. The anchor regime MUST determine the character of the segment that runs from that anchor to the next, and the generated series MUST remain scale-invariant.
- **AP-003:** Moving an anchor MUST regenerate the series deterministically and re-render the affected elements without a reload; only the segments the moved anchor touches change.
- **AP-004:** An authored path MUST remain distinguishable in the editor and in export metadata from synthetic and imported series.

## 3. Charts, tools and object lifecycle

### CH — Chart views and groups

- **CH-001:** Users MUST add independent chart objects to scenes; each object has ID, instrument/series reference, timeframe, viewport, aspect/position, visual style and frame in/out.
- **CH-002:** User MUST be able to show HTF alone, LTF alone, two charts side by side, HTF with LTF inset, and synchronized 2/3-asset layouts via object positioning/presets—not fixed editor modes. The two split kinds MUST be supported: one asset at two timeframes, and two assets on one timeframe moving together with the same number of candles. The split layouts MUST be expressible as a grouped chart of one to three chart objects (CH-011).
- **CH-003:** Each chart MUST have independent vertical price scale and viewport; market cursor linking is configurable, independent of panel size.
- **CH-004:** A chart MAY be soloed, hidden, frozen at a market instant, resized, faded, moved, zoomed, or transitioned, with keyframes separate from candle-replay state.
- **CH-005:** Chart group synchronization MUST align by actual market UTC timestamp plus sessions/intervals, NOT candle row index. Gaps, DST and calendars MUST be diagnosable.
- **CH-006:** Same dataset MUST support multiple independent chart instances and scenes without source duplication.
- **CH-007:** A chart object MUST be selectable with canvas handles and inspectable in object tree and timeline, while editing handles MUST never appear in export.
- **CH-008:** Chart group operations MUST support selecting whole group or drilling down into member charts, preserving their own lifecycles.
- **CH-009:** A chart object MUST be a collection of elements — its panes — with the collection itself controllable as a whole. A pane MUST carry its own place in the chart box, clock binding, viewport, pause points and curve. A drawing MUST NOT be an element of a chart: a drawing is an ordinary element with its own geometry, its own lifecycle and its own opacity, and it MUST NOT resolve against a pane's scale, because it reads no market at all.
- **CH-010:** A chart MUST express the relation between its panes as a declared relation of exactly two kinds — a **rollup** (one asset at two timeframes, the coarser pane aggregating the same source as-of) or a **lockstep** (two assets on the same timeframe and the same number of candles, advancing together on the shared clock) — and the relation MUST be labelled honestly, never claiming a market-time alignment that the data does not have: a link between two different series MUST be labelled as an authored link in the editor, and MUST NOT be described as market time.
- **CH-011:** The split layouts MUST be delivered as a **grouped chart** holding one to three chart objects with a shared arrangement and a shared clock; the group MUST NOT take ownership of the charts' data, lifecycles or prices, and each chart MUST keep its own series, price scale, viewport and lifecycle. The relation between panes is declared on the chart that holds them, not on the group.

### OB — Drawing and media objects

- **OB-001:** Object types MUST include horizontal line, vertical line, candle high/low line, trendline, rectangle, long/short position, arrow, text/caption, image, chart and chart group.
- **OB-002:** All visible scene objects MUST have `[startFrame,endFrame)` active interval, ordered layer, opacity, placement and typed properties; relevant properties support keyframes.
- **OB-003:** A drawing MUST be an ordinary scene element: it MUST carry its own geometry in composition space — a box where the drawing has one, absolute points where the drawing is its points — its own `[startFrame,endFrame)` range, its own opacity and style. A drawing MUST NOT read a chart, a pane, a series or any market value, and MUST NOT carry a chart-relative lifecycle.
- **OB-004:** Lines/zone/position tools MUST be created on the canvas with no chart selected and edited by the draggable handles their own declaration gives them. The creator's own figure MUST be stated in the drawing's caption, never in a market-derived number. Deletion, duplication, lock, group, hide, undo/redo MUST work.
- **OB-005:** A rectangle MUST be the element's own box and MUST support fill and stroke; it MUST carry no market-derived edge values. A trendline MUST be two absolute points, at any angle, and no chart-bound endpoints; it MUST NOT carry a box.
- **OB-006:** Position tool MUST show entry, stop, target, direction and optional distance/RR labels as geometry; MUST NOT imply a broker fill, real P&L or trading recommendation.
- **OB-007:** Text and image objects MUST accept in/out frames, transform, opacity and common entrance/exit presets; imported audio MUST be trim- and volume-adjustable at a basic level.
- **OB-008:** Clip opacity, object transform and candle replay MAY animate concurrently but must have defined composition semantics; conflicting exclusive replay clips MUST be rejected or resolved explicitly.
- **OB-009:** Text content, labels, fonts and graphics SHOULD be stored in a portable/project-aware way; missing/licensed fonts MUST show export diagnostics.
- **OB-010:** Every element MUST carry its own `[in,out)` lifecycle, opacity and layer, and a pane or chart MUST carry its own curve. A drawing's lifecycle is its own clip's range on the timeline, not a range inside a chart clip; a pane's own `out` bounds its contribution to the derived duration, and a pane's curve shapes the growth of the candles in its slot. Elements MUST be groupable and MUST carry an order: the track is the layer, `tracks[0]` is the top layer, and within a track a later clip draws above an earlier one. The canvas MUST pick in that same order — topmost first — so an element lying over another is the one picked.

- **OB-011:** A drawing MUST be placeable at a point in the composition and MUST render with no chart in the project. The drawing tools MUST be offered without a chart selected, and a click or a library drop MUST place the drawing with its own frame range and its own track: the track immediately above the chart it was dropped on where there is one, otherwise the selected clip's track, otherwise the first track.
- **OB-012:** A drawing's geometry MUST be stored in composition space, as absolute points where the drawing is its points and as a box where the drawing has one. A handle drag MUST rewrite the geometry in the clip's own props.
- **OB-013:** A drawing MUST carry an optional caption that the creator types, and that caption MUST be recorded in the export as the creator's own figure. A caption MUST NOT be presented as a market value, a price or a broker fill.
- **OB-014:** The canvas MUST offer a context menu on an element, offering group, ungroup, duplicate, copy, paste, delete, rename, bring to front, send to back, lock and hide. Rename MUST select the clip and focus the inspector's name field rather than prompt for a string.
- **OB-015:** Lock and hide MUST apply to every clip, not only to drawings. A hidden clip MUST be skipped by the composition, and a locked clip MUST stay on the timeline — carrying a lock badge — while not being pickable on the canvas.

### EM — The element edit model

Every element declares how it is picked and what the creator can drag. The editor reads that
declaration and never names an element kind for selection, editing or picking.

- **EM-001:** A component definition MUST be able to declare an optional edit model — a pick kind (`box`, `segment` or `point`) and the control points it shows — and the editor MUST read that declaration rather than derive a model from the element's props. An element that declares no edit model MUST keep the plain box behaviour.
- **EM-002:** A handle MUST NOT declare where it sits. The shell MUST derive it: a `scale`, `font` or `wrap` handle is a corner or a side of the element's region, a `point` or `level` handle is the element's own named point, and a `move` handle is the element's own anchor. A line's two ends are not at the corners of its bounding box, so a handle placed as a fraction of the region could not name them.
- **EM-003:** The 32 scene-object types MUST declare their edit model as follows — 30 are canvas-capable; audio and background declare none. Two additional transition definitions are not canvas objects.

  | Group | Elements | Pick | Handles |
  |---|---|---|---|
  | 1 — the box is the truth | `shape` `image` `video` `gif` `html` `wave` `synthGrid` `ridge` `commitGraph` `particles` `sunMoon` `skyCycle` `rectangle` `blob` `cursor` `neonSun` `isoCity` `candlestickChart` | `box` | four corners, `scale` |
  | 2 — the content is the truth | `text` `emoji` `remocnMarkerHighlight` `remocnSoftBlurIn` `remocnTypewriter` | `box` | four corners, `font`; east/west `wrap` where supported |
  | Content capability exceptions | `counter`; `nodeTrail` | `box` | counter: font corners only; NodeTrail: no scale/wrap grips, inspector label font only |
  | 3 — one anchor | `horizontalLine` `verticalLine` | `point` | one handle, `move` |
  | 4 — two endpoints | `trendline` `arrow` | `segment` | two handles, `point` |
  | 5 — a box with levels | `position` | `box` | three handles, `level` |
  | 6 — not on the canvas | `audio` `background` | — | none |

  A `scale` handle writes the props the element's size lives in: `width` and `height` for most, `size` for `blob`, `cursor` and `neonSun`, `tileSize` for `isoCity`, and `width` and `height` for `particles`, `sunMoon` and `skyCycle`. Within the content group emoji writes `size` for both corner and east/west side handles. Counter has font corners only; NodeTrail has a movable measured path region and inspector label-font control, with no scaling or wrapping grips. IsoCity corners change `tileSize` uniformly; `gridSize` remains topology. Scalar-sized objects resize uniformly.
- **EM-004:** The canvas MUST pick an element by the shape it declares: a `box` element anywhere inside its region, a `segment` within **6 screen pixels** of its stroke, a `point` within **8 screen pixels** of its point. The tolerance MUST be in screen pixels, so the same pointer hits the same element at every zoom. A line's own endpoints MUST be grabbable, because they are the element's declared control points and take precedence over its body. The geometry module declares a 10-screen-pixel endpoint tolerance, but the pick test does not yet consume it; the endpoints are grabbed as control points instead.
- **EM-005:** The pick order MUST be unchanged: tracks top-down, and within a track the later clip on top. The selected element's own control points MUST take precedence over its body.
- **EM-006:** The selection overlay MUST be one layer that draws the control points the element declares, in one style. The drawings' separate point overlay MUST NOT survive alongside it. A line MUST get **no rectangle**: its region is the bounding box of its two ends, but drawing that rectangle is exactly what the change removes.
- **EM-007:** A text's box MUST be derived from the rendered text, not stored as a number the creator sets. The composition MUST stamp each clip's id onto its rendered root so the editor can measure it; the measurement MUST be editor-only and the renderer MUST stay pure. The font size MUST be the single master: a corner handle scales it and a side handle sets the wrap width, and the box follows. The inspector MUST show the font size and the wrap width for a text, and MUST NOT show width and height.
- **EM-008:** The trend line's ray option MUST be retired. A trend line has no box to run to the edge of.
- **EM-009:** The chart's corner handles MUST scale the chart's outer box. The chart's plot has no props of its own yet, so driving the plot is deferred; the corners do not claim to move it.

The 2026-11-02 repair makes these rules frame-specific: eligibility is the half-open clip
lifetime, visible, unlocked and canvas-capable; timeline selection outside that range has no
canvas grips. Shared evaluated pose drives rendering, projected picking and inverse pointer
editing, with singular/camera-hidden geometry excluded. Locks apply at mutation boundaries,
including grouped operations. Known props validate at load and edit boundaries; invalid batches
retain prior state/history and report an actionable notice. Local content measurement caches
sizes only. HTML preview/export use the same safe static subset with authored source preserved.
See the [component contract](COMPONENT_CONTRACT.md#repair-contract-2026-11-02).

### CV — Document conversion (CV-005, CV-006)

The curve vocabulary is CV-001 … CV-004, in §5. CV-005 and CV-006 are the conversions of a document that holds drawings.

- **CV-005:** A document that holds chart-anchored drawings MUST be migrated to independent drawings, with the old element types mapped to the new ones and the price kept as a caption. The migration MUST be non-destructive and idempotent, and it MUST place a migrated drawing using the chart's plot area and the chart's full-series price range — an approximation taken at the last frame, because the old position depended on the price scale at a frame and a static migration cannot reproduce that.
- **CV-006:** A v3 document MUST be migrated to v4, non-destructively and idempotently, so that the drawings store the shapes they are. A trend line, an arrow and a high/low line MUST store **two absolute points and no box**. A horizontal line MUST store `{x, y, width}` — the width is its length — and a vertical line `{x, y, height}`. A text label MUST store `{x, y, points: {at}}` and no box. The rectangle MUST keep its box. The position tool MUST keep its box and its three levels, now absolute. The trend line's ray option MUST be dropped.

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
- **TF-008:** The relation between a rollup's two timeframes MUST be derivable from the panes themselves, so the displayed ratio ("1D = 24 × 1H") always agrees with the data; a lockstep relation MUST name the shared timeframe, and the shared candle count MUST come from the two panes and MUST agree between them.
- **TF-009:** The timeframes the product offers MUST be drawn from a fixed ladder — `1m`, `3m`, `5m`, `15m`, `30m`, `1H`, `4H`, `6H`, `7H`, `2D`, `1W`, `1M` — and every timeframe MUST be defined against the base rung rather than against each other, so two rungs with no whole-number ratio to each other remain comparable through the base. A non-whole ratio MUST be displayed as the fraction it is, never rounded into a whole-number multiple.

## 5. Candle animation, scene and timeline

The scene timeline now carries the drawings as ordinary clips: a drawing has its own frame range
and its own track, and the track is the layer — `tracks[0]` is the top layer, and within a track a
later clip draws above an earlier one. Lock and hide apply to every clip on that timeline. The
requirements that describe this are OB-010 to OB-015, in §3, and the conversions of a document that
holds drawings are CV-005 and CV-006, in §3.

Every element on the canvas declares how it is picked and what the creator can drag, and the canvas
picks it by that shape rather than by a rectangle around it. Those requirements are EM-001 to
EM-009, in §3.

### AN — Animation/replay

- **AN-001:** Discrete completed-candle reveal and simulated dynamic intrabar formation MUST both be first-class choices per chart replay clip.
- **AN-002:** Discrete options MUST include instant/sequential/batch and a limited fade/grow/wipe set; visual growth MUST not be presented as historical trading ticks.
- **AN-003:** Synthetic intrabar paths MUST be deterministic from `(OHLC, algorithmVersion, seed, settings)`, remain inside `[low,high]`, visit both extremes, begin at open and finish at close.
- **AN-004:** Intermediate partial candle state MUST update open, current high/low, current close/body and price cursor correctly for any direct seek frame.
- **AN-005:** Imported historical OHLC with synthetic path MUST identify simulation in editor and export/source metadata; **actual tick replay is out of MVP**.
- **AN-006:** Replay has time remap (`localFrame→marketTime/progress`) with holds and speed changes; preview transport speed MUST NOT modify saved clip durations.
- **AN-007:** Two/three charts with shared market-time policy MUST evaluate at a common source instant while respecting independent closed/open session bars and independent styles.
- **AN-008:** Frozen chart clips may hold last-known values; no new bar may be fabricated to fill a market gap.

### CV — Curves and easing

- **CV-001:** A chart and its panes MUST accept an editable easing curve; a pane's curve overrides the chart's, and the curve MUST apply per candle within the pane's slot.
- **CV-002:** Effects that are currently static or linear MUST accept an easing parameter, and effects that already expose one MUST accept a custom cubic-bezier as well; the legacy easing names MUST keep their meaning, so no existing rendered frame changes.
- **CV-003:** A curve MUST be stored as data, evaluated by a pure function, and MUST produce identical frames in preview and export.
- **CV-004:** The inspector MUST provide one curve editor for every surface that exposes a curve — the chart, a pane, a zoom segment and an effect's custom cubic-bezier.

CV-001 … CV-004 are the curve vocabulary. The conversions of a document that holds drawings are **CV-005** and **CV-006**, in §3.

### TL — Hierarchical timeline

- **TL-001:** Project-level timeline MUST order scenes, control start/duration, cut/fade overlaps, and support full-video preview.
- **TL-002:** Scene-level tracks MUST edit chart clips, visual-object clips, text/image/audio clips and camera/transform keyframes separately.
- **TL-003:** Double-click scene instance MUST navigate to local timeline; back/breadcrumb MUST return to composition and preserve previous playheads/zoom context.
- **TL-004:** Clip drag, trim, duplicate, split if safely supported, track reorder, snapping, lock/hide/solo, zoom, scrub, frame step and loop MUST be predictable with undo/redo.
- **TL-005:** All clip intervals MUST be integer frames and half-open `[start,end)`; define global-to-local mapping for crossfade overlaps.
- **TL-006:** Scene shortening MUST non-destructively hide out-of-range content; stretching MUST be explicit; transition duration MUST NOT retime underlying market history.
- **TL-007:** Every frame MUST be evaluable directly from frozen project snapshot and frame index independent of prior preview state.
- **TL-008:** Audio MUST remain aligned during preview/export transitions with basic volume and trim support; no unexpected repetition due to overlapping scenes.
- **TL-009:** Composition duration MUST be either derived from the elements or set by the author, and the fixed value MUST be adjustable with a draggable slider.
- **TL-010:** A component MUST be able to declare transport actions that the shell renders and executes generically in the playback controls.

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
| Two different instruments linked with no shared market time | Link by an author-supplied offset and label it "authored link — not market time"; never claim UTC alignment |
| A drawing is placed with no chart in the project | Place it with its own box, its own frame range and its own track; it renders from its own geometry |
| A chart is resized or moved | The chart's own panes follow the chart box; a drawing is unaffected, because it holds no chart anchor |
| A partially aggregated coarser bar is displayed | Mark it as developing and aggregate only the constituents revealed so far |
| A v1 project is opened after the schema moves to version 2 | Migrate to the same candles in the same place; the saved document keeps its length and its provenance |
| A v2 project holding chart-anchored drawings is opened after the schema moves to version 3 | Map the old element types to the new ones, keep a price line's price as its caption, and place the drawing from the chart's plot area and full-series price range — an approximation at the last frame; the migration is non-destructive and idempotent |
| A v3 project is opened after the schema moves to version 4 | The drawings become the shapes they are: a trend line, an arrow and a high/low line carry two absolute points and no box; a horizontal line keeps its width as its length; a vertical line keeps its height; a text label keeps its point and loses its box; the rectangle keeps its box; the position tool keeps its box and gets absolute levels; the trend line's ray is dropped; the migration is non-destructive and idempotent |
| A drawing's points are missing from a hand-authored document | The migration leaves that drawing alone, the definition's defaults fill in, and it renders as the defaults say |
| A text is selected before its font has loaded | The measured box is an estimate; it settles once the font arrives and does not stay wrong |
| A text has no content | The measured box is empty, so the overlay falls back to a minimum size rather than drawing a zero-height rectangle |
| Two endpoints sit at the same spot (a zero-length line) | The region collapses to a point, picking falls back to the point tolerance, and the two handles sit on top of each other — no crash and no division by zero |
| An authored swing path is edited | Regenerate the series from the stored path, seed and algorithm version; the same path always yields the same bars |

## 8. Developer interface expectations

Every requirement ID should have an automated test (unit, integration, browser or E2E) or a documented manual verification step. Major types and interfaces are specified in [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md). Feature-to-requirement mapping is in [Feature Catalogue](../features/FEATURE_CATALOG.md). The test fixtures intentionally include synthetic OHLC, mixed source revisions, DST/session gaps and three correlated-index aliases that are treated as distinct feeds. The requirement IDs added for the chart element model — MD-009, MD-010, AP-001 to AP-004, CH-009, OB-010, CV-001 to CV-004, TL-009 and TL-010 — are covered by the assertion sets the [Test Strategy](../quality/TEST_STRATEGY.md) §3.1 records for that slice, which also names the surfaces that slice leaves unasserted (the transport-action contract). The requirement IDs added for the independent drawing elements — OB-011 to OB-015 and CV-005, with CH-009, OB-003, OB-004, OB-005 and OB-010 rewritten to read as they now do — are covered by the assertion sets the [Test Strategy](../quality/TEST_STRATEGY.md) §3.2 records for that slice, which also names the surfaces that slice leaves unasserted (the canvas context menu and the drag of a drawing's point handles — `apps/studio` has no test files). The requirement IDs added for the element edit model — EM-001 to EM-009 and CV-006, with OB-003, OB-004, OB-005, OB-010, OB-012 and CH-009 rewritten to read as they now do — are covered by the assertion sets the [Test Strategy](../quality/TEST_STRATEGY.md) §3.3 records for that slice, which also names the surfaces that slice leaves unasserted (the overlay's rendering, the pointer wiring and the text measurement, all of which live in `apps/studio`, which has no test files).

## 9. Deferred behavior (not implementation tasks for v1)

True tick ingestion and authentic tick-order reconstruction; automatic SMT scanner and strategy alerts; support for inverse-correlated SMT rules; broker/API integrations; backtesting; full rich audio mixer; subtitling/transcription AI; fully nested NLE compositions; collaboration; network/cloud export; full mobile authoring; paid Remotion starter purchase unless separately approved. CSV/JSON import, the UTC market-time binding and the overlay model for imported bars are deferred to the import slice, which lands behind the datasource seam of MD-009 and adds no importer, wizard or file reading to this slice. **Rotation** is deferred: it would be a new prop on every element, a new transform in every renderer and a new rule in the pick test, and it is meaningless for a chart.

## 10. Sign-off checklist

Owner is asked to sign off on: Remotion as the unified video runtime, typed scene-chart object lifecycles, basic trading tools, v1 local MP4 gate, SQLite WASM/OPFS strategy, user-confirmed assisted SMT semantics, no-lookahead MTF, local Save vs external Save As, and the creator-ready MVP list. A signed-off spec is the input to Superpowers implementation plans; no code or package installation is authorized merely by writing this document.
