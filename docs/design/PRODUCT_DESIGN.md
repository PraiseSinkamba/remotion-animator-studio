# Chart Studio — Product & Experience Design

**Version:** 1.2 design draft · **Date:** 2026-10-24 · **Status:** For product review  
**Authority:** Paired with [Functional Spec](../spec/FUNCTIONAL_SPEC.md) and [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md).

## 1. Product thesis

**Chart Studio creates trading education videos from editable domain objects, not recordings of an existing chart terminal.** A user can construct candles, import real OHLC, explain correlations with SMT across two or three assets, zoom between timeframes, mark trades, add narrations and animate every visible component. The project is a video composition whose elements have life cycles. The trading chart is one kind of animated scene object, not a special full-screen editor that precludes other objects.

### Intended users

- Traders showing their methodology (SMT non-confirmation across two/three indices; HTF bias to LTF execution).
- Educators producing lessons with clear stepwise annotations, deliberate pacing and source integrity.
- Content creators making landscape lessons, square posts and vertical short-form explainers.

### Job to be done

"Given a setup I understand, help me make an accurate, polished video that explains *why* and *when* it mattered, without recording a terminal or manually animating every pixel in After Effects."

### Product principles

1. **Video-first, trading-native:** scenes/tracks are primary; chart objects have native OHLC semantics.
2. **Creative control:** manual bars and historical data are equal; can compose hypothetical stories transparently.
3. **Truthful replay:** when claiming historical accuracy, only use information known at that instant; label synthetic paths and source modifications.
4. **Reusable tools:** lines, zones, position markers, arrows and text share object lifecycle APIs.
5. **Small steps to publish:** defaults and presets shorten creation but never prevent precise adjustment.
6. **Local-first ownership:** internal autosave, Open, Save As, portable package and local export without an account.
7. **Predictable editor:** same input and frame means same logical content in preview and export.

### Non-goals

Not a live trading terminal, broker, automated trading signal generator, comprehensive NLE, charting social network, or a reverse-engineered copy of another vendor's proprietary code. Do not promise import from every broker/provider in v1.

## 2. Mental model and navigation

```
Dashboard
  ├─ New: Blank / Manual Chart / Import Data / SMT + MTF Breakdown preset
  ├─ Recent projects (locally saved, searchable, thumbnails)
  └─ Open portable .chartstudio
        ↓
Project editor (composition scope)
  ├─ scene-strip timeline (sequence, overlap, total duration)
  ├─ scene thumbnails, global playhead, project preview
  ├─ asset library, instruments/datasets, templates
  └─ double click scene → detailed editor
        ↓
Scene editor (local scope)
  ├─ left tool rail + objects/scenes/data tree
  ├─ central Remotion preview (one composition)
  ├─ right context inspector
  ├─ bottom scene timeline (tracks, keyframes, local playhead)
  └─ breadcrumb ↑ returns to project editor
```

**Selection continuity:** select a chart object on canvas → highlight layer row and selected clip(s) → open inspector for the chart view, its source, layout, clock policy, opacity and keyframes. A group selection controls common transform; drilling into a group selects its members. Navigation changes context, not persisted scene content.

## 3. Dashboard design

Home shows project thumbnails/cards, name, dimensions, total duration, last local commit, storage health, sync badge if cloud later, and actions Rename / Duplicate / Delete / Export Project. Search/filter by date/name and show recovery cards for incomplete imports and autosaves. New-project start options:

- **Blank video:** empty scene + canvas resolution/fps.
- **Manual chart story:** scene with empty chart object and candle builder open.
- **Historical replay:** OHLC import wizard, then chart object with replay clip.
- **SMT + MTF Breakdown:** preset with `Context`, `Comparison`, `Execution`, `Outcome` scenes and two/three blank chart slots. Every title/object remains editable.

A project should reopen at its previous editor location and retain per-scene viewport/track zoom preferences separately from saved composition data.

## 4. Editor workspace

### Layout and panels

**Top bar:** breadcrumb (`Project / Scene`), title, local save status, undo/redo, preview scope, aspect ratio and export.  
**Left tool rail:** select, hand, manual candle, high/low horizontal line, trendline, zone/rectangle, long/short position, arrow, text, SMT link.  
**Left browser:** tabs for Scenes, Objects/Layers, Data (instruments/series/timeframes), Assets, Templates.  
**Center:** interactive Remotion Player plus transparent selection/handle overlay. Safe areas, snap guides, background and canvas zoom.  
**Right inspector:** type-specific object data + style, position/duration, anchoring, source status, keyframes, synchronization and interpolation.  
**Bottom:** collapsible/resizable parent scene timeline or expanded local scene timeline; per-track eye/lock/solo controls.

Minimum target: desktop Chromium with layouts usable at 1366×768; no v1 mobile editing promise. Panels can collapse and persist layout per user. UI focus/keyboard handling must prevent Space/Delete from firing when typing in text fields.

### Canvas controls

Click to select; Shift-click multiselect; drag to move; resize via handles; wheel/pinch zoom editor canvas (not chart market zoom unless chart focus is active); right-click context menu; Esc cancels in-progress insertion; duplicate/delete/group/ungroup via commands; snapping to edges and chart anchors where valid. Selected market-anchored lines display price labels. Locked objects cannot be manipulated through the canvas but still render.

### Type-dependent inspector

| Selection | Inspector essentials |
|---|---|
| Chart | Source series, instrument, TF, visible bars, scale, candle style, replay mode, opacity, market-time sync |
| Chart group | Members, layout, gap, time sync, focus chart, per-member visibility/scale |
| Candle | O/H/L/C, timestamp/logical index, provenance, reset to source, dynamic path policy |
| Horizontal/HL line | Price, label, line style, chart anchor and lifecycle |
| Trendline | Two market-coordinate endpoints, ray/segment, style |
| Zone | Start/end time or index, high/low price edges, fill/opacity, extension |
| Position | Entry/stop/target, direction, optional labels and ratio, timeline visibility |
| SMT observation | Swing pairs A↔B(/C), candidate status, author confirmation, source revisions, reveal order |
| Text/image/audio | File/content, transform, trim or timing, style, opacity, volume where applicable |

## 5. Scene objects are video objects

A chart is **one scene object** with identity, placement, duration, state and animations; its internal candle renderer uses market data and a viewport. Two separate HTF and LTF chart objects can be used in the same scene or separate scenes. Neither requires a fixed 2-chart template.

Object lifecycle has five concepts:

1. **In-point:** the first local frame at which it is active (inclusive).
2. **Out-point:** frame after the last active frame (exclusive).
3. **Entry treatment:** instant/fade/slide/scale/zoom where type permits.
4. **Active animations:** candle replay, camera focus, opacity, transform, style or drawing progress.
5. **Exit treatment:** fade/slide/scale/remove, before out-point.

*Examples:* an HTF chart appears from frames 0–270, shrinks to 35% width by frame 180, and leaves at 270. An LTF chart enters at frame 150, becomes full screen at 270, and holds to frame 600. A zone anchored to HTF price appears from frame 25 to 270; an LTF entry marker appears at frame 370. These numbers illustrate video frames, not price values or historical market times.

Two charts can share a market cursor but have **independent object lifetimes**, independent candle styles, independent zoom, and independent price scales. Choosing layout `side-by-side` is shorthand for animating position/size presets, not changing what a chart fundamentally is.

## 6. HTF/LTF presentation patterns

- **HTF alone:** full-canvas chart introduces external/internal range, draws highs/lows and zone, then fades.
- **LTF alone:** full-canvas smaller timeframe chart replays entry model and stop/target.
- **Simultaneous:** HTF left (40%), LTF right (60%) with common market cursor and independent scaling.
- **Picture-in-picture:** LTF chart opens above the HTF, then expands as focus shifts.
- **Sequential replacement:** HTF full → animated shrink/slide → LTF full, maintaining voice-over and drawn annotations.
- **Three-asset SMT grid:** primary instrument large, two comparators smaller or equal thirds, time-linked pivot labels.
- **Focus spotlight:** dim other charts while stepping through each sweep; change focus on timeline without editing source data.
- **HTF→LTF jump:** camera/scene transformation shows a marked HTF region and transitions into an LTF chart view of the same market window.

Layouts are presets for transform keyframes, parent groups and synchronized market-time mappings. They should not be permanent editor modes.

## 7. Manual candles and appealing dynamic formation

Manual candle wizard: choose chart object, set opening price or relative price position, enter O/H/L/C or drag body/wick handles, append/insert bar; choose duration/reveal. Keep a numeric inspector for precise edits. Reuse previous close as next open only when the user explicitly selects linked-open mode; gaps between consecutive bars are legal.

Two first-class reveal styles:

**Discrete:** reveal complete candle at selected time; fade/grow/wipe are graphics, not historical price reconstruction.  
**Dynamic:** form the candle gradually from open to current price, updating partial body, wick high, wick low, and price cursor. Offer OHLC-bounded `open→high→low→close`, `open→low→high→close` and seeded smooth-path presets. These are **simulations**, and the UI/export must identify them as such for historical source data. Real tick-driven formation remains future work.

Object entry/exit can animate independently of price formation. Thus a whole chart may fade in while its final candle continues forming. Creator can freeze/hold a chart and emphasize another with a spotlight while the underlying presentation clock continues.

## 8. Basic creator tool design

| Tool | Interaction | Defaults |
|---|---|---|
| High/Low line | Click candle high or low; anchor at exact price, extend right/left | Price label, line color, style |
| Horizontal price line | Click/chart price input; optional label | Extend across active chart viewport |
| Trendline | Two clicks at candle/time+price endpoints | Segment, ray option, draggable anchors |
| Zone | Drag market-time interval and price band | Translucent rectangle, label, extend-right toggle |
| Position | Select long/short, place entry then stop and target | Risk/reward geometry and numeric inspector; no simulated P&L claim |
| Text | Click/add, type, set font/position; market or scene anchor | Template labels and animation presets |
| Arrow | Draw start/end in market or scene coords | Straight/curved style, progressive stroke |
| SMT link | Select two swing pairs per asset, confirm, render linked callouts | Explicit pair states and historical confirmation |
| Manual candle | Draw or enter valid OHLC | Existing bar style or local override |

Tools are **editable objects**, not burnt-in pixels. Common properties include opacity, transform, in/out frames, draw-on animation, and layer position; prices and market anchors only exist on relevant types. Grouping must not turn market-anchored coordinates into arbitrary screen positions silently.

## 9. Hierarchical timeline UX

**Project level:** ordered scene cards/blocks with duration, transitions, names, thumbnail, global time ruler and full video playback. Double-click enters scene; drag scene block to reorder; duplicating creates new scene identity with asset refs retained; a crossfade is an overlap of outgoing/incoming scene renderings.

**Scene level:** tracks for Chart/Chart Group, Camera, Drawing, Text, Image, Audio, Effects; each clip is movable and trimmable on integer frames; property keyframe lanes expand from selected object. Snapping to playhead, object boundaries, scene boundaries, candle reveal milestones and markers. Basic keyframes: position, scale, opacity, rotation, focus/camera. Clip visibility, lock, solo, mute and nesting as appropriate.

**Playback:** Space play/pause, frame-step arrows (when not typing), Home start, loop in/out, numeric timecode, optional editor-only playback speed. Distinguish `presentationFrame` from `marketUtc` and chart-progress. Changing preview speed never affects saved video duration. Store separate project-level and scene-level playhead/zoom states in ephemeral editor session settings.

**Retiming:** extending a scene adds blank/hold time; trimming hides out-of-range clips without immediately destroying them; explicit Stretch proportionally retimes only selected content; changing crossfade length affects composition overlap, not source-market history.

## 10. Asset and template experience

Asset browser supports OHLC files (CSV/JSON), audio, image assets, and project-generated thumbnails and SVG snapshots. Drag a dataset onto canvas to create a chart object; drag the same dataset again to create an independent chart view. Keep sources immutable and edits as overlays. Asset row shows source symbol, timeframe, first/last UTC timestamp, quality/gap warnings, hash and usage references.

Built-in templates: `HTF→LTF Drilldown`, `2-Asset SMT Lesson`, `3-Asset SMT Comparison`, `Entry/SL/TP Breakdown`, `Manual Pattern Explanation`, `Vertical Short`. Template insertion produces editable independent copies of scene/object definitions; underlying immutable source assets can be shared.

## 11. Project files and saves

**Save:** commit SQLite local revision and visible status. **Save As:** create external portable `.chartstudio` archive (never silently save over prior external file). **Open Project:** validate/import archive as a local workspace project. **Export Project:** save all required dependencies in a versioned archive with manifest/checksums. **Export Video:** render output MP4 or PNG, separate from source project packaging.

A Save operation does not necessarily update a previously exported archive. Clearly show `Saved locally` vs `External file needs updating`. Browser storage may be cleared; provide persistent-storage guidance and project backup affordances. Linked-file autosave and cloud sync are deferred.

## 12. Core creator flows

### Flow A — Quick manual chart explainer

Dashboard → New Manual Project → add candles → choose dynamic OHLC formation → add horizontal line/arrow/text → adjust clip timing → preview → local save → MP4.

### Flow B — Imported historical breakdown

Dashboard → import CSV/JSON → identify symbol+TF+time policy → validate data → select range → chart object → add zone/trendline/position → reveal price sequentially or simulate intrabar explicitly → narrate → export.

### Flow C — Two/three-asset SMT

New SMT preset → load data for 2/3 instruments → set comparable sessions/price bases → create separate chart objects → synchronize market cursor → select **two swing highs or lows per asset** → suggestions + manual counterpart selection → confirm each pairwise interpretation → animate sweep/nonconfirmation labels → add conclusion → export.

### Flow D — MTF lesson

Import/derive 4H, 15M and 1M where data supports → chart objects HTF & LTF → show HTF alone → resize to sidebar and reveal LTF → animate partial HTF safely → spotlight entry area → reveal position and text → close with full-frame LTF outcome.

Full detailed storyboards and timeline cue sheets live in [Video Scenarios](../scenarios/VIDEO_SCENARIOS.md).

## 13. MVP visual and workflow quality bar

A first-time creator can make a coherent 30–90 second education video with only a data file or self-authored candles, without leaving the app to complete captions, chart drawings and basic audio. Multi-chart layouts look intentional; transitions don't jump due to scale changes; annotations stay price-anchored; all synthetic motion is visibly labeled as such when it purports to be historical data. Save/undo/scrub/export preserve the selected narrative. This is a release criterion, not an asserted benchmark.

## 14. Review boundary

**Already selected by the owner:** local-first + file workflow, SMT 2–3 assisted, MTF, hierarchical timelines, Creator-ready media, animated candle modes, SQLite preference.  
**Recommended for approval:** Remotion-first compositions, React SVG chart object rendering, dnd-kit/shadcn editor, explicit object lifecycle, timeline UX/presets and v1 feature inclusions.

This draft is ready for owner review, not implementation authorization. After approval, produce scoped task-level plans per roadmap slice.
