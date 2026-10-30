# Chart Studio — Quality, Fixtures and Release Verification

**Version:** 1.2 draft · **Primary source:** [Functional Spec](../spec/FUNCTIONAL_SPEC.md).  
**Principle:** domain correctness and save/export parity are more important than an attractive screenshot. Every new feature gets an explicit test against its normative acceptance ID.

## 1. Quality model

| Level | What it protects | Preferred tools |
|---|---|---|
| Pure unit/property | OHLC bounds, time conversion, pivot gating, animation functions | Vitest + property-based test library if justified |
| Contract | Typed schema validation, RPC request/response, migration/adapters | Vitest/Zod fixtures |
| Integration | SQLite Worker/OPFS lifecycle, series edits, MTF/SMT, scene snapshot | Vitest today; Playwright is the intended tool and is not installed |
| Component/UI | Tools, inspector, timeline drag/trim and selection | React Testing Library today; Playwright is the intended tool and is not installed |
| End-to-end | Creator journey from import to render/archive | Playwright on target Chromium — not installed; this row is a target |
| Visual/media | Exact evaluated state and tolerance-based pixel/audio comparison | Remotion still snapshots, image diffs, media metadata assertions |

No claim of passing tests or performance is valid until actual runs produce inspected results.

The repository contains a working editor and a runnable test suite. `pnpm test` runs Vitest across the
workspace; as of 2026-10-28 it is 154 tests over 12 files. Section 3 records what those tests cover and,
just as importantly, what they do not.

## 2. Foundational fixtures

**None of the fixtures below exist yet.** They are the fixture set still to be authored, and the table is
the specification of what each one must contain when it is written.

The fixture data that does exist today is:

| Fixture data | Where | What it provides |
|---|---|---|
| Deterministic synthetic bars | `generateSyntheticBars` in `packages/core/src/market.ts` | Seeded bar series for the candle maths and the chart renderer |
| The sample project | `packages/core/src/sample-project.ts` | A complete, valid project document used by the store and the composition |
| The storage contract suite | `packages/editor/src/storage/contract-suite.ts` | One shared set of assertions, run against every repository backend |

| Fixture | Purpose | Traps intentionally included |
|---|---|---|
| `manual-rejection.json` | Valid author-generated candlestick lesson | Doji, gaps, extreme wick, equal open/close |
| `invalid-ohlc.csv` | Schema and row error diagnostics | Nonfinite, swapped high/low, duplicates, negative volume |
| `indices-3asset-utc.csv` | 2/3-asset SMT candidate and sync | Distinct prices, missing timestamps, alias differences |
| `smt-bull-bear-pairs.json` | Compare two successive highs/lows on each asset | Equal tolerance, contradictory A↔B vs A↔C |
| `pivot-asof-boundaries.json` | No early confirmation | Future right-side pivot bar not yet closed |
| `mtf-1m-to-15m.json` | As-of aggregation | Incomplete final HTF bar, incomplete LTF constituent |
| `session-dst-gaps.json` | Session and wall-clock correctness | DST gap/duplicate hour, market holiday, overnight bucket |
| `hypothetical-branch.json` | Provenance/working-series overlay | Manual inserted candles beside original source |
| `scene-crossfades.json` | Global/local timeline mapping | 30-frame overlaps and clips active on exact boundaries |
| `portable-manifest.zip` | Archive import safety | Wrong checksum, traversal path, huge inflate, orphan asset |
| `media-mixed-assets/` | Remotion export and local asset loading | Unsupported codec/font/image missing |

Fixtures must be generated deterministically, have metadata stating **synthetic/non-market**, and avoid licensing issues with proprietary market feeds.

## 3. What the suite covers today

As of 2026-10-28 the suite is 154 tests over 12 files. What it actually asserts:

- **The candle maths** — bar generation, frame evaluation, the price range and the conversion from a
  series to a frame count.
- **The component registry** — every inherited element registers, the catalogue metadata is asserted, the
  categories are ordered, and a fresh instance is built from the defaults. The test relies on the
  aggregator alone to register the components, so a definition that stops registering is caught rather
  than silently dropped from the library.
- **The project migration** — a legacy document migrates, a current document round-trips unchanged, a
  document from a newer schema version is rejected by version, and the migration is idempotent and does
  not mutate its input.
- **The store** and **the timeline's lane packing**.
- **The storage layer** — one contract suite run against all three backends: the SQLite driver, the
  localStorage repository and the in-memory repository. It covers the happy path, the quota failure, two
  writers conflicting, and the migration path.
- **The candlestick chart** — including the rule that a bar which has not happened yet never moves the
  price scale.

What it does **not** cover, and what must not be claimed:

- No browser end-to-end test. The editor has been exercised by hand and by the render gate, not by an
  automated browser suite.
- No fixture-driven market data. The suite runs on synthetic bars, never on a real price series.
- No pixel comparison between the preview and the export. The render gate proves the exported video
  matches the preview byte for byte for one fixed project, which is weaker than a tolerance-based
  comparison across a range of compositions.
- No performance measurement. The budgets in section 8 have no baseline behind them.

### 3.1 The new test surface: the chart element model

The chart element model slice — the project-level series registry and the datasource seam
(MD-009, MD-010), the authored swing path and its deterministic generator (AP-001–AP-004), the
chart as a collection of elements (CH-009, OB-010), the declared pane relations (CH-010, TF-008), the
curve vocabulary (CV-001–CV-004) and the
`evaluate` and `transportActions` contract extensions (TL-010) — is **not yet covered**: none of it
is implemented. Its design is
[ADR-007](../decisions/ADR-007-CHART-ELEMENT-MODEL.md) and
[the design spec](../superpowers/specs/2026-10-29-chart-studio-authored-path-and-chart-elements-design.md);
the assertion set it must satisfy is recorded here so the slice is written against it.

| New surface | What the suite must assert | Requirement |
|---|---|---|
| Series registry and datasource seam | A materialised series carries identity, origin, revision hash, ascending bars and stable bar ids; the same spec always yields the same revision | MD-009, MD-010 |
| Authored swing path | The close of each anchor bar equals the placed price exactly; the anchor regime determines the character of the segment from that anchor to the next, both under `auto` classification and under an explicit override; the same `(path, seed, algorithmVersion, generator settings)` always produces the same bars; the generated series is scale-invariant, so the same relative path produces the same relative output at a different price level; the drawn path is the skeleton, not a corridor, so the excursion beyond the drawn band is bounded relative to the configured volatility rather than zero; a moved anchor regenerates without a reload | AP-001, AP-002, AP-003 |
| Provenance | An authored path stays distinguishable from synthetic and imported series in the editor and in export metadata | AP-004, QA-005 |
| Schema version 2 migration | A v1 document migrates to a v2 document whose single pane renders the same candles in the same place; the migration stays non-destructive and idempotent; a higher version is still rejected | CPT-006 |
| Pane evaluation | The pane's bars never contain an index beyond the as-of index; with an automatic price range a future bar never moves the axis; a partially aggregated bucket holds no value from a later constituent | CH-003, TF-003, TF-004 |
| Anchors and drawings | A price-anchored drawing keeps its price when the chart is resized or moved; a drawing anchored to an unrevealed candle is hidden | OB-003, CPT-005 |
| Clock and binding | One series at two timeframes aligns by construction; two different series align by an author-supplied offset and never by row index | CH-005 |
| Pane relations | A rollup's timeframe ratio is derived from the two panes' aggregation factors, so the displayed ratio always agrees with the data; a rollup whose factors do not divide into a whole ratio is rejected, and the message names the pane to change; a lockstep pair advances together on the shared clock, with the same number of candles at every frame; a lockstep whose two panes disagree on the candle count or the aggregation factor is rejected; a cross-asset link is labelled as authored rather than market time in the editor and in the export metadata | CH-010, TF-008 |
| Timeframe ladder | Every offered timeframe is a rung of the fixed ladder, and a pane's aggregation factor is derived from its rung and the base rather than typed in; a pane's buckets fall on the rung's base-unit boundaries, so a `6H` pane buckets on 360, 720, 1080 and so on; a rollup's ratio is derived from the two rungs and always agrees with the data; a fractional ratio is displayed as the fraction it is, so `4H` over `6H` reads 1.5 and not 2, and the two rungs stay comparable through the base; a timeframe that is not a ladder rung is rejected | TF-008, TF-009 |
| Grouped chart | A group holds one to three chart objects, and a group with more is rejected; the group owns the arrangement, the clock and the relations, and takes no ownership of the charts' data, lifecycles or prices; each chart in a group keeps its own series, price scale, viewport and in/out frames | CH-010, CH-011 |
| Curves | The same curve evaluated at the same frame produces the same value in preview and export; the legacy effect easing vocabulary keeps its current meaning, so no existing rendered frame changes | CV-001, CV-002, CV-003 |
| Curve editor and transport actions | Every element, pane and effect that exposes a curve has one inspector control; a component's declared transport action is rendered and executed by the shell with no component name hardcoded in `apps/studio` | CV-004, TL-010 |
| Duration | A derived duration equals the maximum of every clip's end and every chart element's out, and the fixed value is adjustable with the slider | TL-009 |

The slice must also extend the render gate: `node scripts/verify-r1.mjs` builds its fixture with a
chart that has panes, a drawing and a curve, and the slice reports the still sizes and the MP4
outcome. The render gate is the only proof that the change reached the video path.

## 4. Critical unit assertions

### Candle integrity

- Complete candle satisfies `H >= max(O,C)`, `L <= min(O,C)` and finite numeric values.
- `simulateCandle(OHLC, seed, version, progress=0)` yields O=H=L=C=Open; `progress=1` yields exact input OHLC; at all intermediate steps partial high/low are monotonic extensions, never exceed bounds, and partial close lies inside bounds.
- Same seed, version and progress produce same value after unrelated frame evaluations; algorithms cannot use wall clock or unseeded random.
- With legal gaps between bars, editor must not automatically connect next O to prior C.

### Time and MTF integrity

- Every chart resolves market cursor by interval `[openUtc,closeUtc)`, respecting source close/open convention; equality at boundaries must be tested.
- 1M→15M aggregation at minute 7 cannot use minute 8–14 data, even if final 15M bar is already stored in SQLite.
- Imported HTF-only source cannot produce authentic 1M candles or truthful partial 15M without finer data.
- DST transition keeps UTC ordering; calendar day/week/session resolution follows source metadata.
- Three instruments with missing bars must preserve gaps/hold-last-known policy and independent price scales; never resample by index.

### Assisted SMT

- Candidate generation uses prior/current *same-kind* swing pair per asset; one pivot is insufficient.
- A swing requiring N right bars cannot be confirmed before those N bars have completed.
- Ranking deterministic for equal candidate sets/tie breakers; time offset and price tolerance displayed, not hidden.
- A↔B and A↔C store independent comparison status, including mixed outcomes.
- Mutating referenced source/revision marks observation stale, preserving old references for review; source mutation is never silent.
- Confirmed SMT label in video cannot appear before the configured as-of pivot confirmation when video claims live-chronological analysis.

### Component framework and trading component contracts

- R1 tests register a custom `CandlestickChart` and `HighLowLine` through a common component definition and verify serialized props, schemaVersion and deterministic per-frame rendering (CPT-001/003).
- An adapted Remocn title/transition is installed as owned source, with source revision and license notice, and renders at preview/export frames identically (CPT-002).
- An HTF and LTF chart group has separate lifetimes; hiding or freezing one chart does not affect the other chart's market state (CPT-004).
- Editor manipulation handles and inspector controls are absent from the Remotion export and do not alter price-anchored drawing semantics (CPT-005).
- Unsupported component schema versions and invalid keyframable property names are diagnosed during import/rehydration, never silently skipped (CPT-006).

### Timeline and object lifecycle

- Object active iff `startFrame <= frame < endFrame`, including frame just before/at boundary.
- Scene crossfade maps both active scene local frames correctly; outgoing/incoming gains/opacity follow defined transition curve.
- Seeking 0→999 or playing 0→999 yields identical evaluated frame 999; order of frame requests must not matter.
- One HTF chart freezes while LTF chart continues when their market-time mappings are independent.
- A chart panel transform never changes the price anchor of a horizontal line or zone.
- Playback speed changes preview wall-clock only, not output clip duration.

## 5. SQLite/OPFS tests

**Happy path:** new project -> commit revision -> persist dataset/media refs -> close tab -> reopen -> identical project head/references, no dependency on internet.  
**Crash boundary:** simulate interruption after OPFS staging but before SQLite commit; recover previous head, stage cleanup; after SQL commit but before temp cleanup, required published assets still valid.  
**Concurrency:** two tabs seek write ownership simultaneously; one writer succeeds, another receives read-only/takeover signal; no lost update.  
**Quota:** write throws quota exceeded, earlier snapshot remains usable and an explicit backup/export help message appears.  
**Migrations:** previous project version migrates or is rejected without altering original; expected revision compare-and-set prevents stale write overwrites.  
**Portability:** export logical archive, import into clean origin with no existing OPFS, render same evaluated scenes; corrupt hash/path/size fails atomically.

## 6. UI and editor tests

The tests below are a **specification**, not a passing suite. Playwright is not
installed and none of these cases run today.

- Adding a chart via data browser creates an object with editable in/out; adding same dataset twice creates distinct chart object IDs but same source hash.
- Selecting a drawn high-line highlights layer row, price inspector and relevant timeline clip.
- Dragging line/zone/position handles changes correct market coordinates; chart resizing does not move anchor price.
- Two/three chart group can switch horizontal/vertical/grid/focus layouts; each member can be independently selected and animated.
- Scene breadcrumb enters/exits local editor preserving unrelated scene playheads, zoom and selected objects.
- Timeline trim/drag snaps to exact frames and undo restores the entire drag as one command.
- Text-field focus prevents Space/Delete shortcuts; Escape cancels active tool without persisted half-completed object.
- Unsaved/saved-local/external-stale indicators accurately reflect durable commits and file exports.
- Offline refresh after install correctly loads app shell, SQLite worker/WASM, local project and stored assets.

## 7. Remotion render tests

- Build a composition from frozen JSON-serializable `ExportSnapshot`; render still via web renderer at boundary frames; compare evaluated geometry/labels/visible chart data to Player state. Raster comparison uses documented threshold, not byte equality.
- Render 1-chart and 3-chart compositions with SVG candles, lines/zones, position tool, captions/image, voice track, fades and a chart focus transition.
- Audio alignment: compare clip start/end and project transitions, ensure no repeated narration during scene crossfade.
- Codec gate: use actual `canRenderMediaOnWeb`/capability checks before advertising MP4/H.264. When unavailable, export still and communicate fallback rather than silently substituting a format.
- Missing file/font or canceled render must leave project unchanged and release object URLs/resources.
- Start export, edit the project, complete export, and assert output reflects frozen snapshot only.

## 8. Performance budgets as reviewable hypotheses

All numbers below are **targets**, not guarantees. Establish baseline hardware/browser details (at least one representative lower-middle desktop/laptop) and store measurements in CI artifacts before treating them as gates.

| Target | Proposed benchmark |
|---|---|
| Typical interactive scene | Aim for 30fps preview with 2 charts and simple overlays on reference machine |
| 3-chart SMT preview | Smooth direct seeking through indexed source with no full-scan of all source bars |
| Large OHLC source | 100,000 indexed bars without rendering entire dataset in React/SVG |
| Timeline | 100+ clips can trim/reorder without persistent UI stalls; measure p50/p95 |
| Frame evaluation | No required iteration from project start for direct seek |
| Local export | 720p/1080p 24/30fps support subject to actual codec/hardware capability |
| Memory | Peak/retained memory measured during 3-chart 90s export and asset cleanup |

Performance regression policy: capture frame evaluation time, SVG node count, DB query latency, clip interaction latency, memory high-water, render output verification. Optimize only after evidence; first cull invisible bars, use memoized geometry, chunk market queries and avoid whole-project rerenders on inspector updates.

## 9. Release gates

- **Gate A (architecture feasibility):** actual supported Chromium shows SQLite WASM OPFS save/reload, Remotion 1080p SVG + audio MP4 export, timeline usability and offline app shell.
- **Gate B (domain correctness):** candle origins/validation, timestamp alignment and no-lookahead tests pass; deterministic simulated path and user-confirmed SMT pairwise semantics are verified.
- **Gate C (creator experience):** SC-01 and SC-04 work in editor; manually add candles, transform HTF/LTF, add lines/zones/position tools, control lifecycle.
- **Gate D (full creator story):** scenario SC-08 from blank/preset to saved SQLite project, portable archive and video passes end-to-end.
- **Gate E (robustness):** storage failure, corrupt archive, missing assets, video codec failure, stale SMT, two-tab lock and interrupted render have tested recovery paths.

A missed gate blocks release or requires an explicit signed-off scope change; no silent downgrade to screenshots/cuts in place of dynamic candles, no loss of local-first export, and no unmarked hypothetical chart animation.
