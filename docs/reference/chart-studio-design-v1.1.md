# Chart Studio — Consolidated Product & Technical Design

**Status:** Proposed for review — not yet approved for implementation  
**Version:** 1.1 design candidate — SMT + MTF + SQLite revision  
**Date:** 2026-10-24  
**Product:** Chart Studio (independent trading-animation editor inspired by ChartAnimator)  
**Scope:** Creator-ready MVP **including assisted SMT (2–3 assets) and synchronized MTF**, with forward-compatible extension points  
**Suggested repository path:** `docs/superpowers/specs/2026-10-24-chart-studio-design-v1.1.md`

> **Document status and provenance.** This revises the preceding v1.0 design candidate. Previously approved decisions remain in force; the user has additionally approved assisted SMT and requested synchronized multi-asset/MTF support and SQLite WASM. SQLite backend configuration, alignment defaults, and advanced SMT UX described below are explicit engineering proposals pending review. No software implementation is claimed.

> **Source and verification boundary.** This specification consolidates the product and engineering decisions made during brainstorming. It is a proposed independent implementation, **not** a claim that ChartAnimator uses the same internals or provides identical workflows. The four referenced YouTube demonstrations were not successfully analyzed. Any claim of exact feature parity requires separate validation against the reference product.

## 1. Executive summary

Chart Studio is a **local-first trading-native video creator**, built so an educator can explain a real strategy end-to-end. Manual candle construction and imported authentic OHLC are equal source workflows. The **creator-ready MVP additionally supports 2–3 assets for Smart Money Technique (SMT) divergence and multiple timeframes (MTF) of the same or different assets**, synchronized without implying the instruments share price scales or complete identical sessions. It is not merely a single-chart video animator with several charts pasted beside one another.

**Assisted SMT, not automated trading advice:** the creator selects two successive comparable swing highs or lows on one asset. Chart Studio suggests temporally corresponding swing pairs on another one or two assets using explicit configuration and a deterministic candidate ranking. The creator chooses/adjusts the counterparts, confirms the divergence narrative, and animates the linked event across charts. No automatic trade signal, conclusion, or profitability claim is generated. A three-asset case consists of identified pairwise comparisons, not an unexplained opaque triple-signal.

**MTF:** group a 4H/15M/1M sequence, visualize timeframes together or transition between them, share market-time replay when data allows, and never expose finished higher-timeframe highs/lows before those values were known. A lower-timeframe source can be deterministically aggregated upward according to session/calendar rules; a higher-timeframe source cannot be used to fabricate authentic lower-timeframe bars.

Candles animate by **discrete reveal** or **seeded, explicitly simulated dynamic motion**. Authentic tick replay remains a distinct extension. A hierarchical timeline composes scenes at project level and precise chart/drawing/media tracks at scene level. A pure, frame-addressable evaluator drives both preview and export.

**Persistence change:** the proposed initial local database is **SQLite WASM running in a dedicated worker, persisted via OPFS** (subject to an implementation compatibility spike), with OPFS content-addressed external media/dataset assets. The database stores project index, versioned documents, candle indexes/overlays, asset manifests, chart/SMT metadata, and recovery revisions. It replaces IndexedDB as the canonical application data store. Browser storage remains origin-bound, so Open, Save As, and portable `.chartstudio` archives stay mandatory. Optional cloud sync and server rendering are deferred, not dependencies.

The MVP is accepted only when a complete 2–3-asset SMT + MTF educational video can be created, saved, reopened, transported, and exported locally, in addition to all previously approved creator-ready features.

## 2. Intent, audience, success, and constraints

### 2.1 Who it serves

- Traders explaining **their own playbooks**, particularly correlated-index SMT divergences and top-down MTF setups.
- Trading educators recording market context → relative-liquidity divergence → lower-timeframe execution → outcome.
- Content creators who need precise source-aware charts, replay timing, graphics, narration/audio, and video export without a general-purpose editing suite.

### 2.2 Goals

1. Produce complete trading-style videos, not merely isolated candle animations.
2. Treat manual bars and imported actual OHLC as equal, editable inputs with preserved provenance.
3. Build **2–3-asset comparison groups** with independent price scales, aligned market time, selective focus, and linked annotations.
4. Build **multi-timeframe compositions**, either simultaneous panels or animated timeframe drill-downs, without future-data leakage.
5. Make SMT identification **assisted and creator-confirmed**, with explicit candidate selection, lineage, divergence classification, invalidation, and animation.
6. Support complete-candle reveals and synthetic dynamic motion; never mislabel simulated price as observed tick history.
7. Enable multi-scene hierarchical editing, captions, basic audio, images, locally rendered MP4/PNG, and portable project exchange.
8. Save reliably without an account, using SQLite WASM + OPFS as the proposed primary local store, while allowing optional future cloud services.

### 2.3 Non-goals / anti-goals

- Not a broker, live terminal, order executor, strategy backtester, profit predictor, or provider of trade recommendations.
- Not an automatic SMT signal scanner in the MVP. An algorithm may **rank corresponding pivot candidates** after a user initiates an observation but cannot autonomously label completed trades or execute decisions.
- Not a pixel-perfect, proprietary-code, asset, or brand clone of ChartAnimator; the reference videos were not verified.
- Not a complete professional nonlinear video editor, real-time collaboration platform, or a mandatory subscription/cloud service.
- No silent forward-looking resampling, hidden data gap fills, automatically presumed correlation, or forged lower-timeframe bars from higher-timeframe OHLC.
- No implicit synchronization of timestamp-less manual scenarios to real market timestamps; the creator must author a correspondence mapping.
- No silent overwrites of imported source data, external project files, concurrent editor revisions, or missing media.

### 2.4 Constraints and assumptions

- Proposed launch target: modern Chromium desktop browsers, with explicit capability checks; broader browsers are a compatibility goal, not promised parity.
- OPFS, browser storage quotas, encoding capabilities, calendar/session metadata, and WASM thread features vary by environment. Unsupported conditions must produce visible recovery guidance.
- Offline operation follows first-load/app-shell availability; historical input must be imported or already stored locally.
- Frame numbers are integer with rational FPS; market timestamps are separate UTC instants with configured exchange/session timezone rules.
- User-confirmed SMT classifications are **educational annotations** and must be carried through edits/reimports via stable source revisions and validation status.
- All proposed timings, dataset size targets, and render performance are test objectives—not verified guarantees.

## 3. Decision record

### 3.1 Approved user/product decisions

| ID | Decision | Consequence |
|---|---|---|
| D-01 | Manual construction + real OHLC import are equal first-class workflows | Shared candle/series model with provenance |
| D-02 | Discrete reveal + dynamic price motion are first-class animation modes | Two evaluators on the same frame clock |
| D-03 | Simulated OHLC motion must never masquerade as authentic tick history | Source-aware mode labels; authentic tick engine deferred |
| D-04 | Local-first with optional future cloud sync/render | Editor functions offline from local snapshots |
| D-05 | Autosaved internal workspace **and** Open/Save As/portable export | Explicit local-vs-external-save states |
| D-06 | Hierarchical project composition and scene-local detailed timeline | Global scene scheduling + local animation tracks |
| D-07 | Creator-ready MVP including captions/images/basic audio | Full educational video workflow |
| D-08 | **SMT across 2–3 assets in v1** | Multi-asset chart groups and cross-chart annotations in the core |
| D-09 | **MTF in v1** | Multiple chart instances/timeframes, time alignment and drill-down |
| D-10 | **Assisted, user-confirmed SMT identification in v1** | Candidate suggestions, explicit selection/confirmation, no auto trade signals |
| D-11 | **SQLite preferred as the first-version database** | Replace IndexedDB persistence design with SQLite WASM/OPFS architecture, contingent on browser validation |

### 3.2 Proposed implementation decisions for sign-off

- TypeScript monorepo, React client editor/Next.js shell, Tailwind + shadcn/ui, Zustand for transient editor/transport state, Zod schemas and migrations.
- Canvas2D typed display-list renderer at MVP, allowing future renderer substitution; **multiple chart viewports** are native scene objects, not independent browser chart widgets with separate clocks.
- **SQLite WASM (`@sqlite.org/sqlite-wasm`) inside one database worker**, default VFS candidate `opfs-sahpool`, stored in OPFS; enforce single logical writer. This VFS has a notable concurrency constraint. If initial compatibility tests show it unsuitable, revisit VFS choice explicitly rather than silently replacing the architecture.
- OPFS files for content-addressed originals and media; SQLite for structured project state, indexes, candle data/overlays, timestamps, revisions, and manifests. Large future tick data may use indexed binary chunks.
- A shared UTC market-time alignment service with per-symbol timeframes/sessions and authored offsets. **Never normalize/align by candle index alone** for actual market data.
- **MTF aggregation policy:** use lower/equal-granularity source bars only, exchange-session-aware bucket boundaries, partial higher-timeframe bars during replay, no future lookahead.
- **Assisted SMT policy:** creator chooses an anchor swing first; candidate ranking considers elapsed time window, comparable swing type and availability/confirmation, with editable tolerances. All suggested swings require user confirmation.
- PNG still + browser-supported H.264/MP4 export through WebCodecs and muxing with feature detection; basic audio alignment. Future cloud jobs use immutable same project/asset snapshots.
- Vitest/Playwright for invariants, fixture-driven synchronized multi-chart replay, SQL migration/recovery, and export parity.
- No MVP linked-file autosave, provider APIs, authentic tick replay, or cross-device sync. Save commits locally; Save As creates portable archive.

These are recommended implementation defaults, not claims about ChartAnimator's internals or mandatory libraries where equivalent behavior can be achieved safely.

## 4. Architectural alternatives and trade-offs

| Concern | Alternatives considered | Selected direction and trade-off |
|---|---|---|
| Chart authoring | Manual-only vs imported-only vs shared hybrid | **Hybrid**, more source/provenance work but enables authentic + hypothetical narratives |
| Comparison charts | Separate independent chart widgets vs scene-native linked charts | **Scene-native multi-chart groups**; one clock/data model supports SMT, MTF and export |
| SMT | Freehand only vs automatic scan vs assisted | **Assisted**; user initiates, system ranks candidates, user confirms; avoids opaque false positives |
| Multi-timeframe | Import each timeframe separately vs aggregation only vs both | **Both**; preserve imports, derive coarser bars where valid; no invented lower TF |
| Replay | Stateful forward-only vs pre-rendered vs pure frame evaluation | **Pure random-access evaluator** with indexes/caches; deterministic scrubbing and export |
| Timeline | One global track pile vs disconnected scenes vs hierarchy | **Hierarchical composition + scene details** |
| Persistence | IndexedDB documents vs native SQLite desktop backend vs SQLite WASM/OPFS | **SQLite WASM/OPFS** for relational/time-range queries and transactions; single-writer and compatibility costs |
| File management | Browser workspace only vs file-only vs both | **Internal autosaved workspace + portable archives** |
| Deployment | Mandatory cloud vs strictly browser-only vs optional cloud | **Local-first, cloud adapters later** |
| MVP | Chart demo vs full media editor vs creator-ready middle scope | **Creator-ready + SMT/MTF**; trims advanced editing but maintains full workflow |

## 5. Information architecture, dashboard, and editing UX

### 5.1 Application surfaces

1. **Dashboard:** New Manual Project, Import OHLC, Open Project, Templates; recent projects as thumbnails with rename, duplicate, delete/restore, filter/sort and storage/sync status.
2. **Project composition view:** Scene strip with order, transition overlaps, in/out, global playback and full-project export.
3. **Scene editor:** Canvas, chart groups, tool rail, layer browser, context inspector and multi-track scene timeline.
4. **Data + asset manager:** Instruments, symbol aliases, timeframes, source revisions, imports, bar validation, media and export assets.
5. **SMT comparison workspace/panel:** Select asset pair(s), anchor swing, candidate swings, comparison window, divergence classification, confirmation, linked annotation style.
6. **MTF chart workspace/panel:** TF selection, relationship/derivation, synchronized preview and timeframe focus transitions.
7. **Export and project files:** Save status, portable archive, preview/render jobs and codecs/errors.

### 5.2 New project workflows

- **Manual:** construct candles and choose symbolic/logical market-time mapping, or author real timestamps explicitly.
- **Import:** CSV/JSON mapping, instrument identity and price basis, source timestamps, timezone/session, timeframe, data-quality review, and range selection.
- **New SMT + MTF Breakdown (recommended creator preset):** add 2–3 instruments, choose source datasets and timeframe views, create synchronized chart group, and start with suggested `Market Context → SMT → Entry → Outcome` scene names. User can edit every detail; preset does not auto-assert a divergence.
- **Open portable project:** validate manifest, hashes and schema before publishing a workspace copy.

These are entry points only. Any project can later mix manual/imported series, asset groups, timeframes, scene types and layouts.

### 5.3 Editor layout

- **Header:** project/scene breadcrumb, current save state, undo/redo, preview/export.
- **Tool rail:** select, candles, price line, zone, trendline, cross-chart SMT link, text, position marker, image.
- **Left browser:** Scenes / Layers / Assets / Instruments (tabs), searchable and collapsible.
- **Center canvas:** scene drawing surface; resizable synchronized 2-pane horizontal/vertical or 3-pane grid layouts and optional focus one-chart mode; each chart retains independent vertical scale.
- **Right inspector:** object/clip type-specific controls, chart sync, timeframe, price anchors, data provenance, SMT comparison/confirmation, keyframes.
- **Bottom:** project scene composition timeline or detailed local scene timeline, independently resizable with distinct zoom/playhead memory.

**Navigation:** double-click scene instance or press Enter to edit scene, breadcrumb/back returns to composition. Selection and playback state must remain scoped to editing context, not globally confused. A 3-chart group is selected/moved as a group or its individual chart slots can be edited after entering group mode.

**SMT assisted interaction:** click `Compare SMT` → select 2/3 instruments and comparison timeframe → select primary swing on chart A → highlight time-aligned candidate swing pairs on B/C and show why candidate is suggested → user confirms/adjusts each counterpart and names divergence → linked cross-chart lines/labels appear → choose staged reveal/keyframe timing on the scene timeline. `Proposed` and `Confirmed` are visibly different states.

**MTF story interaction:** add 4H/15M/1M chart views, arrange panels, select linked market-time cursor; author camera focus changes at frames (e.g. zoom or resize/focus from HTF context to LTF setup), without mutating or fabricating candles. One scene can present simultaneous MTF; multiple scenes can reuse series and transition between levels of detail.

Keyboard/gesture defaults: Space play/pause when not entering text; Ctrl/Cmd+Z undo, Ctrl/Cmd+S local save; Escape cancel; selection, multiselect, snapping, group/lock, copy/paste, context menus and a grouped undo action for drag gestures. Invalid sync/configuration is shown in context rather than hidden by guessed alignment.

## 6. Canonical domain, instrument, chart-group, and SMT data models

### 6.1 Relationship model

```text
Workspace (SQLite WASM + OPFS)
 └─ Project (immutable revision snapshots)
     ├─ SourceDataset[] (instrument, timeframe, session, price basis, hash)
     │   └─ SourceBar[] (canonical UTC timestamp + OHLC + provenance)
     ├─ EditableSeries[] (source refs + ordered inserts/overrides)
     ├─ InstrumentDefinition[] (identity, display alias, exchange/session metadata)
     ├─ ChartViewDefinition[] (series, timeframe, viewport, independent price scale)
     ├─ ChartGroupDefinition[] (2–3 asset SMT or multi-TF layout, sync policies)
     ├─ SMTObservation[] (anchor swing + 1–2 corresponding swings + comparison result)
     ├─ MediaAssetRef[]
     ├─ SceneDefinition[] (scene objects + local timeline)
     └─ ProjectComposition (scene placements and transitions)
```

Project-specific objects use stable IDs; `ChartViewDefinition` may have many scene instances, and observations reference stable dataset/series and swing identities. Source datasets remain immutable. Scene instances reference reusable chart group definitions rather than copying bar arrays.

### 6.2 Structural interfaces (design-level TypeScript)

```ts
type Id = string;
type UTCMillis = number;
type Rational = { num: number; den: number };
type Timeframe = { kind: 'fixed'; seconds: number } |
                 { kind: 'calendar'; unit: 'day' | 'week' | 'month'; count: number };

type MarketTimeBinding =
  | { kind: 'historical'; utcMillis: UTCMillis; sessionId?: string }
  | { kind: 'authored'; anchorId: Id; logicalOffset: number };

interface InstrumentDefinition {
  id: Id;
  displaySymbol: string;         // e.g. creator-facing NAS100
  providerSymbol?: string;       // provider mapping; not assumed equivalent
  venue?: string;
  priceBasis: 'last' | 'bid' | 'ask' | 'mid' | 'unknown';
  sessionCalendarId?: Id;        // hours, holidays, timezone/DST policy
  precision?: number;
}

interface SourceDataset {
  id: Id; instrumentId: Id; timeframe: Timeframe;
  sourceRevision: string; contentHash: string;
  timestampPolicy: 'bar-open' | 'bar-close';
  calendarId?: Id;
  quality: { gaps: number; duplicates: number; malformed: number };
}

interface ChartViewDefinition {
  id: Id; instrumentId: Id; seriesId: Id; timeframe: Timeframe;
  priceScale: { mode: 'independent' | 'percentage'; reference?: number };
  viewport: ChartViewport;
  replayChannelId: Id;
}

type ChartGroupLayout =
  | 'horizontal' | 'vertical' | 'grid' | 'focus';
interface ChartGroupDefinition {
  id: Id;
  purpose: 'smt' | 'mtf' | 'comparison';
  viewIds: Id[];                 // supported 2–3 for SMT MVP
  layout: ChartGroupLayout;
  sync: {
    marketTime: 'linked' | 'independent' | 'authored-map';
    playhead: 'shared' | 'independent';
    crosshair: boolean;
    camera: 'independent' | 'focus-animated';
    missingBar: 'gap' | 'hold-last-known';
  };
}

interface SwingPoint {
  id: Id;
  chartViewId: Id;
  candleId: Id;
  kind: 'high' | 'low';
  price: number;
  marketTime: MarketTimeBinding;
  sourceRevision: string;
  origin: 'user-selected' | 'suggested';
  pivotConfirmedAtUtc?: UTCMillis; // first instant eligible to be shown as known
  confirmation: 'unconfirmed' | 'confirmed';
}

// SMT compares TWO successive corresponding swings of the SAME kind
// on EACH instrument. A single point per asset is insufficient.
interface SwingSequence {
  id: Id;
  chartViewId: Id;
  kind: 'high' | 'low';
  priorSwingId: Id;
  currentSwingId: Id;
  relationship: 'higher' | 'lower' | 'equal';
  priceTolerance: number;       // instrument-local units, not universal price
}

interface SMTPairComparison {
  id: Id;
  referenceSequenceId: Id;  // asset A: prior + current
  counterpartSequenceId: Id; // asset B/C: prior + current
  divergenceType: 'bearish' | 'bullish' | 'non-confirmation' | 'custom';
  status: 'proposed' | 'confirmed' | 'rejected';
  confirmedByUserAt?: number;
}

interface SMTObservation {
  id: Id;
  chartGroupId: Id;
  anchorSequenceId: Id;
  counterpartSequenceIds: Id[];    // 1 or 2 distinct assets
  comparisons: SMTPairComparison[]; // explicit A↔B, A↔C where relevant
  window: { kind: 'historical'; startUtc: UTCMillis; endUtc: UTCMillis } |
          { kind: 'authored'; mappingId: Id };
  pivotPolicy: { leftBars: number; rightBars: number;
                 maxTimeOffsetMs?: number };
  correlationMode: 'positively-correlated';
  status: 'draft' | 'confirmed' | 'stale' | 'invalid';
  sourceRevisions: Record<Id, string>; // dataset ID -> exact revision
  userNote?: string;
  revealClipIds?: Id[];
}

interface ChartProject {
  id: Id; schemaVersion: number; revision: number;
  name: string; output: { width: number; height: number; fps: Rational };
  instruments: InstrumentDefinition[];
  datasetIds: Id[]; chartViews: ChartViewDefinition[];
  chartGroups: ChartGroupDefinition[]; smt: SMTObservation[];
  sceneDefinitions: SceneDefinition[];
  composition: ProjectComposition;
}
```

`SceneDefinition`, `ProjectComposition`, `ChartViewport`, `SwingSequenceSelection` and animation types follow the existing v1.0 typed domain contracts or are planning-time placeholders; production schemas must use discriminated unions, source-revision checks, and explicit validators. No untyped map should become canonical project state.

### 6.3 Candle series and provenance

An editable working series is a source dataset plus ordered overlay operations: insert, override OHLC, remove/hide, reset. Each candle retains a stable logical candle ID and a source revision if imported. Validate finite prices, `high ≥ max(open, close)`, `low ≤ min(open, close)`, and optional nonnegative volume. **Working edits never mutate immutable source data.** If a referenced bar changes after reimport, dependent swings/SMT observations must be checked for staleness.

Real OHLC sync requires actual UTC market-time bindings. A timestamp-less manually constructed candle is linked across views only when the creator supplies an **authored alignment mapping**; it must not acquire a fake historical timestamp. Authored scenarios can be linked by explicit logical steps or anchored to an authentic timestamp and marked as hypothetical.

### 6.4 Chart groups and multi-asset semantics

- SMT groups contain **2 or 3 distinct instrument identities**, each with its own chart view and independent raw price scale. The scene may contain further unrelated charts but the SMT comparison limits are explicit.
- Layout presets: two panels horizontal/vertical; three panels balanced grid; animated focus/spotlight state and optional percentage-normalized comparison. Normalization must never change raw OHLC or market-price labels.
- Each view can have independent zoom and scrolling while sharing a **market-time cursor**. Crosshair sync is optional. Camera focus/solo/fade/resize is animatable and saved as scene clips.
- Missing bars, differing holidays, DST, exchange calendars, provider timezones, timestamp bar-open/bar-close conventions, and futures vs CFD session policies must surface alignment diagnostics. Distinct instruments are never compared merely by matching row index.
- Sync maps an instant to a bar interval using `[barStartUtc, barEndUtc)`; if none exists, apply the user-selected `gap` or `hold-last-known` visual policy. Holding a previous *completed* value must never imply a current trade or fabricated candle.
- The product does **not** assume symbol aliases such as NAS100, NQ, US100 are identical feeds. The user chooses canonical instrument mapping and source metadata; aliasing is a display convenience, not a data-merging guarantee.

### 6.5 MTF data construction and no-lookahead contract

- Users may import each timeframe independently or derive a **higher timeframe** from a finer timeframe with compatible price basis, data source, and declared market calendar. No authentic lower timeframe is derivable from coarser OHLC alone.
- Aggregation for constituent bars in a bucket: first open, maximum observed high, minimum observed low, last observed close, optional summed volume. Buckets are defined in the instrument's declared session timezone/calendar and converted to UTC; calendar day/week/month are not fixed 24h/7d/30d assumptions.
- **During replay**, the current higher-timeframe candle is only the aggregate of constituent bars already revealed/eligible at the queried market instant. The completed HTF high/low/close must not leak before HTF close. At a partially revealed lower bar, its partial state (when available) contributes, not its eventual finalized H/L/C.
- If the finest source is 15-minute OHLC, the engine can only know completion states at that resolution. It must not claim intrabar accuracy from 15-minute bars when inspecting a 1-minute position; request genuine finer source or label simulated motion.
- An externally imported higher-timeframe series may be presented as a **completed-candle historical view** for general retrospective storytelling, but a chronological replay must avoid revealing future bars by applying partial/closed-bar rules. If there is no appropriate finer-granularity data, a forming HTF bar may be hidden until completion or displayed through an explicitly marked simulation—not as authentic partial HTF values.
- MTF alignment tests must cover weekends/holidays, gaps, DST changes, bar-open/close conventions, fixed and calendar frame boundaries, and no-lookahead seeking.

### 6.6 Assisted SMT workflow and semantics

**Creator-driven workflow:** select group/timeframe → choose asset A and its **prior/current swing pair** of the same kind → suggest one corresponding prior/current pair on each other asset in an explicitly configured UTC/session window → inspect and adjust those counterpart pairs → confirm each pairwise divergence → add linked SMT object, labels and animation clip(s).

**Candidate generation (not automatic SMT classification):** find eligible **prior/current swing pairs**, whose pivot points are already confirmed as-of-replay, on comparison series using a deterministic pivot policy with configurable left/right bars. Rank candidates by temporal proximity within a declared tolerance and matching swing kind; additionally show if data is missing or incomparable. A pivot is not labeled confirmed until the required right-side bars have actually closed; no future lookahead. Provide an explicit *manual select* fallback when no candidate meets policy.

**Divergence narrative:** for positively correlated indices, asset A’s two highs may form a higher high while B’s corresponding two highs form a lower/equal high (bearish-style non-confirmation), or asset A’s two lows form a lower low while B’s corresponding two lows form a higher/equal low (bullish-style non-confirmation). The reviewer decides the comparison interpretation; equality tolerance and price tick size are configurable. For a 3-asset group, record A↔B and A↔C individually, including different outcomes. The tool must not silently synthesize a single '3-way SMT' label from contradictory pair results.

**Integrity and recovery:** store **both prior and current candle IDs per compared instrument**, source revisions, instrument-local equality thresholds, pivot policy, time window, status, author confirmation, optional explanatory note, and animation references. If referenced bars are edited, missing, or remapped after reimport, mark the observation `stale` or `invalid`, preserve the creator's explanation, and require reconfirmation; never silently relink to another pivot. Manual swing choices remain allowed and are displayed as manually chosen.

**MVP exclusions:** unattended continuous scanning, automatic trade signals/alerts, detection across negative/inverse correlations without explicit semantics, profitability scoring, and hard-coded ICT validity rules. The architecture allows future detector plugins but does not claim semantic truth beyond explicit user confirmation.

### 6.7 Cross-chart SMT annotations

Introduce `SMTAnnotation` as a typed scene object referencing `SMTObservation.id`. It composes a set of **chart-local market-anchored drawing segments** and optional scene-space connectors/callouts, not one line pretending different price scales are interchangeable. Every chart segment has `chartViewId`, source candle/swing identity, market time and price anchor. When charts pan/zoom/resize or the project switches 2→3 columns, anchors reproject independently. Timeline clip(s) can reveal the anchor, counterpart, divergence label and educational emphasis in stages, all evaluated from one project frame without mutating underlying candles.

### 6.8 Source-integrity rule for comparison screenshots/videos

An exported video must visibly distinguish **synthetic price paths** from authentic historical bars where that difference is material. If an SMT case includes modified/hypothetical bars, the annotation inspector and exported metadata must report affected provenance; optional visual badges are available. Do not present hypothetical multi-asset correlation as verified historical divergence.

## 7. Animation and price-integrity model

### 7.1 Clock separation

- **Presentation time:** integer project/scene frame index; rational FPS.
- **Market time:** candle position or actual timestamp in input data.
- **Transport:** interactive preview rate/playing state, never exported timeline duration.

`evaluate(projectSnapshot, frameIndex) -> EvaluatedScene` is pure with respect to project snapshot and frame. No dependence on the previously rendered frame, current wall time, or unseeded randomness.

### 7.2 First-class user modes

| Mode | Engine behavior | Integrity label | MVP |
|---|---|---|---|
| Discrete candle reveal | Instant, sequential or grouped final-geometry appearance | Full OHLC reveal | Yes |
| Dynamic simulated | Partial candle state derived from seeded OHLC-consistent synthetic path | **Simulated** | Yes |
| Dynamic authentic tick | Partial OHLC derived from real tick observations and declared price basis | **Tick Data** | No (schema/interface reserved) |

Discrete reveal effects may include instant and basic fade/grow/wipe. Growing a final candle is **not** evidence of historical price movement.

Simulated paths must begin at O, end at C, attain H and L, and never exceed them; choose explicitly between O-H-L-C, O-L-H-C, or a constrained seeded profile. Store algorithm ID/version, profile and seed. Path must yield a valid partial candle at every progress fraction; completed state must equal source OHLC exactly. Authentic tick playback requires timestamped observations, price basis, aggregation alignment, gap reporting, and reconciliation with any imported OHLC.

### 7.3 Timeline tracks and clips

Per scene: chart replay, camera, drawings, captions/text, image/video overlay (MVP image, video later), keyframe/property, and basic audio tracks. Objects retain visual z-order independently of track order. Clips use half-open intervals `[startFrame,endFrame)` and stable IDs.

`ChartReplayClip` references chart, candle range, timing curve, chosen mode, and optional simulation profile; **never duplicates source dataset content**. Clip-time mapping converts presentation progress to candle position plus intrabar progress. For forward-only replay, mappings are monotonic. Speed ramps/holds are stored as project animation data, distinct from preview speed.

Property keyframes cover position, scale, opacity, and basic easing in MVP. Conflicting clips controlling one exclusive chart playback channel are rejected or must use an explicit transition; independent properties may coexist. Composition policy is deterministic and shared with export.

### 7.4 Playback transport

Play/pause, restart, seek, frame stepping, candle-milestone stepping, temporary preview rates (0.25×–4×), loop in/out, follow-playhead, preview quality selection. Playback state belongs to the ephemeral editor session. Seeking directly to an arbitrary frame must yield exactly the same evaluated scene as sequential playback.

### 7.5 Synchronized multi-chart playback (MVP)

A scene uses **one presentation-frame clock**; each chart replay clip maps presentation progress into its source market-time or authored-logical axis. A `ChartGroupSyncController` resolves one selected `MarketCursor` per group and yields each view's appropriate visible/partial bar state. Different timeframes do not need equal candle counts. The same source instant must align across all views even if chart A is 1M and chart B is 4H.

- **Linked mode:** all chart views advance on one market cursor, exposing missing/closed bars honestly; per-chart viewport and vertical scaling remain independent.
- **Independent mode:** creator intentionally offsets/freezes a comparison chart for teaching; mark this as unlinked in the inspector and optionally in the video UI, not as live synchronous market behavior.
- **Authored-map mode:** manually built series may join a sequence through explicit mapping and must be marked authored/hypothetical.
- **Chart focus animations:** spotlight, camera pan/zoom, panel opacity and layout transitions operate in scene presentation time, not market time.
- **Seeking:** direct random seek at global frame N computes market cursor and each chart's state from indexed bars; no hidden previous-frame state, synchronized candidate pivot detection respects observations **confirmed and available** at N (swing confirmation may occur after the pivot bar).
- **Multiple replay clips:** enforce one exclusive market-cursor controller for a linked group unless an explicit transition/blend is configured; reject contradictory playback clips.
- **Tick data:** authentic tick-based partials remain a later engine; simulated motion remains explicitly labeled even if multiple correlated charts animate simultaneously.

## 8. Hierarchical scene composition

### 8.1 Scene-level editing

- Enter via double-click scene card or scene navigator; breadcrumb returns to project overview.
- Show only the selected scene's detailed tracks, chart instances, and scene objects.
- Scene duration can be extended or trimmed; trimming retains hidden out-of-range clips for subsequent recovery. Proportional retiming is a distinct explicit stretch operation.
- Duplicating a scene creates new scene/object/clip IDs and reuses immutable asset/source refs. Undo/redo groups duplication into one command.

### 8.2 Project-level editing

- Ordered scene instances and editable cut/crossfade boundaries.
- Scene cards show name, thumbnail, effective duration, and warnings; drag to reorder.
- A project-level playhead maps through scene instances to local frame positions.
- During a crossfade, evaluate **both** participating scenes and composite their rendered outputs using the transition weight.
- All scenes use one project FPS and output canvas resolution in the MVP.

For transitions of `O` frames, the global duration is `sum(effective scene frames) - sum(overlap frames)`. Crossfade overlap cannot exceed either adjacent scene's available trimmed duration. Cut has zero overlap. For the MVP, scene-local audio is mixed through the same composition overlap: in a crossfade, the outgoing scene fades down linearly while the incoming scene fades up linearly; individual clip gain settings apply before this transition mix. Audio crossing a cut does not continue into a different scene unless explicitly extended in a later feature. Duration edits must reveal whether the operation trims, stretches, or changes composition overlap.

### 8.3 Navigation and selection invariants

Project and scene timelines have independent zoom/scroll/playhead states. Switching context does not implicitly modify project data. Selection-sensitive inspector and tools are scoped to the active scene. Global preview respects project composition; scene preview respects the scene timeline only. Both use the same evaluator and renderer.

### 8.4 Scene layouts for SMT + MTF

A scene supports chart-group objects as first-class child containers. 2-asset SMT may use split horizontal/vertical panels; 3-asset SMT uses a balanced configurable grid; MTF uses equal panes or a primary HTF view with LTF inset. Charts retain independent y-axis scale and data provenance, but optional shared time cursor and chart-highlight focus animation. Responsive editor preview may change *editing panels*; exported chart group layout remains determined by canonical scene geometry.

Recommended scene narrative template: **Context (HTF) → SMT Comparison (2–3 assets) → LTF Execution → Outcome**. Scene instances share immutable datasets and SMT observations; each can author independent camera/keyframe presentation. Cross-scene transitions use the existing composition contract and never advance the market clock implicitly.

## 9. SQLite WASM, OPFS persistence, files, and asset lifecycle

### 9.1 Local storage decisions

**Canonical application database: SQLite WASM**, executed in a dedicated database Web Worker and persisted in OPFS. It replaces IndexedDB for structured project metadata/revisions. OPFS also stores content-addressed media/datasets larger than practical SQL rows. IndexedDB may still be used only for noncritical browser-library caching if a browser implementation requires it; it is not a second source of truth for projects.

The official SQLite WASM documentation documents OPFS VFS trade-offs: `opfs-sahpool` offers performance and avoids COOP/COEP isolation requirements but generally cannot support simultaneous connections to the same DB; the standard `opfs`/`opfs-wl` variants have their own concurrency and browser constraints. **Proposed MVP:** prove `opfs-sahpool` functionality in a compatibility/performance spike, centralize SQL through a single worker, and actively prevent concurrent editors from owning the same DB. References: https://sqlite.org/wasm/doc/tip/persistence.md and https://github.com/sqlite/sqlite-wasm .

**Browser constraints:** OPFS storage is per origin, subject to quota/eviction and user-cleared site data; SQLite does not turn a browser into an unconstrained desktop file system. Request persistence when available; show storage health, warnings, and portable backup affordances. When the selected persistent SQLite backend is unavailable, surface an explicit unsupported-storage mode rather than pretending memory-only data is safely autosaved.

### 9.2 Single-writer DB worker and SQL transactions

- All SQL access goes through typed RPC into one worker instance per active browser tab; *cross-tab coordination* uses Web Locks (where available), BroadcastChannel notifications and SQLite revision checks, with safe startup ownership handling. The test plan must validate lock behavior after abrupt tab crashes.
- Only the owner can write the local workspace database. Other tabs are read-only or blocked with a user-visible prompt; never split one workspace into two unnoticed mutable DB instances.
- Use foreign keys, declared indexes, transaction boundaries, `schema_migrations`, expected-revision compare-and-swap, and parameterized SQL; access through repository interfaces, not direct React SQL.
- Store each project as normalized indexed metadata and versioned JSON scene/timeline snapshots (or typed tables where queries require it); SQLite transactionally commits project revision metadata, command history and relational records together.
- Keep responsive editing in-memory; batch gesture updates into meaningful commands and debounced commits. Worker SQL processing must not block the UI thread.

### 9.3 Logical schema sketch (names illustrative)

```sql
PRAGMA foreign_keys = ON;
CREATE TABLE projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  revision INTEGER NOT NULL, schema_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE source_datasets (
  id TEXT PRIMARY KEY, instrument_id TEXT NOT NULL,
  timeframe_key TEXT NOT NULL, calendar_id TEXT,
  timestamp_policy TEXT NOT NULL, content_hash TEXT NOT NULL,
  source_revision TEXT NOT NULL
);
CREATE TABLE source_bars (
  dataset_id TEXT NOT NULL,
  candle_id TEXT NOT NULL,
  open_utc_ms INTEGER NOT NULL,
  o REAL NOT NULL, h REAL NOT NULL, l REAL NOT NULL, c REAL NOT NULL,
  volume REAL,
  PRIMARY KEY(dataset_id, candle_id),
  FOREIGN KEY(dataset_id) REFERENCES source_datasets(id)
);
CREATE INDEX idx_bars_time ON source_bars(dataset_id, open_utc_ms);
CREATE TABLE series_overrides (
  series_id TEXT NOT NULL, candle_id TEXT NOT NULL,
  ordinal INTEGER, operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY(series_id, candle_id)
);
CREATE TABLE project_revisions (
  project_id TEXT NOT NULL, revision INTEGER NOT NULL,
  parent_revision INTEGER, snapshot_hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(project_id, revision)
);
CREATE TABLE smt_observations (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  chart_group_id TEXT NOT NULL, status TEXT NOT NULL,
  value_json TEXT NOT NULL, updated_at INTEGER NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE TABLE assets (
  id TEXT PRIMARY KEY, sha256 TEXT NOT NULL,
  kind TEXT NOT NULL, opfs_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL, metadata_json TEXT NOT NULL
);
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL
);
```

This is a **conceptual migration**, not a finalized schema. Additional relational identities (instrument definitions, series metadata, chart group indexes, asset/project reference records, export jobs, user preferences) and referential integrity will be defined during implementation planning. `REAL` may not be adequate for every high-precision market feed; choose a documented price-unit/decimal representation per source and verify round-trip preservation before implementation. Candle ordinals for inserts/reorders also need an explicit stable sequence table, not merely override rows.

### 9.4 Transactional and cross-storage commit protocol

SQLite can transactionally commit **its own** SQL rows, but OPFS asset files and the SQLite DB are not jointly atomic. For an asset-bearing revision: stage bytes under a temporary OPFS key; checksum, size and content validation; publish content-addressed asset; then in one SQL transaction add/update asset manifests and commit a new immutable project revision. Maintain an orphan/staging cleanup journal and run recovery checks after failures. Last confirmed revision remains available if any stage fails.

Undo/redo is command history, not replacement of durable revision history: undo creates a new persisted revision. Saving one project must not require locking all unrelated exports, and export uses a frozen revision/data hashes. The worker must handle concurrent read/export snapshot requests without violating the single-writer DB VFS policy.

### 9.5 File semantics

- **Autosave/Save:** commit working state to SQLite local workspace; report pending/saved/error.
- **Open:** validate/import a portable package into workspace with collision-safe IDs; do not change existing projects silently.
- **Save As:** package frozen project revision into user-selected `.chartstudio` archive (picker where allowed; download fallback); maintain `local saved` vs `file exported` status independently.
- **Export Project:** archive with explicit all/used-only dataset inclusion, checksums and media dependencies.
- **Export Video:** distinct render pipeline.
- **Linked external-file automatic saves:** deferred; SQLite in OPFS must never be mistaken for a user-selected `.sqlite` project file.

**Portable format:** versioned logical data archive: `manifest.json`, `project.json`, normalized dataset chunks, SQLite-independent records where necessary, media, and checksums. Do **not** merely ZIP the running `opfs-sahpool` SQLite physical file: VFS mapping/locking is internal to the browser, and a portable project must survive schema and implementation changes. A clean import reconstructs required SQLite rows and OPFS assets and validates all references before publishing the project. Block path traversal, archive bombs, untrusted executable payloads, and corrupted/missing hashes.

### 9.6 Asset lifecycle

Original source data and media are immutable by content hash; SQL stores logical IDs, metadata, source/provider/session info and references. Image/audio/video originals and large derived datasets use OPFS; thumbnails and proxies are regenerable. Keep referenced assets while needed by projects, retained revisions, queued exports, or future sync. Remove abandoned staged content safely after retention checks; never delete source assets merely because an annotation was removed.

### 9.7 SQLite compatibility gates

Before accepting the persistence implementation, validate at least: worker + OPFS SAH-pool initialization on target browsers, repeated write/reload, crash during staged binary+SQL commit, cross-tab ownership and forced close, 100k bar time-index query, schema migration rollback, quota exhaustion, `.chartstudio` portable restore into a *clean origin*, and offline use after app shell cache. Fail closed and display backup instructions when tests fail. A fallback VFS or export-only read-only mode may be proposed only after compatibility results are reviewed.

## 10. Optional cloud sync and server rendering

These capabilities are **not MVP delivery requirements**. All project-domain and renderer APIs operate without a cloud connection. Future sync uses logical project revisions, `sourceDataset` hashes, chart groups, SMT observations, related media dependencies, and a SQLite-independent serialized interchange format—not raw copying of the running browser database. No server silently resolves divergent SMT confirmations or instrument/session mappings by last-writer-wins.

An optional backend may use PostgreSQL metadata, object storage and isolated render workers with FFmpeg. Remote rendering consumes the same project snapshot, source revisions and synchronized market-time mappings as local preview/export. Data locality, original market source integrity, and user-authored SMT annotations must survive round trip. The local editor's database adapter is replaceable without changing the core domain types.

## 11. Rendering, synchronization, and export

### 11.1 Pure frame evaluation contract

For immutable snapshot `P` and integer frame `f` at rational FPS, `Evaluate(P, f)` returns the same typed evaluated composition independent of play history, machine wall clock or unseeded randomness. Global frame maps to 1–2 active scene instances, then to local presentation frame, then through chart-group time mapping to market instants and partial price states. The evaluator must not resolve corresponding chart swings by raw candle index for genuine data.

Order of operations:

1. Resolve snapshot, source dataset revisions, instruments, sessions, chart groups and referenced assets.
2. Resolve project composition frame to active scene instance(s), crossfade overlap and local frames.
3. Evaluate scene clips, master chart group cursor(s), imported/manual time bindings and discrete/synthetic progress.
4. Evaluate each chart view independently for its timeframe and source state; derive partial HTF only from data available at the current market cursor.
5. Evaluate confirmed SMT observations and their timed annotation clips; stale/invalid observations produce diagnostics rather than silently relocating drawings.
6. Evaluate camera/layout/focus animations, object keyframes, market/local/scene coordinate projections and ordered display lists.
7. Render scene(s), transitions, captions/image layers and audio tracks against a common presentation clock.

Scene renderer and export renderer consume the same evaluated scene data; interactive preview can drop display frames to keep transport synchronized, whereas export must render every required frame.

### 11.2 Multi-chart rendering

Each chart has independent y-axis transform and visible range. Group shared market-time mappings govern bar reveal; **never share the price transform** across different raw-price instruments. Resizing or focusing panels is an animatable scene property. SMT links are rendered as chart-local anchored segments plus optional scene-space labels. During a project crossfade, outgoing and incoming scenes are independently evaluated and composited; audio gains follow explicit scene transition gain rules.

### 11.3 Export settings and integrity

- MVP: PNG still and locally encoded MP4 on tested browsers; optional PNG sequence fallback where supported. Presets: 16:9/9:16/1:1, 720p/1080p, 24/30 FPS; capabilities verified at runtime.
- Freeze project revision, dataset hashes, calendar config, source mappings, SMT object confirmation status, animation seeds and assets before export. Continued editing does not alter that job.
- Align multi-asset OHLC and MTF charts with same market-time evaluator as preview; output manifests retain source/provenance and simulation status. Where appropriate, render visible simulated/hypothetical marks in educational clips.
- Export progress states: validating, loading, rendering, encoding, finalizing, complete, failed, cancelled. Show explicit diagnostics for missing symbol mapping, incompatible sessions, stale SMT references (configurable warning/block based on use), assets, unsupported codecs, or storage quotas.
- Browser encode through supported WebCodecs + MP4 muxing with queue backpressure; optional future isolated server-worker route. Preview/export visual comparisons use identical logical frame state and tolerance-based pixel checks; audio sample timing verified separately.

### 11.4 Creator-controlled pacing

Chart-group linked playback should support synchronous reveal at equal actual market instants, chart-specific highlights, progressive SMT callouts, HTF→LTF focus changes, holds and speed ramps. A creator can intentionally freeze comparison asset B while A progresses, but the project stores `independent` policy and cannot label the visual as synchronous historical movement. Export validation reports mismatches to prevent misleading presentations.

## 12. End-to-end user workflows

### Flow A — Manual educational setup video

Dashboard → New Manual Project → build/edit valid OHLC → annotate setup/entry/SL/TP → create scenes → reveal candles and optionally animate simulated price → add captions/image/audio → Save locally → project preview → MP4 export → portable Save As.

### Flow B — Historical trade breakdown

Import CSV/JSON → select instrument, timeframe, timezone/session, price basis and timestamp semantics → validate source → choose range → create chart scene → add market-anchored drawings → simulated motion explicitly labeled → camera/captions/audio → composition and export.

### Flow C — Mixed-origin hypothetical scenario

Import immutable bars → add/override manual continuation with provenance → edit/animate overlays → export hypothetical status. No silent source changes; base source available for reset.

### Flow D — **Two-asset SMT explainer** (new MVP journey)

1. New `SMT + MTF Breakdown` project or any blank scene → import NAS100 and US500 (user-picked instrument/source mapping; symbols illustrative).
2. Set source timeframe, session calendar, missing-bar policy, and a 2-panel chart group with linked UTC time cursor and independent price scales.
3. Seek into a known comparison window. Select anchor swing high or low on primary chart and define the structural comparison swings needed for a divergence narrative.
4. Launch assisted corresponding-swing selection. Suggestions on the second chart are time-aligned, ranked by declared pivot/tolerance configuration, and carry source and confirmation state. Select the intended counterpart manually if needed.
5. Review pairwise HH/LH or LL/HL/non-confirmation classification and explicitly **Confirm SMT**; annotation is now a persistent `SMTObservation`, not merely loose lines.
6. Insert linked SMT drawing and staged explanation timeline clips; animate primary swing → corresponding swing → divergence label, pause/focus charts, then show LTF response.
7. Save, reopen, modify a source candle to confirm stale-SMT warning/reconfirmation, restore, and export video with aligned multi-chart state.

### Flow E — **Three-asset SMT + MTF video** (new MVP journey)

1. Import/select three independent instruments such as NAS100, US500 and US30, with verified timestamps and session definitions.
2. Create three-pane SMT group; choose anchor asset A, review separate A↔B and A↔C comparisons; user may confirm one and mark the other non-confirming/unknown without force-fitting a triple-signal.
3. Show HTF market context in 4H/1H views, then a 15M and 1M execution view where real finer-granularity input exists. Link time cursor while using distinct cameras/scales.
4. Author project composition scenes `Context → SMT Comparison → LTF Entry → Outcome`; move focus among 3 charts and MTF views with keyframed layouts/spotlights.
5. Animate synchronized price replay and drawing reveal, export a complete video, and transfer portable `.chartstudio` to a clean workspace without losing sources, SMT confirmations, link anchors or animation timing.

### Flow F — MTF drill-down with no lookahead

Use genuine 1M or other sufficiently fine source to derive 15M/1H, or import each TF separately with source metadata; synchronize a market-time cursor; show the **partial** current HTF bar when data supports it; progressively shift focus from context to execution; verify that seeking backward cannot reveal not-yet-known highs, lows or closes.

### Flow G — File portability and crash recovery

Edit → SQLite autosave and status → Save As `.chartstudio` logical archive → close tab/move computer → import on a fresh origin into SQLite/OPFS → check identities and assets → continue → export comparable scenes. Fault during staged file and SQL commit restores last valid revision without ghost projects.

### Flow H — Hierarchical project/scene navigation

Project composition → enter Scene 2 → edit multi-chart group and its timeline → breadcrumb returns to composition, preserving scene playhead/zoom → preview cut/crossfade with other scenes → full project render.

## 13. Creator-ready **SMT + MTF** MVP acceptance criteria

### 13.1 Project/dashboard and files

- Local project dashboard: create/open/duplicate/rename/delete/restore/reopen; clear `Saving / Saved locally / File out of date / Error` states.
- Open/Save As/portable `.chartstudio` archive with import validation and full offline data dependencies.
- SQLite WASM/OPFS worker initialization, schema migrations, autosave, recovery, quota diagnostics and single-writer multi-tab checks.

### 13.2 Data and charts

- Manual/numeric visual OHLC builder and CSV/JSON real import with timestamp semantics, source identity, session/calendar and provenance.
- Working-series insert/override/reset with original-source immutability.
- **Two and three simultaneous instrument chart views**, each with independent y scale and synchronized market-time replay, plus configurable missing-bar policy, linked cursor/crosshair, shared or independent transport.
- **MTF chart views** with imported TFs or deterministic **upward-only aggregation** where finer input is available; no-lookahead partial HTF state under chronological replay; chart zoom, pan and focus layouts.

### 13.3 Assisted SMT (explicit release gate)

- User selects an anchor high/low and primary structural comparison, invokes corresponding swing-pair suggestions on 1–2 assets, sees provenance/time/pivot confirmation and accepts or adjusts manually.
- User confirms one or two **pairwise swing-sequence** comparisons; results are saved as linked SMT observations with status and optional note.
- SMT drawing segments stay anchored during independent chart pan/zoom, panel resizing, timeline seeking and MTF focus movement; staged SMT explanation can be animated.
- Editing/reimporting source data invalidates impacted SMT references and requires user reconfirmation; stale objects may be shown with warnings but must not be silently treated as confirmed.
- Assistance remains user-initiated; no autonomous trade signals, negative-correlation detection or predictive claims.

### 13.4 Animation, scenes, media

- Discrete reveal and deterministic OHLC-bounded **simulated** dynamic motion both apply to manual and imported series.
- Frame-addressable hierarchical timeline: project scenes and transitions + scene chart group tracks, clips, camera, annotations, captions/images and basic audio.
- Scene duplicate/reorder, simple cut/crossfade, global/local playback, frame seek/step, clip trims, basic opacity/position/scale keyframes.
- Scene layouts: 2-panel SMT, 3-panel SMT, MTF split/inset and focus one-panel transition.

### 13.5 Export and reliability

- Local PNG and supported-browser MP4 that renders multi-asset/MTF charts, confirmed SMT linked overlays, scene transitions and audio aligned to source timeline.
- Same logical scene data at frame N for direct seek, sequential preview and export; no future data leakage in HTF or unconfirmed swing generation.
- Deterministic simulation seed/source hashes included in frozen export snapshot; modified/hypothetical price integrity is visible/inspectable.
- 100k bar data/query benchmark and multi-chart preview performance benchmarks performed before final release thresholds are adopted; no unsupported FPS/codec guarantee.

### 13.6 Explicit deferred exclusions

Authentic tick ingestion/replay implementation (distinct schema reserved); unattended automatic SMT detection; real-time data API integration; correlated-pair discovery services; advanced media editing, full waveform/mixer, AI narration, cloud sync/server rendering, collaboration, linked-file autosave, and complex scenario-fork UX.

## 14. Deferred scope and extension hooks

| Deferred | Contract preserved in MVP |
|---|---|
| Authentic tick playback | Price source discrimination, UTC cursor, tick interface and provenance labels |
| Unattended SMT scanner | `SMTObservation` semantics, detector interface, candidate reasons; **confirmation remains human-controlled** |
| Inverse/negative correlation analysis | Explicit correlation mode extension, no unreviewed inversion of comparison rules |
| Provider-sourced feeds | Instrument identity, provider aliases, session calendar and import adapters |
| Pattern/zigzag/GBM builders | Candle construction command API and simulation versioning |
| Advanced Fibonacci/Elliott | Drawing registry and typed chart anchors |
| Complex MTF behavior | Shared market-time clock and aggregation plugin registry |
| Reusable scene components/templates | Stable scene/object IDs and asset dependency packaging |
| Higher-end video editing | Typed timeline objects, audio/media asset interfaces, compositing |
| Cloud sync and server rendering | Portable logical snapshot, revisions, source hashes, deterministic evaluator |
| Linked file autosave | External file handles and separate local/file statuses |
| Collaboration | Revision ancestry, conflict resolution, one-writer local DB worker |

## 15. Packages, dependencies, and delivery boundaries

```text
apps/
  web/                     # React/Next.js shell, offline editor
  api/                     # future cloud services
  render-worker/           # future remote rendering
packages/
  project-model/           # project, chart group, SMT, scene schemas and migrations
  editor-core/             # commands, selection, history, app state contracts
  instruments/             # symbol identity, source aliases, calendars/sessions
  market-data/             # import, source bars, provenance, timeframes, UTC indexing
  timeframe-engine/        # session-aware OHLC aggregation + partial HTF replay
  chart-engine/            # candle transforms, scene-native chart views, scales
  chart-groups/            # layouts, shared market cursors, sync policies
  smt-engine/              # swing candidates, creator confirmation, stale validation
  drawing-engine/          # price-anchored SMT segments and conventional drawings
  scene-engine/            # scene graph, cameras, layering, project composition
  animation-engine/        # pure frame evaluator, candle reveals, synthetic paths
  timeline-engine/         # tracks, clips, keyframes, time remapping
  playback-engine/         # transport, seeking, preview scheduling
  render-engine/           # typed display lists, Canvas2D renderer
  export-engine/           # PNG/MP4, audio alignment, validation
  storage-core/            # repository interfaces and revision semantics
  storage-sqlite/          # SQLite WASM worker, OPFS VFS, migrations, locking
  storage-opfs/            # content addressed blobs, stages, cleanup
  asset-manager/           # asset refs, hashes, import and garbage collection
  project-archive/         # portable normalized interchange (not raw DB file)
  cloud-sync/              # future optional revision-based adapter
  ui/                      # reusable React/shadcn components
```

**Dependency direction:** UI dispatches commands; editor/core depends on domain interfaces, not SQL or canvas; market-data/timeframe/SMT functions consume immutable indexed snapshots; animation/scene evaluator combines their values by frame; renderer receives an evaluated display list only; playback and export share evaluator and renderer. SQLite worker/repository implements interfaces and never leaks DB handles into scene objects. Neither local editor nor evaluator imports future cloud packages.

**Release slicing principle:** build a 2-chart linked replay + database save/load integration slice early. Do not finish a single-chart renderer and then attempt to retrofit chart groups or MTF; the user-requested workflow determines the core module design from the start.

## 16. Contracts, validation, and error semantics

```ts
interface ProjectRepository {
  get(id: string): Promise<ProjectSnapshot>;
  list(): Promise<ProjectSummary[]>;
  commit(id: string, expectedRevision: number,
         changes: ProjectChangeSet): Promise<ProjectRevision>;
}
interface MarketDataRepository {
  queryBars(datasetId: string, startUtc: number, endUtc: number):
    Promise<ReadonlyArray<SourceBar>>;
  resolveWorkingSeries(seriesId: string, query: BarQuery):
    Promise<ReadonlyArray<WorkingCandle>>;
}
interface MarketTimeSynchronizer {
  resolve(group: ChartGroupDefinition, cursor: MarketCursor,
          snapshots: SourceIndexSnapshot[]): GroupFrameState;
}
interface TimeframeAggregator {
  aggregateAvailable(source: SourceIndexSnapshot, timeframe: Timeframe,
                     asOfUtc: number, calendar: SessionCalendar): AggregationResult;
}
interface SMTCandidateService {
  suggest(anchor: SwingSequence, comparisonViewIds: string[],
          window: MarketWindow, policy: PivotPolicy,
          data: MarketDataSnapshot): Promise<SMTCandidateSet>;
  confirm(draft: SMTObservation, selection: SwingSequenceSelection,
          sourceRevisions: string[]): SMTObservation;
  validateReferences(observation: SMTObservation,
                     data: MarketDataSnapshot): SMTValidationResult;
}
interface SceneEvaluator {
  evaluate(snapshot: ProjectSnapshot, globalFrame: number): EvaluatedComposition;
}
interface AssetRepository {
  put(input: Blob, metadata: AssetMetadata): Promise<AssetManifest>;
  get(id: string): Promise<Blob>;
  verify(id: string): Promise<boolean>;
}
interface ProjectArchiveService {
  import(blob: Blob): Promise<ProjectImportResult>;
  export(projectId: string, revision: number,
         options: ArchiveOptions): Promise<Blob>;
}
```

- **Time mapping missing:** reject hard linked synchronization unless manual authored-map policy is provided; show missing timestamps/session/configuration.
- **Swing suggestion empty:** let creator select manually; show why no eligible pivot meets specified timeframe/window/policy.
- **Swing unconfirmed as of current replay:** mark candidate provisional; do not show as known before right-side pivot confirmation bars close.
- **SMT referenced bar changed:** mark observation stale, retain user's annotations and require reconfirmation; no automatic relinking.
- **Incompatible price basis/session:** warn/block historical comparison depending on severity; never combine unmatched feeds as if identical without declaration.
- **SQLite/OPFS unsupported:** show storage compatibility diagnostic and preserve any unsaved in-memory edits for immediate user export when feasible; never claim durable save.
- **Concurrent writer:** block or offer explicit read-only view; reject stale SQL revision commits.
- **Source import defect:** list invalid rows, gaps and duplicates; user selects explicit import policy, with immutable original retained.
- **Archive corruption:** fail without publishing a partial workspace project; bad hashes and path traversal are rejected.
- **Video encoding unsupported:** suggest compatible preset or PNG still/sequence output; never silently downgrade video quality.
- **Export asset missing:** fail with actionable list and preserve last saved project revision.

Implementation planning must define input/output schemas and measurable error messages for each interface.

## 17. Test strategy and release verification

### 17.1 Unit/property-based tests

- OHLC validation and provenance for manual/imported/mixed rows; input timezone/bar-open vs bar-close handling.
- Instrument identity, missing/duplicate bars, session boundaries, DST transitions, independent price scales.
- Chart group sync: 2 or 3 instruments with different gaps, calendars and bar counts align by real UTC timestamps, never by row index.
- MTF aggregation: 1M→15M→1H under known calendar; first-open/max-high/min-low/last-close/volume sum; partial candle evaluation sees only already-known bars and price samples.
- MTF forbidden 1H→1M authentic reconstruction; seek to a prior frame after later data processed is identical to direct historical evaluation.
- Pivot candidate ranking deterministic for selected swing sequence/time window; left/right bar-confirmation delay prevents future lookahead; no proposal when comparison data missing.
- Pairwise two-asset and three-asset SMT results; manual selection overrides; no automatic confirmation; invalidation after source revisions.
- SMT market anchors reproject correctly under rescale, group resize, camera focus and clipping; raw price axes remain independent.
- Simulation paths reproduce same OHLC H/L/C under seeded algorithm and never exceed final bounds.
- Integer-frame intervals, clip conflicts, global/local scene time remapping, transition audio/crossfade boundaries.
- SQLite schema migration/check constraints, repository expected-revision CAS, parameter binding, asset checksum and project archive path security.

### 17.2 Integration tests

1. Import three independently timestamped datasets → build synchronized 3-panel chart group → direct seek and playback match.
2. Import 1M dataset → derive 15M/1H → verify partial HTF at each replay frame with no access to future bars.
3. Select SMT anchor → obtain filtered candidates → confirm one/two pairwise swing-sequence comparisons → persist/reload → animate linked annotations; edit source → stale warning.
4. Mix manual and imported source across chart groups using explicit authored alignment and verify provenance.
5. Save to SQLite worker → reload origin → export `.chartstudio` → reimport to clean origin → inspect identical chart groups, instruments, SMT objects, scenes and frames.
6. Simulate crash between OPFS staged asset and SQL transaction; recover last committed revision and safely clean orphan bytes.
7. Open two editor tabs, attempt concurrent writes, verify single-writer constraint and no silent overwrites.
8. Preview and MP4/PNG export use same logical multi-chart/MTF frame and source revision, even while editor continues editing.

### 17.3 Creator-ready end-to-end release scenario

1. Create 1920×1080 @30FPS project from `SMT + MTF Breakdown` or blank.
2. Import three sources: NAS100, US500, US30 with deliberately mismatched calendars/gap fixture; reconcile mappings explicitly.
3. Show three linked instruments and choose anchor swing pair and 1–2 corresponding swing pairs; manually confirm SMT classification.
4. Use finer-source 1M data to derive HTF views, align market cursor, animate context→SMT→LTF entry without HTF future-state leakage.
5. Add market-anchored zones, synchronized SMT reveal, long/short marker, captions, an image and basic audio.
6. Compose scene order and crossfade; simulate one source edit and verify stale SMT validation, then reconfirm.
7. Autosave SQLite/OPFS, restart application, reopen and assert project relations/provenance survive.
8. Save As `.chartstudio`, import in a fresh workspace and replay/export equivalent frames.
9. Render supported-browser MP4; verify frames, dimensions, chart group sync, SMT drawings, audio/crossfade, metadata and source labels.

### 17.4 Performance and browser compatibility

Benchmark 2- and 3-pane synchronized playback, 100k OHLC bars indexed in SQLite by source+time, a mixed MTF scene, pivot candidate ranking, random seeking, archive packaging, and export memory/queue limits. Define a reference device/browser and fixtures before assigning pass/fail FPS thresholds. The SQLite `opfs-sahpool` spike must verify real user-browser behavior, cross-tab lock/recovery, offline app shell and storage quota exhaustion—not only unit tests.

## 18. Implementation slices and dependencies (proposed)

| Slice | Deliverable / verification milestone | Dependencies |
|---|---|---|
| 0. Persistence feasibility | SQLite WASM worker + OPFS VFS spike, locking, migration, save/reload, browser matrix | None |
| 1. Domain and data | Instruments, session/timeframe model, immutable OHLC, editable overlays, import mapping | 0 |
| 2. Multi-chart foundation | 2/3 chart views, independent scales, chart group layout, shared UTC market cursor, basic save/reopen | 1 |
| 3. MTF engine | Timeframe aggregation, partial HTF, imported per-TF mapping, no-lookahead seeking | 2 |
| 4. SMT assistance | Swing selection/ranking, user-confirmed pairwise observations, cross-chart drawings, stale handling | 2–3 |
| 5. Animation core | Discrete reveals, seeded synthetic motion, deterministic evaluator, camera/chart focus clips | 2–4 |
| 6. Hierarchical editor | Dashboard, project/scene navigation, scene timelines, inspectors, tools and chart-group UX | 0–5 |
| 7. Creator media | Captions, images, basic audio, cuts/fades and project preview | 5–6 |
| 8. Portable + output | `.chartstudio` logical archive, PNG/MP4 output, frozen snapshots, complete SMT/MTF scenario | 0–7 |
| 9. Hardening | Recovery, data quality, security, cross-tab, audio/export parity, 3-chart E2E, performance | All |

**Build the vertical slice early:** by the end of slice 2, two chart views must share a market cursor and round-trip through SQLite save/reopen. MTF and assisted SMT build on that proven foundation. Do not build multiple disconnected renderer implementations to achieve the three charts.

## 19. Principal risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| SQLite WASM/OPFS support and multi-tab locks | User data corruption or startup failure | Early VFS/worker/browser spike; single writer; explicit storage diagnostics |
| OPFS quota/site-data loss | Local projects disappear | Portable export, warnings, backups and recovery checkpoints |
| Price alignment across index products | Incorrect SMT interpretation | Instrument/provider/session/price-basis metadata, UTC alignment, visible gaps |
| MTF higher-timeframe lookahead | False historical precision and misleading videos | Partial aggregate from available data only; no authentic upsampling |
| Pivot confirmation lookahead | Retrospective signal appears earlier than possible | As-of-bar pivot right-window confirmation and provisional state |
| 3-asset semantics disagreement | Opaque 'triple divergence' signal | Explicit user-selected pairwise A↔B/A↔C results and notes |
| Stale confirmed SMT after edits | Annotations point to wrong market events | Immutable revision refs, stale status and reconfirmation workflow |
| Browser render cost for 3 charts + media | Dropped preview frames or OOM exports | Culling/virtualization, cached static layers, bounded encoding, profiling |
| Cross-scene animation conflicts | Off-by-one global/local frames | Half-open intervals, deterministic evaluator and transition tests |
| Raw SQLite files treated as portable archive | Cannot reopen across origins/VFS versions | Logical `.chartstudio` interchange, do not export internal DB image |
| Incorrect user perception of simulation | Synthetic prices presented as authentic | Explicit simulated labels and source integrity in metadata/video |
| Optional cloud model becomes mandatory | Breaks local-first intent | Repository interfaces and cloud-free end-to-end acceptance gate |

## 20. Builder decisions, remaining assumptions, and review points

### 20.1 Builder discretion after approval

Concrete archive/compression implementation, ID generation, UI color styling, SQL query builder or hand-written repositories, asset chunk sizes, SQLite migration runner, React data-fetching patterns, Canvas2D internals, WebCodecs muxer and exact keyboard shortcuts can be chosen by the builder so long as the specified semantics hold.

### 20.2 Review points with material consequences

1. **SQLite VFS/browser target:** the design recommends `@sqlite.org/sqlite-wasm` + worker + `opfs-sahpool`, a single writer and Chromium desktop first. A failed compatibility spike requires an explicit fallback decision (alternative VFS or launch target restriction), not a silent move back to IndexedDB.
2. **SMT semantics:** first version means user-started high/low pivot correspondence and confirmed **pairwise** relationships for 2–3 positively correlated assets. Complex custom/inverse-correlation strategies require separate policy specifications.
3. **MTF truthfulness:** higher TF may be derived from finer-source input; authentic LTF cannot be inferred from HTF OHLC; partial higher bar must be honest about what was observable at frame N. User can explicitly choose a retrospective completed-candle visual as storytelling, distinctly labeled.
4. **Manual/hypothetical synchronization:** authored timestamps/logical mappings required to align timestamp-less manual bars with historical instruments.
5. **MVP bounds:** same creator-ready media scope as v1.0 with **SMT & MTF added**, but authentic ticks and automatic SMT scan still deferred.
6. **File semantics:** local SQLite Save does not overwrite previously opened external `.chartstudio`; Save As creates new archive; linked-file autosave deferred.
7. **MVP performance and source coverage:** target 2–3 synchronized assets and source-indexed 100k bar fixture, not guarantee arbitrary number of charts or all provider calendars at launch.

### 20.3 Decisions made during self-review

- Define chart-group synchronization in **UTC instants with session calendars** rather than candle-index lockstep.
- Separate **swing-pair candidate recommendation** from **confirmed SMT classification** to keep user in control.
- Give the 3-asset workflow explicit **pairwise** comparisons to avoid hidden aggregation logic.
- Require partial HTF aggregation from available finer-granularity information to prevent future knowledge leakage.
- Treat SQLite's OPFS backing format as internal; portable archives use logical project/dataset/media representation.
- Keep original dataset and source revisions immutable, with observable SMT staleness on edits/reimports.

There are no additional user-specific details required to define the current first-version scope. Implementation must still validate browser capabilities, initial representative data formats and UX using actual fixtures; these are feasibility/test tasks rather than unresolved product intent.

## 21. Design approval gate

This is a **design proposal v1.1** for user review, not implementation authorization. Approval covers the 2–3-asset SMT + MTF creator workflow, assisted user-confirmed pivot identification, source integrity, partial HTF no-lookahead, SQLite WASM/OPFS single-writer architecture (with feasibility gate), local/file save semantics, scene/timeline model, MVP and deferred scope. Approval does **not** assert ChartAnimator feature parity, successful SQLite browser compatibility, or validated codec performance.

**Next authorized process step after approval:** invoke Superpowers `writing-plans` to produce implementation tasks, test fixtures, API/schema migration plan, and explicit verification criteria. Do not scaffold or implement product code prior to design approval.

### Source notes (implementation assumptions only)

- SQLite WASM OPFS persistence and VFS trade-offs: https://sqlite.org/wasm/doc/tip/persistence.md
- Official SQLite WASM package and worker behavior: https://github.com/sqlite/sqlite-wasm
- SMT as comparison of correlated instruments is a descriptive market-education concept, not a guaranteed predictive signal: https://docs.tradeforopp.com/sma-divergence

