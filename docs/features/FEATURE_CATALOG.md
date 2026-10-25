# Chart Studio — Feature Catalogue and MVP Scope

**Version:** 1.2 draft · **Source:** [Functional Spec](../spec/FUNCTIONAL_SPEC.md)  
**Priority meanings:** **P0** required to ship creator-ready v1; **P1** valuable after the primary release; **P2** future direction. This is a feature inventory, **not** a statement about ChartAnimator's exact behavior.

## 1. Dashboard and project files

| Key | Priority | Feature | User-visible behavior | Acceptance |
|---|---|---|---|---|
| F-001 | P0 | Project creation | Blank, manual, import and SMT+MTF presets | PR-001 |
| F-002 | P0 | Recent projects | Thumbnail, rename, duplicate, delete/restore | PR-001 |
| F-003 | P0 | Internal autosave | Saved locally vs dirty state, recover on restart | PR-002–004 |
| F-004 | P0 | Open portable project | Validate and import `.chartstudio` into workspace | PR-005,008 |
| F-005 | P0 | Save As/Export Project | Archive with data/assets/checksums | PR-006–007 |
| F-006 | P0 | Undo and redo | Drag commits as one meaningful action | PR-003 |
| F-007 | P0 | Storage diagnostics | Storage quota/missing OPFS/lock and recovery help | PR-009 |
| F-008 | P1 | Linked external file | Explicit external write binding | PR-007 extension |
| F-009 | P2 | Cloud project sync | Optional cross-device revision transfer | deferred |

## 2. Charts and sources

| Key | Priority | Feature | User-visible behavior | Acceptance |
|---|---|---|---|---|
| F-010 | P0 | CSV/JSON importer | Column mapping, source identity, timestamp and session policies | MD-001–003 |
| F-011 | P0 | Manual candle builder | Add/insert candle, drag wick/body, numeric OHLC | MD-001,005 |
| F-012 | P0 | Candle property inspector | O/H/L/C, provenance, reset to source | MD-004–005 |
| F-013 | P0 | Source integrity | Immutable original plus edits/branch label | MD-004,006,008 |
| F-014 | P0 | Chart appearance | Bull/bear color, wick/body width, grid/axes, price scale | CH-001 |
| F-015 | P0 | Source range selection | Select bars by timestamp or range for story | MD-007 |
| F-016 | P0 | Independent chart objects | Add multiple instances of one/other dataset | CH-001,006 |
| F-017 | P0 | HTF chart alone | Full scene chart with independent lifetime | CH-002,SC-003 |
| F-018 | P0 | LTF chart alone | Full scene chart with replay or manual candles | CH-002,SC-003 |
| F-019 | P0 | HTF/LTF split | Two independently scaled charts sharing optional market cursor | CH-002–005 |
| F-020 | P0 | Picture-in-picture | Resize one chart over another, animate focus | CH-002,TF-006 |
| F-021 | P0 | 2-asset SMT layout | Two synchronized chart panels and linked annotation | CH-002,SM-001 |
| F-022 | P0 | 3-asset SMT layout | Three chart panels with 2 pairwise SMT outcomes | CH-002,SM-011 |
| F-023 | P0 | Chart visibility/freeze | Solo/hide/fade/hold chart while video runs | CH-004 |
| F-024 | P1 | Advanced manual pattern builder | Draw zigzag/pattern and derive OHLC | deferred |
| F-025 | P1 | More chart styles | Heikin Ashi, bars, line, volume-pane styles | deferred |
| F-026 | P2 | Live/provider import adapters | Broker/exchange APIs and metadata auto-detection | deferred |

## 3. Trading drawing tools

| Key | Priority | Feature | User-visible behavior | Acceptance |
|---|---|---|---|---|
| F-030 | P0 | Candle high/low line | One-click exact high/low, extend, price label | OB-001,005 |
| F-031 | P0 | Horizontal price line | Pick price, optional label and style | OB-001–005 |
| F-032 | P0 | Trendline | Two market anchors, segment/ray, adjustable endpoints | OB-003–005 |
| F-033 | P0 | Zone | Drag price band with horizontal extent and fill | OB-003–005 |
| F-034 | P0 | Long/short position | Editable entry/SL/TP boxes/lines, optional RR label | OB-006 |
| F-035 | P0 | Arrow | Scene/market anchored pointer, draw-progress reveal | OB-001,007 |
| F-036 | P0 | Text/caption | Editable text object with in/out and animation | OB-007 |
| F-037 | P0 | Object selection | Drag/resize/duplicate/group/lock/multiselect/undo | OB-002–004 |
| F-038 | P0 | Price/time anchoring | Drawings follow chart pan/zoom/replay | OB-003 |
| F-039 | P1 | Fibonacci retracement | Configurable level tool, additional anchoring UX | deferred |
| F-040 | P1 | Higher-level market structure tools | BOS/CHOCH, order blocks/FVG presets | deferred |
| F-041 | P2 | Extensible drawing-tool plugin API | Third-party advanced annotations | deferred |

## 4. SMT and MTF

| Key | Priority | Feature | User-visible behavior | Acceptance |
|---|---|---|---|---|
| F-045 | P0 | 2/3 instrument group | Distinct feed/price/session metadata; 2 or 3 chart views | SM-001 |
| F-046 | P0 | Anchor swing pair | Select prior and current corresponding highs or lows | SM-002 |
| F-047 | P0 | Suggested counterparty pairs | Rank eligible pivots in aligned time window | SM-003,010 |
| F-048 | P0 | User confirmation | Accept/replace/reject each comparison; user writes narrative | SM-004–007 |
| F-049 | P0 | Animated SMT overlay | Reveal sweep, nonconfirmation lines, labels across charts | SM-008 |
| F-050 | P0 | Stale observation tracking | Edit/reimport flags outdated SMT links | SM-009 |
| F-051 | P0 | 3-asset pairwise results | Independent A↔B, A↔C confirmations | SM-011 |
| F-052 | P0 | MTF import | Map multiple timeframe datasets to one asset | TF-001 |
| F-053 | P0 | Higher timeframe derivation | Aggregate from finer observed bars by session | TF-001–003 |
| F-054 | P0 | Partial HTF honesty | No future constituent values; closed-only fallback | TF-003–004 |
| F-055 | P0 | Synchronized cursor | Common market UTC mapping with independent chart scales | TF-005,CH-005 |
| F-056 | P0 | Animated timeframe focus | HTF alone→split→LTF only via object keyframes | TF-006 |
| F-057 | P1 | Automated SMT scanner | Batch signal discovery; **not** in v1 | deferred |
| F-058 | P2 | Authentic tick-based MTF | Tick data/partial reconstruction | deferred |

## 5. Animation and timelines

| Key | Priority | Feature | User-visible behavior | Acceptance |
|---|---|---|---|---|
| F-060 | P0 | Discrete reveal | Instant, sequential, batch and simple visual reveal presets | AN-001–002 |
| F-061 | P0 | Realistic simulated formation | Body/wick/high/low/close evolve through OHLC-consistent path | AN-003–005 |
| F-062 | P0 | Path styles | O→H→L→C, O→L→H→C, seeded smooth | AN-003 |
| F-063 | P0 | Candle-speed control | Retimed clips and optional hold/freeze | AN-006,008 |
| F-064 | P0 | Chart sync | 2–3 charts show same as-of market instant, independent lifetimes | AN-007 |
| F-065 | P0 | Object entry/exit | Fade, slide/scale, in/out points, opacity | OB-002, SC-003 |
| F-066 | P0 | Keyframe inspector | Position/size/opacity/rotation/focus and easing | OB-008, TL-002 |
| F-067 | P0 | Project composition | Scene reorder, duration, cut/crossfade and global playback | TL-001 |
| F-068 | P0 | Scene timeline | Tracks, clips, keyframe lanes, basic snap, resize, undo | TL-002–006 |
| F-069 | P0 | Playback transport | Play/pause, frame step, seek, loop, speed | TL-003–007 |
| F-070 | P0 | Cross-scene media continuity | Audio correctly aligned across cut/fade | TL-008 |
| F-071 | P1 | Animation graph editor | Curves, velocity handles, complex paths | deferred |
| F-072 | P2 | Motion-tracking/camera rigs | Advanced cross-chart/cinematic controls | deferred |

## 6. Creator media, video export, templates

| Key | Priority | Feature | User-visible behavior | Acceptance |
|---|---|---|---|---|
| F-075 | P0 | Image overlays | Add logo/photo, resize, keyframes, timing | OB-007 |
| F-076 | P0 | Captions | Title/paragraph/label, timing, typography, entry/exit | OB-007 |
| F-077 | P0 | Basic audio | Import voice or music, trim, volume, simple fades | EX-005 |
| F-078 | P0 | Reusable scene presets | Context, SMT, Entry, Outcome templates copy-on-insert | SC-004 |
| F-079 | P0 | Local PNG still | Still image for selected frame | EX-001 |
| F-080 | P0 | Local MP4 export | Supported-browser encode with diagnostics/verification | EX-001–004,006 |
| F-081 | P0 | Output presets | Landscape, vertical, square; 720p/1080p, 24/30fps | EX-002 |
| F-082 | P0 | Frozen export job | Editing after render start does not change output | EX-004 |
| F-083 | P0 | Portable archive | Complete dataset/media archive reproducible in clean browser | PR-005–008 |
| F-084 | P0 | Remocn motion component framework | Install compatible source-owned components into the local library; adapt to common frame/object lifecycle | CPT-002 |
| F-088 | P0 | First-party trading video components | Typed chart, chart-group, SMT and drawing component implementations with manifest, inspector and animation contract from R1 | CPT-001,003–006 |
| F-089 | P1 | Additional Remocn presets | Expand titles, effects, backgrounds and transitions beyond MVP needs | optional |
| F-085 | P1 | Waveform and multitrack audio mixer | Advanced audio controls | deferred |
| F-086 | P2 | Server/cloud render | Optional heavy-job backend | deferred |
| F-087 | P2 | AI scripting/narration | Assisted script, TTS, edit suggestions | deferred |

## 7. Shared behaviors that apply to every visual object

Each chart, group, high/low line, trendline, zone, position tool, arrow, text and image inherits the following unless inapplicable: stable identity; name; z-order; `(x,y,width,height,rotation,opacity)` video-space transform; frame in/out; locking; visibility; selection; duplicate/delete; undo/redo; inspector; keyframes of eligible properties; export from canonical composition. Chart-specific tools add market anchors; audio adds timing/volume but no visible rectangle unless explicitly represented as waveform UI.

**Lifecycle example:** a 15M chart can appear at frame 0, shrink at frame 100, continue market replay beneath a 1M overlay, fade at frame 420; its high/low line retains the correct price on that source chart regardless of size. This is not achieved by cutting chart footage.

## 8. Priorities and release gate

- **P0 stage 1:** local project/SQLite, import/manual candles, chart renderer, tools, object lifecycles, Remotion video export spike.
- **P0 stage 2:** chart groups, MTF no-lookahead, 2/3 asset assisted SMT, synchronized multi-chart replay, storyboard workflow.
- **P0 stage 3:** hierarchical timelines, images/audio/captions, transition, portable archive, QA.
- **P1:** richer drawing tools and automation-friendly presets only after P0 passes.
- **P2:** tick, cloud, full NLE, automatic SMT signals beyond scope.

**Full MVP acceptance:** run scenario `SC-08` (in scenarios doc) in a supported desktop browser from project creation through video + portable export, with valid source integrity and playback behavior.
