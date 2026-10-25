# Chart Studio — Creator Video Scenarios and Workflow Recipes

**Version:** 1.2 draft · **Goal:** concrete end-to-end usage examples for design, development, demonstrations and acceptance tests.  
**Important:** Sample market labels are illustrative. These are **storyboard designs**, not factual trade histories, indicators, signals or investment advice. Every use of real market claims must be grounded in the imported dataset. FPS examples default to 30; frame intervals below are illustrative and half-open `[start,end)`.

## Reusable scenario structure

Every video scenario should have:

1. **Creator goal** — what the trader is trying to explain.
2. **Data inputs** — manual, imported OHLC, derived TF, provenance and time sync.
3. **Object hierarchy** — scenes, chart/group objects, drawing objects, text, audio.
4. **Frame cue sheet** — when each object enters, changes, pauses or exits.
5. **Interactions** — what the user actually does in the editor.
6. **Acceptance checks** — what export and persistence must reproduce.

### Global lifecycle conventions

A chart exists independently of its datasets. Its frame in/out controls its video visibility; its replay clip maps presentation frames to source candles/market instants. A chart may be resized and faded while still replaying. Each drawing has its own independent lifetime and follows either chart-price/time or scene pixel anchors. A scenario may reuse assets without copying source data.

## SC-01 — A manual candlestick lesson

**Goal:** teach why a rejection wick matters without importing historical data.  
**Output:** 30s landscape video, 1920×1080, 30fps = 900 frames.  
**Data:** manually authored synthetic OHLC sequence with no genuine market timestamps; show `Illustrative scenario` in project metadata/video description.

**Objects:** `Chart-A` (full-canvas), `CandleSeries-Manual`, `HorizontalLine-High`, `Zone-Supply`, `Arrow-Rejection`, `Text-Title`, `Caption-Explanation`, optional audio.  
**Cue sheet:**

| Frames | On-screen behavior | Creator timeline edits |
|---|---|---|
| 0–90 | Title over empty chart | Text in 0, fade out by 90 |
| 90–360 | Candles build one by one | Chart replay clip discrete or dynamic, reveal duration |
| 360–480 | Final candle forms realistically from O through H/L to C | Select seeded OHLC-consistent simulated mode, frame hold |
| 480–630 | High line appears at exact candle high, then translucent zone | High/Low tool and Zone tool; animate opacity/draw |
| 630–780 | Arrow points to rejection wick, caption explains | Arrow endpoint anchored to market coordinate |
| 780–900 | Hold final setup, fade out | Exit opacity keyframe |

**Workflow:** New Manual Project → add numeric O/H/L/C via candle inspector → select formation preset → draw high line, price zone, arrow → add captions → stagger durations on scene timeline → preview seek backward → Save As → render MP4.  
**Assertions:** final animated candle equals entered OHLC; any frame can be sought directly; no origin is misrepresented; a high-line remains attached under canvas resize.

## SC-02 — HTF-only market-context explanation

**Goal:** show daily/4H context and why an important range matters, without showing entry timeframe yet.  
**Data:** actual imported HTF data with clear source, session and timestamp conventions, or coarser bars derived from a valid finer dataset.  
**Output:** 25s landscape scene.

**Objects:** full-canvas `HTF-Chart`, `PriorHigh`, `PriorLow`, `Zone`, `Title`, `Voiceover`.  
**Cue sheet:** 0–5s context candles reveal rapidly; 5–10s frame freezes as prior-day-high/prior-day-low horizontal lines animate; 10–17s zone fills; 17–22s camera zooms into area; 22–25s text label transitions in.  
**Workflow:** Import → select HTF chart view → use high/low line shortcuts → price-anchored zone → keyframe viewport camera → timeline pause/hold → audio.  
**Assertions:** stop price labels don't drift; no future bar appears at earlier as-of time; if source only contains HTF completed OHLC, label completed-bar mode instead of pretending to have authentic intrabar path.

## SC-03 — LTF-only entry execution

**Goal:** teach a one-minute entry after contextual bias has already been described.  
**Data:** imported actual 1M bars or manually authored illustrative 1M price story; no inference of actual 1M movement from 1H OHLC.  
**Objects:** full-canvas `LTF-Chart`, `Entry-Zone`, `Trendline`, `LongShortPosition`, `Caption`, `Arrow`.  
**Cue sheet:** 0–4s chart enters/zooms; 4–12s candles develop under dynamic simulated intrabar policy; 12–18s line/zone forms and entry marker appears; 18–25s entry/SL/TP and R:R labels fade in; 25–33s price continues to outcome; 33–38s hold/recap.  
**Workflow:** Add scene → drag 1M series onto scene → add position tool, set entry/stop/target numerically → select simulated or discrete replay, freeze as needed → show caption.  
**Assertions:** position geometry remains numerically consistent with price scale after chart camera zoom; users are not led to think hypothetical path is actual ticks.

## SC-04 — HTF and LTF side by side with independent lifecycles

**Goal:** connect higher-timeframe bias with lower-timeframe entry, using simultaneous and sequential viewing.  
**Data:** 1M source with correctly aggregated 15M/1H chart view where valid; otherwise import valid separate TF source and show alignment limitations.  
**Output:** 45s landscape scene, 1350 frames.

| Frames | HTF object | LTF object | Other objects |
|---|---|---|---|
| 0–180 | Full screen, reveal context | Not active | Title, HTF zone |
| 180–270 | Resize/slide left to 40% | Fade/slide into right 60% | Caption `Zooming into execution` |
| 270–600 | Visible, time-linked, 40%; optional freeze | 60%, 1M candles progressively form | Crosshair sync, HTF line |
| 600–870 | Dim and shrink to 25% inset | Expand to 75% primary | Entry/SL/TP graphics |
| 870–1170 | Hold prior HTF frame, no future leakage | Full-focus replay outcome | Arrows and caption |
| 1170–1350 | Fade out | Full screen, then fade | Closing summary |

**Workflow:** Add two **separate Chart objects**, set chart-view references `HTF/1H` and `LTF/1M`; optionally assign same ChartGroup for market-time sync; use layout preset `Split 40/60` to author default transform keyframes; tweak individual in/out, `freezeAtMarketUtc`, opacity and camera on separate tracks.  
**Assertions:** user can select/manipulate HTF and LTF separately; change to split/grid/PIP without changing underlying data; a market-anchored level remains correct in each chart; no bar-index lockstep; a paused HTF doesn't pause LTF unless shared replay demands it.

## SC-05 — Two-asset SMT divergence lesson

**Goal:** demonstrate a nonconfirmation between two **positively correlated** instruments without outsourcing trader judgment to an automatic scanner.  
**Data:** real datasets for NAS100-like and US500-like feeds mapped to explicit provider/price basis/session metadata, or clearly marked synthetic educational examples.

**Objects:** two Chart objects side-by-side, `SMTObservation-1` storing A prior+current swing and B prior+current swing, linked drawing object, text/caption and optional audio.  
**Cue sheet:** 0–5s explain market context; 5–12s reveal first swing pair; 12–18s chart A sweeps prior high; 18–23s counterpart chart B fails to confirm; 23–30s draw SMT connection lines and name the divergence **after user confirmation**; 30–40s continue price action; 40–45s recap.  
**Workflow:** two imports → two charts → `Compare SMT` → select anchor high **prior and current** → engine suggests candidates on counterpart within UTC window → user chooses B's prior and current highs → inspect corresponding HH vs LH/EH and pivot confirmation → confirm → choose `staggered SMT reveal` preset → add title → export.  
**Assertions:** candidate suggestions never auto-confirm a trade; selecting anchor after a pivot's confirmation boundary reflects true information; editing B's bars invalidates the confirmed observation and export warns until reviewed; pair IDs persist.

## SC-06 — Three-asset SMT comparison

**Goal:** show divergence among NAS100, US500 and US30-like index series as pairwise comparisons, never an unexplained single 3-way signal.  
**Data:** three distinct sources with UTC timestamps and price/session basis; divergent sessions intentionally included as diagnostics fixture.  
**Output:** 60s landscape or square video.

**Objects:** group object containing three chart objects; primary large chart with two comparators or equal grid; two `SMTPairComparison` records A↔B and A↔C; label/stroke layers.  
**Cue sheet:** 0–10s three charts reveal; 10–23s primary sweeps high; 23–32s comparator B high pair highlighted; 32–41s comparator C pair highlighted; 41–48s show pairwise labels; 48–60s focus primary and complete the explanation.  
**Workflow:** configure chart group three instruments → use common market cursor → choose two highs on primary → system suggests time-aligned swing pairs for both comparators → individually adjust/confirm A↔B and A↔C → insert linked annotation and staggered clips.  
**Assertions:** a missing comparator session never silently fills a candle; B may confirm and C may not, preserving two distinct outcomes; independent price axes; 3-panel preview/export parity.

## SC-07 — Imported history with an explicitly hypothetical branch

**Goal:** explain "what would have happened if price continued higher" without falsifying a historical chart.  
**Data:** immutable real OHLC source until branch candle, then manually constructed alternative continuation with provenance = hypothetical.  
**Objects:** `HistoricalChart`, `ScenarioChart` or switchable series branch, title `Hypothetical continuation`, edited candle animations and callouts.  
**Cue sheet:** 0–10s genuine historical sequence; 10–14s pause/branch-point marker; 14–28s hypothetical candles build progressively; 28–35s compare outcomes with clearly distinguished colors/labels.  
**Workflow:** import dataset → select branch point → create editable working continuation with manual candles → add explicit hypothetical label, animation, then archive/export.  
**Assertions:** source unmodified, branch trace retained, source/source-revision metadata preserved. A first release can implement branching as a copy of an editable series and explicit provenance if advanced fork UI is deferred.

## SC-08 — Flagship end-to-end SMT + MTF trading-style video (RELEASE GATE)

**Goal:** create a coherent 90-second educational trading video showing an HTF range, 2/3-asset SMT nonconfirmation, the LTF entry breakdown and outcome with natural dynamic candles.  
**Output:** 1920×1080, 30 FPS, 2700 frames, optional 9:16 variant.  
**Data:** three fixture instruments with real timestamp structure, session gaps, compatible 1M/15M/1H data where derived, and explicitly simulated OHLC path for dynamic candles; fixture prices are **synthetic**, not an actual session claim.

### Project-level storyboard

| Scene | Global frames (illustrative) | Primary charts | Main animation and objects |
|---|---|---|---|
| S1 Context | 0–540 | HTF full screen | HTF high/low lines, supply/demand zone, caption, narration |
| S2 SMT | 510–1350 | 3-asset synchronized charts | Sweep one, nonconfirmation two/three, linked SMT lines, step labels |
| S3 Entry | 1320–2160 | HTF small inset + LTF main | HTF→LTF focus transition, real source bars plus labeled simulated candle formation, position tool |
| S4 Outcome | 2130–2700 | LTF full screen | Replay, arrows, R:R summary, closing caption/music |

These ranges include 30-frame crossfades between scenes. During overlap both scenes evaluate independently; global total frames 2700. The exact scene placement/length must be verified by the composition solver instead of assuming clip times can just be summed.

### Creator steps

1. Open dashboard, create `SMT + MTF Breakdown` project with the `3-index lesson` preset.
2. Import three data files; map timestamps/time zones/price basis; inspect gaps and confirm symbolic aliases are **not** assumed identical feed data.
3. Assign 1M and 15M/1H source series or derive HTF from valid finer data. Confirm partial HTF policy.
4. Scene 1: place HTF chart as its own video object; set its [in,out), add prior-high/low lines, labeled zone and camera zoom/hold.
5. Scene 2: add three chart objects in a chart group; set shared market clock; configure independent scales. Select prior/current anchor swing highs and counterpart candidates B/C; inspect, adjust and explicitly confirm each pairwise comparison.
6. Animate anchor sweep, then comparator nonconfirmations, then SMT annotation/label with distinct timeline clips. Add voiceover.
7. Scene 3: reuse data in independent HTF/LTF chart objects; configure HTF inset ↔ LTF full-screen transform keyframes; choose one LTF replay clip using simulated intrabar mode; add entry/SL/TP position tool and price zone.
8. Scene 4: show full LTF outcome with an arrow, caption and closing title. Arrange scenes and 1s crossfades at project level.
9. Preview globally and by scene: seek directly to first/highest/lowest/transition/final frames; ensure HTF partial bars don't reveal future data and SMT pivots weren't confirmed early.
10. Save locally; reload browser. Save As `.chartstudio` and reimport into fresh profile. Render supported local MP4, with optional PNG still from most instructive frame. Confirm audio and all chart graphics are present in export.

### Acceptance data and evaluation

- All three chart instances preserve their own series, timeframes, price scales and media lifecycles; the same dataset may be used across scenes without duplicating source.
- `SMTObservation` stores **both prior/current swing IDs** on each instrument, two pairwise outcomes and explicit author confirmation. If a fixture bar is edited before export, relevant observation becomes stale and blocks/warns for truthful publication.
- All chart groups use UTC/session-based alignment, not common array indices. At 1M→15M partial HTF frames, only already eligible constituents contribute.
- Simulated dynamic candles stay within their OHLC range and finish exactly on their imported/edited values; UI and exported metadata identify simulation.
- SQLite Save persists the project head, source identities, media refs, timeline and layout keyframes. External archive imports without origin storage.
- Preview evaluated state equals web-rendered logical state at representative frames near 0, 510, 540, 1320, 1350, 2130, 2160, 2699; visual pixel tolerance and audio alignment checks pass.
- MP4 capability detection, render failure/retry/cancel, data warnings and progress behave honestly; render doesn't mutate ongoing edits.

## Additional short-form variant — Vertical explainers

Creator chooses a 9:16 output and swaps the chart-group layout from horizontal to stacked, focusing primary chart while comparator becomes inset. Existing trading objects maintain market anchors, while their scene transforms are re-keyframed to fit readable labels. The MVP may provide a vertical preset with manual layout adjustments; automatic semantic reflow is out of scope.

## Scenario-to-feature traceability

| Scenario | Main acceptance families |
|---|---|
| SC-01 | MD, AN, OB, TL, EX |
| SC-02 | TF, CH, OB, AN |
| SC-03 | CH, OB, EX |
| SC-04 | CH-001–008, TF-003–007, SC-003, TL |
| SC-05 | SM-001–010, CH, QA-004 |
| SC-06 | SM-011, CH-005, QA-006 |
| SC-07 | MD-004/008, AN-005, PR-005 |
| SC-08 | Entire P0 release, QA-001–006 |
