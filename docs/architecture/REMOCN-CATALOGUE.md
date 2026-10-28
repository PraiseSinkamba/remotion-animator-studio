# The Remocn catalogue and what it means for our object catalogue

**Status:** analysis, 2026-10-28 · **Snapshot:** `docs/reference/remocn/` · **Decision:** `ADR-003`

## 1. Why this document exists

The first pass at "can we replace our elements with Remocn?" answered *no*, on the grounds
that Remocn components are fixed React components with a closed prop set, no inspector
metadata, no duration, and no keyframes. That answer was right about the *contract* and wrong
about the *model*.

Remocn is a **shadcn-style registry**. The upstream words are unambiguous:

> "each component is a `.tsx` file copied into `components/remocn/` that you own and edit."
> — `docs/reference/remocn/docs/getting-started-introduction.md`

> "Either way the result matches `npx shadcn add`: the source lands in your project and is
> yours to edit." — `docs/reference/remocn/docs/getting-started-installation.md`

Everything is MIT. There is no runtime dependency on Remocn: the code is in our repository,
we own it, and we are free to edit it. So the question is not *"can a Remocn component
satisfy our contract?"* — it never could, and that is true of every shadcn component. The
question is **"what does upstream hand us that we should start from, and what do we have to
build ourselves?"**

This document redoes the analysis on that basis.

## 2. What upstream actually is

| Measure | Value | Verified against |
|---|---|---|
| Registry items | 438 (432 components + 6 libs) | `registry.json` |
| Router rows | 328 components across 17 families | `llms-components.txt` |
| Items that copy further source in | 263 of 438 | `registry.json` `registryDependencies` |
| Licence | MIT | upstream introduction page |
| Install | `npx shadcn@latest add @remocn/<name>` | upstream installation page |

Six internal libraries are copied in as source: `stop-motion` (a stop-motion clock),
`scene-motion` (easings), `canvas-presentation` (HTML-in-canvas + WebGL2), `caption-core`
(transcript paging), `remocn-ui` (theme + timeline fold) and `icons-core` (path drawing).

### The families

| Family | Count | New npm packages the family needs | Remotion-only? |
|---|---|---|---|
| Typography | 71 | `@remotion/google-fonts` (22 items), `opentype.js` (3), `@remotion/paths` (1) | no |
| Shaders | 59 | `@paper-design/shaders-react` (19 base shaders, inherited by 40 presets) | no |
| Ui | 42 | `culori` (1), `lucide-react` (1) | no |
| Transitions | 32 | `@remotion/transitions` (31 of 32) | no |
| Captions | 31 | `@remotion/captions` (all 31) | no |
| Motion Graphics (generative loops) | 13 | — | yes |
| Ui Blocks | 12 | — | yes |
| Effects | 10 | — | yes |
| Filters | 10 | — | yes |
| Graphic Looks | 9 | `@remotion/paths` (1) | yes |
| Camera | 8 | — | yes |
| Logo Stings | 8 | `@remotion/paths` (1) | yes |
| Ai | 6 | `@remotion/google-fonts` | no |
| Social | 5 | `date-fns` (1), `@remotion/google-fonts` | no |
| Templates | 5 | `@fontsource/inter`, `@fontsource/manrope`, `@fontsource/roboto-mono` | no |
| Layout | 4 | — | yes |
| Compositions | 3 | — | yes |

Icons (101 items) exist in the registry but are not in the router table. The npm cost of
adopting a whole family is concentrated in four packages: `@remotion/transitions`,
`@remotion/captions`, `@paper-design/shaders-react` and `@remotion/google-fonts`.

### Upstream's own selection guidance

The router table pairs every component with a positive *Use for* and a negative *Avoid for*
that usually names the sibling to use instead. Upstream is teaching selection, not listing
features. The `Length` column is the component's own motion length at 30fps — "the point at
which the animation has finished… a floor for the `Sequence`, not the whole beat".

## 3. Our own catalogue, re-judged

Our 23 elements: 22 inherited generic elements (`src/registry/legacy.ts`) plus one
first-party trading element (`src/trading/definition.ts`). **Verdict vocabulary:** `REPLACE`
— upstream makes ours redundant. `EXTEND` — take upstream's source as the base, add our
domain semantics. `KEEP` — ours is better for the slot. `NONE` — no upstream analogue of the
same kind.

| Our element | Best upstream candidate | Verdict | Why |
|---|---|---|---|
| `text` (static layer, texture-masked letters, 35-type effect stack) | ~70 typography reveals: `soft-blur-in`, `per-character-rise`, `tracking-in`, `gradient-scale-cut-text` | **KEEP** | Each upstream item is a one-shot reveal with no duration prop, no params, no timeline binding — it can only ever be a *new* element, never a replacement for a content layer. Upstream is additive. |
| `counter` (exact decimal interpolation, prefix/suffix) | `number-wheel`, `rolling-number`, `slot-machine-roll` | **KEEP** | Upstream's are integer odometer mechanics; upstream's own note says *"The value includes a prefix or suffix like `$99`… use `slot-machine-roll`"*. Ours does decimals and prefixes over the clip's real length. `slot-machine-roll` is a candidate *premium look*, not a replacement. |
| `shape` (7 kinds, positionable) | `mondrian-split`, `bauhaus-build`, `puzzle-snap` | **NONE** | Upstream ships no primitive shape layer — every geometric item is a whole-scene composition that replaces the frame. |
| `cursor` (SVG pointer, x/y) | `cursor`, `simulated-cursor` (waypoint path, click ripple, press/drag phases) | **EXTEND** | Upstream owns the mechanics we lack. We add free placement, the effect stack, inspector params and clip-relative timing. |
| `image` | `polaroid`, `reel`, `stage` | **NONE** | Upstream only ships framed/propped media variants; the unframed media layer is our slot. |
| `video` | `polaroid`, `stage` | **NONE** | No plain video layer upstream, and no trim / rate / volume / mute params. |
| `gif` | — | **NONE** | Nothing upstream plays or syncs a GIF's own timeline. |
| `audio` | — | **NONE** | **No audio component exists in the 438-item manifest.** Ours already wraps `<Audio>` with trim/rate/volume. |
| `html` (arbitrary HTML + CSS) | `chat-flow`, `message-bubble`, `glass-code-block` | **NONE** | Upstream's UI family is one hardcoded mock per component — good as new elements, but not a generic HTML layer. |
| `emoji` | `caption-emoji` | **NONE** | The only upstream emoji is transcript-driven (`captions: Caption[]`). No free-standing emoji element. |
| `wave` (multi-layer, parametric) | `squiggle`, `shader-water`, `flow-field` | **KEEP** | Ours is the only layered, parametric wave band; upstream's are a single self-drawing line or a full-bleed WebGL shader with no per-element placement. |
| `blob` (seeded morph) | `gooey-morph`, `shader-metaballs` | **KEEP** | Upstream's is a filter on a title or a full-bleed shader. `gooey-morph`'s SVG goo-filter is worth borrowing if we want blobs to *merge*. |
| `particles` (7 kinds, seeded, per-particle image) | `confetti`, `radial-burst`, `trim-burst` | **KEEP** | Ours is a continuous seeded emitter; upstream `confetti` is a single one-shot burst — a preset, not a replacement. |
| `synthGrid` | `synthwave` | **KEEP** | Upstream's grid, sun and mountains are welded into one scene; ours are three independently positionable, independently timed layers. |
| `neonSun` | `synthwave` | **KEEP** | Upstream's sun has no size/stripe/glow params — it is welded into the scene. |
| `isoCity` (seeded city, per-building colour) | `isometric-build`, `exploded-view` | **KEEP** | Upstream's is a fixed stepped sculpture with one accent tower; strictly less capable. |
| `skyCycle` (day→night, star field) | `shader-mesh-gradient-dusk`, `shader-mesh-gradient-sunrise` | **KEEP** | Upstream ships single-mood presets, not a day cycle that peaks at night. |
| `sunMoon` (shared day curve) | `synthwave`, `tiny-planet` | **KEEP** | Nothing upstream arcs a sun *and* a moon on a shared curve. |
| `ridge` (single silhouette, fill tracks the sky) | `parallax-depth`, `topo-lines` | **KEEP** | Upstream's are scenes with camera moves, or contour textures — not one tintable silhouette layer. |
| `commitGraph` (branch lanes, per-commit diffs) | `github-stars`, `ecosystem-constellation` | **KEEP** | Upstream's are a count-up odometer, an avatar grid or a hub-and-satellite scene. |
| `nodeTrail` (branching waypoint graph) | `path-ride`, `flow-field` | **KEEP** | No branching waypoint graph with editable labels upstream. Worth borrowing upstream's `@remotion/paths` curve maths for smoother arcs. |
| `background` (`renderMode: 'background'`, solid/linear/radial) | `backdrop` (color, gradient, **image, or any React element**), `drift` | **EXTEND** | Upstream's fill vocabulary is richer, but upstream's is a *wrapper* that owns the composition — ours must stay a `renderMode: 'background'` layer in our z-ordered compositor. |
| `candlestickChart` (OHLC, price axis, provenance badge, custom inspector, duration from series) | `animated-line-chart` (SVG `stroke-dashoffset` draw-on), `animated-bar-chart` (spring-up from baseline, deterministic stagger) | **EXTEND** | Upstream gives the *drawing techniques*; every semantic — OHLC, price→y anchoring, the no-lookahead rule, provenance, duration from the series — is ours to build. |

**Not one `REPLACE`.** No upstream component makes any of our 23 redundant. Keep all 23.

## 4. The nine planned trading components

ADR-003 lists ten first-party trading components in nine rows (`Arrow` and `TextLabel` share
one). `CandlestickChart` is built; the other **nine** are not. Upstream is a **technique
source**, not a component source: it has no OHLC, no price anchoring, no SMT, no HTF/LTF
pairing, no market-time policy, no provenance, and no duration-from-series. What it does
supply is how to *draw* each one.

| Planned component | Upstream technique to start from | What we must add |
|---|---|---|
| **HighLowLine** | `animated-line-chart` (`stroke-dashoffset` draw-on), `squiggle` / `ink-underline` (self-drawing stroke), `scribble-circle` (circle the pivot) | price→y mapping, extend-to-edge toggle, price label, chart-bound lifetime |
| **HorizontalPriceLine** | `squiggle`, `ink-underline` | price anchoring, level precision, style/width/dash params, in-out timing |
| **TrendLine** | `animated-line-chart` dashoffset draw-progress, `outline-trace` (trim path), `line-boil` | two-point (price **and** time) anchoring, endpoint handles, snapping to candle highs/lows |
| **PriceZone** | `marker-highlight` (sweep-in fill) — already vendored as `remocnMarkerHighlight` | the time×price rectangle, extend toggle, opacity, staged reveal, market anchoring |
| **LongShortPosition** | `ink-arrow` (draws with a popping head), `exploded-view` (leader lines + labels) | entry/stop/target **price** anchoring, long/short direction, R:R computation, staged reveal order |
| **Arrow** | `ink-arrow` — upstream's own caveat: *"a wobbly pen line with a personality, not a flowchart arrow"* | market-relative endpoints, a clean/straight style, duration, inspector params |
| **TextLabel** | `value-swap` (value changes in place — upstream literally says *"before/after price"*), `gradient-scale-cut-text`, `slot-machine-roll` (`$`/`%` strings), `hand-count` | price-anchored position, chart-bound lifetime, provenance of the number |
| **SMTComparison** | `animated-line-chart` (draw-on leg), `value-swap` (staged value replacement), `scribble-circle` (pivot marking) | pivot-pair references, the A↔B / A↔C staged reveal, HTF/LTF pairing, source-integrity diagnostics |
| **ChartGroup** | `chat-to-preview-layout` (two-column ratio), `infinite-bento-pan` (bento grid), `stage` (timeline-keyframe camera per panel) | HTF/LTF slots, the market-time policy, independent panel lifecycles, synced-or-frozen cursors |

Every one of the nine stays **first-party**. Upstream contributes the drawing technique; the
market semantics are the product.

## 5. What we have zero of, and should take

This is the real opportunity, and it is the inverse of the original question.

| Gap | Upstream candidates that fit a trading video | Cost |
|---|---|---|
| **Clip-to-clip transitions** — our model has no transition slot at all | `push-through` (dolly into the next scene — the natural MTF push), `focus-pull` (rack focus between HTF and LTF panels), `whip-pan` (instant HTF→LTF jump), `grain-dissolve` (recorded-desk texture), `paper-tear` (*"a price punching through the old scene"*) | `@remotion/transitions` |
| **Data-ink beats** | `value-swap` (a level replaced in place), `strikethrough-replace` (a level invalidated), `outline-fill-track-text` (*"PRICE 4 250"* emphasis) | none |
| **Annotation marks** | `ink-arrow`, `scribble-circle` (circle the confirmed pivot), `trim-burst` (a breakout tick marker) | none (brush source is copied) |
| **Backdrops with real texture** | `shader-mesh-gradient-mint` (upstream's own *"health, finance or productivity"* preset), `shader-grain-gradient`, `shader-voronoi` (liquidity-cluster texture) | `@paper-design/shaders-react` |
| **Camera punctuation** | `impact-shake` (*"a launch word, a price or a logo should land like it weighs a ton"*), `dolly-zoom` (the SMT "aha" frame), `parallax-depth` (a calm opener) | none |
| **Motion textures behind a chart** | `flow-field` (seeded particle trails), `topo-lines` (contours that rhyme with price levels) | none |
| **Direction badges** | `icon-trending-up` / `icon-trending-down`, `icon-target`, `icon-arrow-up` / `icon-arrow-down`, `icon-dollar-sign` | `@remotion/paths` |
| **Layout scaffolding** | `backdrop` (image or live-element fill), `drift` (slow push so a static chart is never frozen) | none |
| **Captions** | `caption-subtitle` (accessibility for a public video), `caption-karaoke` (read-ahead on a narrated call) | `@remotion/captions` + a transcript feature we do not have |
| **Editorial looks** | `blueprint` (a chart as an engineering drawing), `riso-print` (analyst-note), `x-ray-scan` (*"what's inside this candle"*) | none |

The 8 `graphic-looks` and 13 `motion-graphics` families also overlap our own generative
scenes — upstream's `synthwave` is strictly less capable than our `synthGrid` + `neonSun`
pair, and upstream's `isometric-build` is less capable than our `isoCity`. Keep ours.

## 6. Decision

1. **Keep all 23 of our elements.** Nothing upstream makes one redundant.
2. **Adopt upstream source as a technique base for the nine trading components**, in this
   order: `animated-line-chart` + `animated-bar-chart` (draw-on and spring-up chart
   technique) → `ink-arrow` (Arrow, LongShortPosition) → `squiggle` / `ink-underline`
   (HighLowLine, HorizontalPriceLine, TrendLine) → `scribble-circle` (pivot marking) →
   `marker-highlight` (PriceZone fill — already vendored) → `value-swap` /
   `gradient-scale-cut-text` (TextLabel) → `chat-to-preview-layout` (ChartGroup).
3. **Add upstream as new motion elements**, not as replacements. Next candidates:
   `cursor` / `simulated-cursor`, `backdrop`, `drift`, `impact-shake`, `flow-field`.
4. **Every adopted component keeps our contract**: a hand-written registry definition with
   `type`, `label`, `icon`, `description`, `category`, `defaults`, `params`, `render`, plus
   `provenance` pointing at the upstream registry item, plus `bounds`, `propsVersion` and
   `defaultDuration`. The upstream file is copied in verbatim, adapted, and kept next to the
   adapted copy as the diff baseline — the pattern in `src/motion-components/`.
5. **Open a transition slot before mining transitions.** `@remotion/transitions` components
   are `presentation()` wrappers that own a scene boundary; our model has no place to put
   one. This is a design task, not an import.

## 7. The traps

- **The composition-length gotcha.** Upstream components that read
  `useVideoConfig().durationInFrames` compute their reveal against the *composition* length.
  Inside our per-clip `<Sequence>` that is wrong. Our three vendored components sidestep it
  by reading only `fps`; any new adoption must do the same.
- **`speed` is the only retiming lever.** Upstream components have no duration prop. A
  90-frame upstream animation inside a 4-second clip leaves the last 3 seconds empty
  unless we set `defaultDuration` to match and let the component hold. Upstream's own
  router text says the length is "a floor for the `Sequence`, not the whole beat: add hold
  time on top".
- **Captions need a feature we do not have.** All 31 caption components are
  transcript-driven (`captions: Caption[]` + `@remotion/caption-core`). Adopting one means
  building a transcript timeline first.
- **Shaders are WebGL.** 19 base shaders pull `@paper-design/shaders-react`; 40 presets
  inherit it. That is a real bundle and render cost, and it is the one dependency family
  that would change the export path.
- **Generic motion is not market semantics.** Upstream's finance-flavoured items
  (`fomo-limit-orders`, `number-wheel`, `icon-dollar-sign`, `slot-machine-roll`) are a
  product-demo vocabulary. Grepping the whole snapshot for the market terms
  `candlestick`, `ohlc`, `smt`, `divergence`, `liquidity` and `pivot` returns **zero hits**;
  `support` and `resistance` appear only in non-market senses ("support detection" in the
  WebGL2 shader docs, and generic English). That absence is the reason our trading
  components are first-party.
- **Remotion Studio is not a dependency.** Upstream documents an "Add to Studio" button for
  Remotion Studio ≥ 4.0.502, where elements arrive with editable controls in a sidebar. We
  deliberately do not depend on Remotion's Editor Starter/Timeline (ADR-001), so that flow is
  a reference for what an inspector should expose — not something we can lean on.
