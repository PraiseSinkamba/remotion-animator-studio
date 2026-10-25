# Chart Studio — Technical Architecture and Data Contracts

**Version:** 1.2 draft · **Date:** 2026-10-24 · **Status:** Proposed, feasibility gates required  
**Functional source:** [FUNCTIONAL_SPEC](../spec/FUNCTIONAL_SPEC.md). **Dependency ADR:** [ADR-001](../decisions/ADR-001-VIDEO-STACK.md).

## 1. Architectural shape

```
┌──────────────────────────────────────────────────────────┐
│ Next.js / React App (interactive, local-first)            │
│ Dashboard | Tool rail | Object tree | Inspector | Timelines│
│ Zustand transient state | dnd-kit events | UI commands    │
└────────────────────────┬─────────────────────────────────┘
                         │ typed commands / project snapshots
┌────────────────────────▼─────────────────────────────────┐
│ Domain packages (browser-independent, pure TypeScript)    │
│ Project graph & revisions | OHLC/series | MTF | SMT        │
│ Frame evaluator | market-time mapping | object animations │
└──────────────┬──────────────────────────┬────────────────┘
               │                          │
┌──────────────▼───────────────┐ ┌────────▼────────────────┐
│ SQLite Worker + OPFS         │ │ React/Remotion Renderer │
│ manifests + revisions + bars │ │ <Player> (editor)       │
│ source-aware overlays/indexes│ │ <Scene>/<Chart> SVG     │
│ asset hashes + pointers      │ │ web-renderer (local MP4)│
└──────────────┬───────────────┘ └────────┬────────────────┘
               │                          │
     OPFS large binary assets      frozen export snapshot
               └──────────────────────────┘

Future extensions: account/sync API, content-addressed cloud assets, remote Remotion render workers. No cloud dependency within v1 editor/core.
```

The application is **not** a general purpose timeline engine plus screenshots of financial charts. It stores chart data with provenance, evaluates per-frame chart states, and renders each chart as a scene object through a unified Remotion React video composition.

## 2. Monorepo and ownership boundaries

```text
apps/
  studio/                         # Next.js App Router application (client editor)
  render-worker/                  # deferred: optional server Remotion renderer
packages/
  domain/                         # project, scene, clip and object schemas
  market-data/                    # import, candles, series, sessions, time mapping
  smt-mtf/                        # deterministic candidate matching + aggregation
  chart-renderer/                 # pure evaluated chart->React/SVG shapes
  trading-components/             # custom domain objects, manifests, inspectors and render adapters (P0)
  motion-components/              # locally owned/adapted Remocn React motion components
  scene-compositor/               # Remotion composition and transitions
  editor-core/                    # commands, history, selection coordination
  timeline/                       # project/scene timeline UI, drag/snap/trim
  storage-sqlite/                 # single database worker, queries, migrations
  project-archive/                # .chartstudio packaging, integrity checks
  export/                         # render configs, freeze, local export
  ui/                             # shadcn wrappers, inspector/tool UI
  testing/                        # fixtures, golden frames, mocks
```

### Boundary rules

- `domain` and `market-data` import **no** React, Zustand, Next.js, Remotion or storage libraries.
- `smt-mtf` consumes canonical bar/time APIs from `market-data` and produces typed observations and time-consistent derived states; no DOM.
- `chart-renderer` consumes evaluated chart states rather than reaching into storage.
- `trading-components` is a foundational P0 library, not a deferred registry. It registers typed chart/drawing/SMT/MTF object behaviors, inspector metadata and Remotion render adapters.
- `motion-components` owns the selected Remocn-installed source, provenance and lifecycle compatibility adapters. No independent video engine, timer, or editor state may be introduced.
- `scene-compositor` consumes immutable project input props and frame, not mutable editor UI state.
- `timeline` can issue typed commands, not directly modify SQLite or market datasets.
- `storage-sqlite` owns persistence and transactional revisions, not asset painting or video state.
- `export` manages immutable snapshot and media capability; it does not define alternative chart timing semantics.

## 2A. Foundational component system (selected)

The editor is specialized, so **our own trading video component library is a prerequisite for the first animated chart**, not a later enhancement. Remocn is the primary shadcn-style, source-owned library for generic Remotion effects, typography and transitions; Remotion remains the sole authoritative player/compositor/export runtime.

Each registered visual component has a stable type, versioned/Zod-validated props, defaults, inspector descriptors, keyframe eligibility, frame lifespan `[startFrame,endFrame)`, market/scene anchors when relevant, and one deterministic rendering adapter. Domain components—`CandlestickChart`, `ChartGroup`, high/low line, horizontal price line, trendline, zone, long/short position, arrow, text label and SMT comparison—are implemented and tested inside `packages/trading-components` starting in R1. Remocn components, copied to `packages/motion-components`, use the same scene-object lifecycle through adapters. The editor uses shadcn/ui separately for its input controls and UI panels.

See the normative [ADR-003 component system](../decisions/ADR-003-COMPONENT-SYSTEM.md) for object protocol, provenance and R1 gates. Do not serialize React component functions in project files: use typed IDs, props, frames, transforms, asset references and animation properties.


## 3. Time models and frame identity

There are three clocks, and naming must preserve them:

1. **Presentation frame (`Frame`):** nonnegative integer index into a scene/project composition. Output FPS is rational (`num/den`). Intervals are always `[startFrame,endFrame)`.
2. **Market UTC (`UtcMillis` or higher precision where source dictates):** market-data timestamps; bars have `[openUtc,closeUtc)`, sessions/calendar and bar-open/close conventions.
3. **Editor preview transport:** playhead, speed/loop/paused state; ephemeral and does not modify persistent clip timing.

Composition scene instance maps global project frame to local scene frame, including overlap: `sceneLocalFrame = projectFrame - instance.globalStartFrame`, subject to transition mapping. An SMT sync group maps the relevant replay clip's local frame to **one market instant**, which each chart resolves via its instrument/timeframe/session data. Non-overlapping sessions do not turn into synchronized fake candles.

A scene can have independent chart clocks by explicit author choice. The **video frame clock is always shared**; independent chart clocks mean separate local market-time mappings, not separate Remotion players.

## 4. Canonical project and scene types

The following are **design-contract sketches**. Agents shall consolidate these into versioned Zod schemas before production; no arbitrary unvalidated `Record<string, any>` as canonical data.

```ts
export type Id = string;
export type Frame = number;   // integer
export type UtcMillis = number;
export type Rational = { num: number; den: number };
export type FrameRange = { start: Frame; end: Frame }; // [start,end)

export type ObjKind =
  | 'chart' | 'chart-group' | 'horizontal-line' | 'high-low-line'
  | 'trendline' | 'zone' | 'position' | 'arrow' | 'text'
  | 'image' | 'smt-link' | 'group';

export type Anchor =
  | { kind: 'scene'; x: number; y: number }
  | { kind: 'market'; chartId: Id; candleId?: Id; utc?: UtcMillis; price: number };

export type ObjectAnimation = {
  property: 'x' | 'y' | 'width' | 'height' | 'scale' | 'rotation'
    | 'opacity' | 'drawProgress' | 'cameraX' | 'cameraY' | 'cameraZoom';
  frames: { at: Frame; value: number; easing?: 'linear' | 'ease-in-out' }[];
};

export interface BaseSceneObject {
  id: Id; kind: ObjKind; name: string;
  startFrame: Frame; endFrame: Frame;
  zOrder: number; visible: boolean; locked: boolean;
  transform: { x: number; y: number; width: number; height: number;
    rotation: number; scaleX: number; scaleY: number; opacity: number };
  animations: ObjectAnimation[];
}

export interface ChartObject extends BaseSceneObject {
  kind: 'chart';
  chartViewId: Id; replayClipId?: Id;
  viewportPolicy: 'fixed' | 'visible-data' | 'animated-camera';
}

export interface ChartGroupObject extends BaseSceneObject {
  kind: 'chart-group';
  childChartObjectIds: Id[];
  layoutPreset?: 'horizontal' | 'vertical' | 'grid' | 'pip' | 'focus';
  marketClockPolicy: 'shared' | 'independent' | 'authored-map';
}

export type SceneObject = ChartObject | ChartGroupObject |
  // distinct typed drawing/text/media variants, defined by package/domain
  BaseSceneObject;

export interface SceneDefinition {
  id: Id; name: string; durationFrames: Frame;
  objects: SceneObject[];
  tracks: TimelineTrack[];
  background: { color: string };
}

export interface ScenePlacement {
  id: Id; sceneId: Id; globalStartFrame: Frame;
  sourceStartFrame: Frame; sourceEndFrame: Frame;
  transitionIn?: { kind: 'fade'; durationFrames: Frame };
}

export interface ProjectComposition {
  placements: ScenePlacement[];
  durationFrames: Frame;
}

export interface StudioProject {
  id: Id; schemaVersion: number; revision: number;
  name: string;
  output: { width: number; height: number; fps: Rational };
  dataRefs: Id[]; assetRefs: Id[];
  chartViews: ChartViewDefinition[];
  smtObservations: SMTObservation[];
  scenes: SceneDefinition[];
  composition: ProjectComposition;
}
```

**Normalization note:** production `SceneObject` must be a proper discriminated union; `BaseSceneObject` is a sketch, not an acceptable runtime fallback. `chart-group` must not reparent market anchors destructively; a `childChartObjectId` may only appear under one group instance in v1 (or the rendering contract must explicitly define sharing). In v1, templates copy scene definitions on insert; they do not provide live linked updates.

## 5. Track, clip and animation contracts

```ts
export type ClipKind = 'chart-replay' | 'transform' | 'drawing'
  | 'caption' | 'image' | 'audio' | 'camera';
export interface TimelineTrack {
  id: Id; name: string; kind: ClipKind;
  order: number; muted?: boolean; locked: boolean;
  clips: TimelineClip[];
}
export interface TimelineClip {
  id: Id; kind: ClipKind; targetId: Id;
  startFrame: Frame; endFrame: Frame;
  sourceOffsetFrames?: Frame;
  // typed subtype contains content/mode/animation settings
}
export type PriceReplayMode =
  | { kind: 'discrete'; effect: 'instant' | 'fade' | 'grow' | 'wipe' | 'batch' }
  | { kind: 'simulated'; algorithm: 'ohlc-hl' | 'ohlc-lh' | 'seeded-smooth';
      seed: number; algorithmVersion: number };
export interface ChartReplayClip extends TimelineClip {
  kind: 'chart-replay'; targetId: Id;
  seriesId: Id; fromCandleId: Id; toCandleId: Id;
  mode: PriceReplayMode;
  timeMapping: 'uniform-bars' | 'timestamp-proportional' | 'authored-curve';
}
```

**Lifecycle rule:** object visibility is the conjunction of its own `[start,end)` range and any parent visibility/scene range. Animations modify properties while active; object entry/exit is derived from frame, not side effects. A clip does not own the source market series. Multiple chart clips referencing the same series need no candle duplication.

**Conflict policy:** at most one active chart replay clip controls a given chart replay channel at any frame unless there is an explicit transition policy. Different property lanes may coexist; conflicting property lanes require deterministic priority rules and timeline diagnostics. At scene boundary, outgoing/incoming scenes may render simultaneously for crossfade, but their local timelines remain independent.

## 6. Market datasets, series overlays and charts

```ts
export interface SourceDataset {
  id: Id; instrumentId: Id; timeframeId: Id;
  hash: string; sourceRevision: string;
  timestampConvention: 'bar-open' | 'bar-close';
  priceBasis: 'last' | 'bid' | 'ask' | 'mid' | 'unknown';
  sessionCalendarId?: Id;
  source: { type: 'csv' | 'json' | 'manual'; originalFilename?: string };
}
export interface OHLCBar {
  id: Id; openUtc?: UtcMillis; closeUtc?: UtcMillis;
  o: number; h: number; l: number; c: number;
  volume?: number; originalSourceRowId?: string;
}
export type SeriesEdit =
  | { kind: 'insert'; afterId?: Id; candle: OHLCBar }
  | { kind: 'override'; candleId: Id; values: Pick<OHLCBar,'o'|'h'|'l'|'c'> }
  | { kind: 'remove'; candleId: Id };
export interface EditableSeries {
  id: Id; sourceDatasetId?: Id;
  revision: number; edits: SeriesEdit[];
}
export interface ChartViewDefinition {
  id: Id; seriesId: Id; instrumentId: Id; timeframeId: Id;
  style: { upColor: string; downColor: string; wickWidth: number;
    bodyWidthFactor: number; showPriceAxis: boolean; showTimeAxis: boolean };
  priceScale: 'independent' | 'percentage';
  camera: { candleStart: number; candleCount: number;
    minPrice?: number; maxPrice?: number };
}
```

Imported bars are immutable; edits overlay them and reference originals. Manual bars may have only a logical index. To link them to historical charts, create an explicit author mapping. Never align 2/3 market feeds simply by candle index or alias.

**Price-to-video coordinates:** chart viewport transforms market candle position and price into normalized chart-local coordinates. Object transform maps chart-local into scene pixels, and Remotion composition maps scene pixels to output resolution. Use independent y scales for NAS100/US500/US30, even while they share market time.

## 7. MTF derivation and no-lookahead rules

A higher timeframe bucket is defined by the instrument's declared session calendar and interval. For all *eligible observed constituent bars* within the bucket, derive:

```
open = first eligible bar.open
high = max(eligible highs)
low  = min(eligible lows)
close = last eligible bar.close
volume = sum(eligible volumes), when present
```

As-of evaluation at `marketUtc` MUST exclude constituent bars not yet closed and any intra-constituent observations not available. If a valid partial bar exists from simulated OHLC formation, pass it as **simulated**, never claim observed price/tick history. If 1M source exists, 15M and 1H may be derived; 1H-only source cannot give authentic 1M candles.

Aggregation must respect DST, exchange sessions, holidays, overnight buckets and bar-open vs bar-close source conventions; a calendar month is not fixed seconds. A closed HTF bar may be fully rendered only after its close becomes eligible. When the available input is too coarse to truthfully show the partial bar, use completed-bars-only or user-labeled simulation.

MVP `aggregateAsOf(input, timeframe, sessionPolicy, utc)` must be pure, indexed and testable with deterministic fixtures.

## 8. SMT domain model and candidate assistance

```ts
export type SwingKind = 'high' | 'low';
export interface SwingRef {
  id: Id; chartViewId: Id; candleId: Id;
  kind: SwingKind; price: number;
  marketUtc?: UtcMillis;
  confirmedAsOfUtc?: UtcMillis;
  sourceRevision: string;
  status: 'provisional' | 'confirmed';
}
export interface SwingPair {
  id: Id; chartViewId: Id; kind: SwingKind;
  priorSwingId: Id; currentSwingId: Id;
  direction: 'higher' | 'lower' | 'equal';
  equalityTolerance: number;
}
export interface SMTPairComparison {
  referencePairId: Id; counterpartPairId: Id;
  classification: 'bullish-nonconfirmation' | 'bearish-nonconfirmation'
    | 'no-divergence' | 'custom';
  confirmedByUser: boolean;
}
export interface SMTObservation {
  id: Id; chartGroupObjectId: Id;
  referencePairId: Id;
  comparisons: SMTPairComparison[]; // exactly 1 or 2 for v1
  windowUtc?: { start: UtcMillis; end: UtcMillis };
  authoredAlignmentId?: Id;
  pivotPolicy: { leftBars: number; rightBars: number; maxOffsetMs: number };
  sourceRevisions: Record<Id, string>;
  status: 'draft' | 'confirmed' | 'stale' | 'invalid';
  note?: string;
}
```

Assisted selector flow: user picks prior/current anchor pivots of one type → engine lists matching confirmed counterpart pivot pairs within a configured time window → rank by temporal distance, data availability and pivot type → show data evidence and possible nonconfirmation → user chooses/adjusts pairs and confirms each pairwise classification. No automatic creation of trades or promised returns.

**Eligibility:** if a swing detector requires `rightBars=N`, the swing cannot be marked confirmed before those N bars close. A later revision of either source invalidates the observation until reviewed. Comparing a synthetic scenario with historical data must display a source-integrity badge and require authored time mapping.

### SMT animation as a scene object

A link object references `SMTObservation.id` but owns its own frame lifespan and graphics: `prior-high/low marks`, `current sweep mark`, `counterpart nonconfirmation`, `connector arrows`, `text label`. Each staged reveal is a child property clip. Deleting the visual object should not silently delete the underlying saved SMT analysis; the creator can reinsert it in another scene.

## 9. Realistic simulated candle formation

From input OHLC, form a **deterministic normalized path** `p(u)` for `u∈[0,1]`. Valid paths start at O, end at C, stay within [L,H] and visit both extremes. The simplest policies have piecewise-linear nodes:

- `ohlc-hl`: `O→H→L→C`
- `ohlc-lh`: `O→L→H→C`
- `seeded-smooth`: deterministic interpolated sub-segments that preserve endpoints/bounds and exact extrema.

At u, the partial candle is:

```
O(u)=O
H(u)=max_{0<=v<=u} p(v)
L(u)=min_{0<=v<=u} p(v)
C(u)=p(u)
```

A progressive candlestick renderer draws a body from `O` to `C(u)`, upper/lower wicks from H(u)/L(u), and an optional last-price cursor/price-level label. Opening state is O=H=L=C=O, final state exactly input OHLC. Candle animation may be slowed, held or retimed independently of object fading/entry. Simulation is labeled as such whenever derived from historical final OHLC; real tick paths remain out of MVP.

For a chart with multiple bars, the frame evaluator resolves the active candle index and intrabar progress from the chart clip's authored time map. A user may jump directly to any frame without replaying earlier ones. Market-time changes are separate from playback-rate changes.

## 10. Remotion composition adapter

Conceptual API (not copy-paste implementation; verify exact installed Remotion signatures during spike):

```tsx
// packages/scene-compositor/ProjectVideo.tsx
export function ProjectVideo({snapshot}: {snapshot: ExportSnapshot}) {
  const frame = useCurrentFrame();
  const active = resolveActiveScenePlacements(snapshot.project, frame);
  return (
    <AbsoluteFill>
      {active.map(({placement, localFrame, opacity}) => (
        <SceneLayer key={placement.id}
          scene={snapshot.scenesById[placement.sceneId]}
          evaluated={evaluateSceneAtFrame(snapshot, placement.sceneId, localFrame)}
          opacity={opacity}/>
      ))}
    </AbsoluteFill>
  );
}
```

`SceneLayer` uses a typed layer order and React SVG chart/drawing elements. `Player` displays `ProjectVideo` from immutable snapshot (`inputProps`) and current transport frame. Browser export sends the **same component and frozen inputProps** to web-renderer. Audio and image asset URLs must be safely resolved from OPFS/Blob URLs for preview; export resolution is a separate tested adapter with stable accessible URLs or blobs as supported by the installed Remotion version. Never assume `blob:` URLs work across every renderer context.

Use Remotion primitives for full-project scene scheduling, audio, opacity fades, caption timing and image overlays. Never use `Date.now()`, `Math.random()`, browser storage reads, mutable module singletons or animation side effects during composition rendering. Data queries happen **before** snapshot creation, not during frame capture. Keyframe animations interpolate directly from frame-indexed properties.

**Browser-render caveats:** `@remotion/web-renderer` supports a restricted subset of CSS/DOM and uses WebCodecs/Mediabunny. Avoid complex unsupported effects in v1, control layer order via DOM order, and test SVG, fonts, text measurement, clipping and audio on actual targeted Chromium. A custom Canvas capture path is a contingency, not the default. Do not depend on the experimental HTML-in-canvas browser flag.

## 11. Editor commands and transient state

Only commands modify canonical project data:

```ts
interface EditorCommand<T> {
  type: string;
  payload: T;
  expectedRevision: number;
  transactionId?: string;
}
interface CommandHandler<T> {
  validate(command: EditorCommand<T>, ctx: ProjectSnapshot): ValidationResult;
  apply(command: EditorCommand<T>, ctx: ProjectSnapshot): ProjectChangeSet;
}
```

Command families include `InsertCandle`, `OverrideCandle`, `CreateChartObject`, `MoveObject`, `ResizeChartPanel`, `AddDrawing`, `SetObjectLifetime`, `SetKeyframe`, `TrimClip`, `AddScene`, `ReorderScene`, `ConfirmSMT`, `InvalidateSMT`, `ImportAsset`. Continuous drags are previewed in Zustand and committed as one command transaction. Selection, inspector tabs, playheads, editor zoom and open dialogs stay transient. Persistence history is separate from grouped undo/redo history.

## 12. SQLite WASM + OPFS

### Recommended topology

- Single dedicated DB Web Worker loads **official SQLite WASM** (`@sqlite.org/sqlite-wasm`, version to be pinned during spike), with OPFS-backed VFS selected after compatibility validation. `opfs-sahpool` is a candidate but its connection/locking constraints require testing.
- All SQL runs through typed RPC: `readQuery`, `commitRevision`, `importDataset`, `getBarsByRange`, `getAssetManifest`, `migrationStatus` etc. UI components and Remotion code cannot issue raw SQL.
- SQLite stores structured project snapshots/revisions/commands, time-indexed OHLC and SMT metadata, asset reference manifests. OPFS content-addressed files hold large media and optional compressed/raw source datasets. Internal SQLite database bytes are not the portable project format.
- Parameterized SQL, WAL/locking decisions chosen by documented VFS capabilities; implement one logical writer and explicit second-tab takeover/read-only behavior.

### Suggested SQL tables (names to be finalized in migration plan)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  head_revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE project_revisions (
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  parent_revision INTEGER,
  manifest_json TEXT NOT NULL,
  document_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(project_id, revision)
);
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  metadata_json TEXT NOT NULL
);
CREATE TABLE ohlc_bars (
  dataset_id TEXT NOT NULL,
  candle_id TEXT NOT NULL,
  open_utc INTEGER,
  close_utc INTEGER,
  seq INTEGER NOT NULL,
  o REAL NOT NULL, h REAL NOT NULL, l REAL NOT NULL, c REAL NOT NULL,
  volume REAL,
  PRIMARY KEY(dataset_id, candle_id)
);
CREATE INDEX ohlc_time_range ON ohlc_bars(dataset_id, open_utc, seq);
CREATE TABLE dataset_revisions (
  dataset_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  descriptor_json TEXT NOT NULL,
  PRIMARY KEY(dataset_id, revision)
);
```

Production tables must add appropriate foreign-key constraints, referential checks, source overlays, pivot/SMT indexes, quota handling and schema migrations. Prices stored as `REAL` require precision handling: validate against instrument tick size and avoid equality assumptions across floating-point noise (the SMT tolerance is explicit). If exact decimal accounting becomes a requirement, store scaled integer ticks per instrument. This project is an animation editor, not a settlement engine.

### Atomicity across SQLite and OPFS

1. Write required binary assets to staged OPFS paths, streaming/hash-check them.
2. Publish immutable content-addressed binaries.
3. Commit SQLite revision pointer and manifests transactionally, using expected-head revision compare-and-set.
4. Treat revision as visible only when referenced assets exist; recovery scans for staged/orphaned binaries and uncommitted revisions.
5. Keep last committed revision intact under exceptions, tab interruption and storage quota exhaustion.

SQLite itself has ACID properties for its DB transaction, but **SQLite + independent OPFS binary files do not form one atomic transaction**. Recovery protocol is required.

## 13. Portable `.chartstudio` and asset resolution

The archive is logical interchange, not a copy of the OPFS SQLite database:

```
manifest.json               # archive/schema version, project ID, dependency hashes
project.json                # normalized project, scenes, clips, chart objects, SMT metadata
market-data/*.json|bin      # required source ranges or full sources, declared precisely
assets/<hash>.<ext>          # referenced media
checksums.json              # SHA-256 for all members
```

Do not include untrusted executable JavaScript, unsafe relative paths, or external network code. On import: validate schema version, max entries/uncompressed size, path traversal, duplicate paths and hashes before committing any visible project; clean up partial imports. On export: freeze project head and asset hashes so active edits do not change the archive midstream. External Save As creates a user-owned archive; internal Save remains a SQLite revision commit.

## 14. Export pipeline and compatibility

```
User Export action
→ validate project, source revisions, stale SMT and missing media
→ freeze ExportSnapshot (project/doc/data/assets, algo versions, FPS)
→ check local codec/container support, verify media/font compatibility
→ hand same Remotion composition + inputProps to @remotion/web-renderer
→ render frames + audio via browser WebCodecs/Mediabunny
→ validate frame count/duration/dimensions/audio and produce Blob
→ user saves file or explicitly records export artifact in workspace
```

Export should offer 16:9 / 9:16 / 1:1, 720p/1080p, 24/30 fps and full/range selection. If H.264 MP4 is unavailable, show an honest supported format/PNG fallback instead of pretending it succeeded. Optional future server workers use the same normalized ExportSnapshot and Remotion composition with version-pinned dependencies.

**Performance:** export frame count and audio duration should be derived from rational FPS, not floating-point time increments. Use bounded media memory, preload assets and release generated Blob URLs when no longer needed. Progress, cancellation, no-memory-leak and editing-while-export tests are release gates.

## 15. Quality, security and observability

- Zod validate at CSV/JSON/archive/SQLite RPC boundaries; use migration IDs and logical schema hashes.
- Enforce OPFS quota diagnostics and request persistent browser storage when appropriate; never misstate durability.
- Archive protections: no zip-slip, zip bombs, oversized media without warning, malicious MIME spoofing, or auto-run scripts.
- Performance telemetry is opt-in/local-only initially; log timing/capture errors without uploaded market data.
- Do not persist sensitive provider API credentials in plain project archives (v1 does not include APIs).
- Render object coordinates and chart graphics against deterministic fixtures; compare preview/output logical states exactly, raster output with a calibrated tolerance.
- Sanitize imported labels and filenames in the UI; never evaluate user-provided JavaScript in project content.

## 16. Mandatory technical spikes

| Spike | Pass criteria | Owner action if failure |
|---|---|---|
| Remotion SVG+text+audio browser export | 1080p 30fps example with seek/export parity, supported codec | Narrow CSS/SVG usage; consider tested canvas adapter, revise export path |
| Remotion three-chart composition | 3 charts + SMT lines + camera focus and captions fit memory/latency budget | Optimize visible bar culling/caching, reduce high-cost layers |
| SQLite WASM OPFS | create/save/reopen, migration, 2-tab lock and quota failure in target Chrome | Choose another official VFS or explicitly narrow supported browsers |
| Dnd-kit timeline | trim, reorder, snapping, zoom and 100+ clip smoothness | Evaluate paid Remotion Timeline/Editor Starter purchase or alternate compatible source |
| Portable project round-trip | clean-profile archive import/export with all dependencies and equivalent evaluated frames | Fix archive contract before building complex editing |

## 17. Browser, versioning, and future compatibility

Target modern Chromium desktop first. **Offline application-shell requirement:** after an initial online installation/load, a service worker or equivalent static-app caching must allow full editor refresh offline, including Next.js client code, Remotion chunks, fonts and SQLite WASM binaries. Local OPFS data by itself does not cache the application. Prefer statically served client editor routes and test full refresh with network disabled; if Next.js cannot meet this without fragile SSR routing, escalate an explicit Vite SPA shell ADR rather than violating local-first. Explicitly capability-gate `navigator.storage`, OPFS, SQLite's chosen VFS, WebCodecs, audio codecs and browser renderer; use feature detection, not browser-brand assumptions. Lock Remotion packages to compatible identical versions and test release upgrades. Cloud sync/server rendering and tick data ingestion are boundary adapters, not core dependencies; their contracts must preserve source provenance and immutable render snapshots.

## 18. Handoff to agent implementation plans

After design approval, write separate Superpowers implementation plans for (1) Remotion+SQLite feasibility and skeleton, (2) candle data/chart objects and interactions, (3) MTF/SMT, (4) timeline/scenes/media, (5) portable/export/hardening. Each plan names exact files/interfaces/tests. Roadmap is sequencing, not permission to start product code.
