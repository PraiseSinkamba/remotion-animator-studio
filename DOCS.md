# Chart Studio — Documentation

Chart Studio is a trading video studio: a visual, drag-and-drop editor built on [Remotion](https://remotion.dev) for making videos about market structure, multi-timeframe breakdowns and smart-money-concept divergence. What you compose in the browser is a real Remotion composition — the same code renders your live preview and your final MP4, so output always matches the preview.

---

## 1. Getting started

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts **two** processes:

| Process | Port | Purpose |
| --- | --- | --- |
| Vite (editor) | 5173 | The editor UI at http://localhost:5173 |
| Render server | 3333 | Powers the in-app **Export MP4** button |

---

## 2. The editor at a glance

```
┌────────────────────── Top bar: play · size/fps · undo · save/open · export ─┐
│ Presets  │                                              │ Inspector         │
│ Elements │              Live preview canvas             │ (parameters of    │
│ Effects  │           (Remotion <Player>)                │  selected clip)   │
├──────────┴──────────────────────────────────────────────┴───────────────────┤
│ Timeline: tracks · clips · ruler · playhead · zoom                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Tracks are layers**: the top track renders on top. `+ Track` adds one.
- **Clips** live on tracks. A clip is one element (text, video, shape…) plus a stack of effects.
- Everything is parameterized and editable in the **Inspector** — sliders, color pickers, dropdowns.

## 3. Elements

The catalogue is split into three families: **Base** (22), **Trading** (1) and **Motion** (3) — 26 components in total. The group a component belongs to is its `category` in the registry (`base`, `trading` or `motion`), and the library panel groups the components by it.

### Base (22)

| Element | What it is | Key parameters |
| --- | --- | --- |
| 🅣 Text | A text layer | text, font, size, weight, color, letter-spacing |
| 🔢 Counter | Number that counts A→B over the clip | from, to, decimals, prefix/suffix |
| ⬛ Shape | rect, circle, ellipse, triangle, star, polygon, pie (SVG via `@remotion/shapes`) | kind, size, fill, points, pie progress |
| 🖼️ Image | Image from URL | src, size, fit, corner radius |
| 🎥 Video | Video from URL (`OffthreadVideo`) | src, volume, speed, trim start, muted |
| 🎵 Audio | Music/SFX from URL | src, volume, speed, trim start |
| 🎞️ GIF | Animated GIF synced to the timeline (`@remotion/gif`) | src, size, fit |
| 🌊 Wave | Layered animated sine waves | amplitude, wavelength, speed, layers, color |
| 🫧 Blob | Organic morphing blob (noise-driven) — stack for fluid/splat looks | size, wobble, morph speed, points, seed |
| 🎊 Particles | Confetti, snow, rain, sparkles, bubbles, embers — deterministic, so preview and render match | type, count, area, size, speed, drift, colors, seed |
| 🧩 HTML | **Any HTML + inline CSS** — chat mockups, app windows, buttons (HyperFrames-style compositions) | html, size, content scale |
| 🛣️ Synth Grid | Endless-outrun perspective floor, scrolls forever | line color, cell size, drive speed, glow |
| 🌅 Neon Sun | Striped retro sun with glow | colors, stripes, glow |
| 🏙️ Iso City | Generative isometric city that grows building-by-building from a blueprint | grid, tile size, palette, stagger, seed |
| 🌗 Day/Night Sky | Morphing sky gradient + stars — one full day per clip | size, stars, seed |
| 🌞 Sun & Moon | Sun/moon arcing on the same day-cycle timing (pairs with the sky) | size, colors |
| ⛰️ Ridge | One seeded mountain silhouette; fill blends day→night over the clip — stack several, delete, recolor | peaks, amplitude, day/night colors, seed |
| 🌿 Commit Graph | Animated git history: branch lanes, glowing nodes, typing messages, ± counters | commits JSON, speed, spacing, lane colors |
| 📍 Story Trail | Glowing waypoint route — nodes pop one by one. Waypoints are JSON: `[{"x","y","label?","color?","from?"}…]` — `color` tints the node and its incoming segment, and `from` **branches** off any earlier node by index (`{"label":"Pivot","from":2}`). **Draw the route on the canvas** (✏️ button) and your labels/colors are preserved | waypoints JSON, default colors, speed, curved |
| 🖱️ Cursor | Mouse pointer for UI-demo storytelling — pair with Motion Path + Click Pulse | size, fill |
| 😀 Emoji | Big emoji sticker | char, size |
| 🎨 Background | Full-frame solid/linear/radial fill | colors, angle |

### Trading (1)

| Element | What it is | Key parameters |
| --- | --- | --- |
| 🕯 Candlestick Chart | OHLC chart with a price axis, a provenance badge and its own inspector — the clip length comes from the series it holds | the series, the reveal mode, the frame rate, the chart's position |

### Motion (3)

These three are MIT-licensed Remocn source copied into this repository and adapted — the provenance record (upstream source, licence, retrieval date and every local change) is in `packages/components/src/motion/PROVENANCE.md`.

| Element | What it is | Key parameters |
| --- | --- | --- |
| 🖍 Marker Highlight | A sweep-in highlight fill behind a phrase | text, colours, size, speed |
| 🌫 Soft Blur In | Per-character fade-in with a gentle blur | text, blur, size, colour, speed |
| ⌨️ Typewriter | Characters appearing one by one | text, caret, speed, size, colour |

**Transparent assets**: background-removed PNGs and SVGs keep their transparency — paste a URL into an Image clip, or use **📁 Upload file…** in the Inspector to embed a local image/GIF directly in the project (kept under 8 MB; bigger files should be hosted and linked by URL). To *remove* a background, do it before importing (e.g. remove.bg, Photoshop) — the editor composites transparency, it doesn't do AI matting.

Add them by **dragging onto a timeline track** (drop position sets the start frame) or **double-clicking** (adds at the playhead on the first track). With a clip selected, **drag on the canvas** to reposition it.

## 4. Effects

Drag an effect from the library **onto a clip**, or double-click it to apply to the selected clip. Effects stack — order doesn't matter, they compose. Every parameter is editable in the Inspector.

The library groups effects into **Text · Enter · Exit · Loops & Motion · Style & Color** (and the 🔎 search filters across all of them):

**Text**: Typewriter, Letter Pop
**Enter**: Fade In, Slide In, Zoom In, Spring Pop, Spin In, Wipe In, Blur In, Bounce Drop, Flip In (3D)
**Exit**: Fade Out, Slide Out, Zoom Out, Wipe Out, Flip Out (3D)
**Loops & Motion**: Rotate, Pulse, Wiggle, Camera Shake (noise-driven), Light Sweep, Strobe, Flicker, Float, **Liquid Wave** (letters ripple on a sine wave — give it an *Audio URL* and the bass drives the amplitude via `@remotion/media-utils`)
**Style & Color**: Ken Burns, Drift (tickers/clouds), Glow, Drop Shadow, RGB Split (chromatic aberration), Glitch, Color Adjust (brightness/contrast/saturation/hue/sepia), Click Pulse (press-down dip at a chosen frame), **Transform**, **Motion Path**

### The 🧩 HTML element (in depth)

Any HTML + inline CSS becomes an animatable clip: chat windows, app mockups, buttons, cards. Rules of thumb:

- The clip is a **Width × Height box** centered at X/Y; make your root element `width:100%;height:100%`. *Content scale* zooms without reflow. Content outside the box is clipped.
- **Inline styles only** — `<style>` tags apply globally and can collide between clips.
- **No JavaScript executes**, and CSS animations won't survive rendering (frames are captured out of real time) — animate with the editor's effects instead.
- System fonts are safe; webfonts by URL aren't wired up yet.
- The **✨ Format HTML** button in the Inspector pretty-prints the markup.
- Fake interactions: HTML mockup + 🖱️ Cursor on a Motion Path + 👆 Click Pulse on both at the click frame.

The hosted docs page (`apps/studio/public/docs/index.html`, `/docs/` on the dev server) has copy-paste starter snippets.

### HyperFrames-style launch videos

The 🧩 HTML element makes the editor capable of [HyperFrames](https://github.com/heygen-com/hyperframes-launches)-style product videos: build UI mockups as HTML clips, animate a 🖱️ Cursor along a Motion Path with Click Pulse, cut between scenes with clips on the timeline, and finish with texture-masked type (Text → *Texture image URL*). A full worked example lives at `examples/hyperframe-style-launch.json` (generated by `examples/gen-hyperframe-demo.mjs`) — open it via 📂 Open, or render it: `pnpm render -- examples/hyperframe-style-launch.json out/launch.mp4`.

### Transform (keyframe-style animation)

The **Transform** effect animates position, scale, rotation and opacity from A to B over any frame range inside the clip, with a chosen curve. Stack several Transforms for multi-step choreography (move right → pause → drop down): give each a different *Start at* frame.

### Motion Path

The **Motion Path** effect moves the element along **any SVG path** over the clip's duration (powered by `@remotion/paths`).

**Draw it**: click *✏️ Draw path on canvas* in the effect's Inspector card, click points directly on the preview (the green dot marks the start), then press `Enter` or double-click to finish. The element jumps to your first point and follows the polyline. `Esc` cancels.

**Or type it**: paste a path like:

```
M 0 0 C 150 -250 450 -250 600 0        (arc / rainbow hop)
M 0 0 L 400 0 L 400 300 L 0 300 Z      (rectangle circuit)
M 0 0 Q 200 -150 400 0 T 800 0         (smooth s-curve)
```

Coordinates are relative to the element's position. Turn on *Rotate to follow path* to orient the element along its direction of travel (planes, arrows, fish…).

### Animation curves (easing)

Every movement effect (Slide, Zoom, Wipe, Transform, Motion Path) has a **Curve** parameter with a live preview graph in the Inspector:

- `easeOut` / `easeIn` / `easeInOut` / `linear` — the classics
- `bounceOut` — lands and bounces like a ball
- `elastic` — springy rubber-band settle
- `overshoot` — goes past the target, then eases back

For a bouncing ball, use the one-click **Bounce Drop** effect — or animate Y with **Transform** and curve `bounceOut`. For pop-ins with life: Spring Pop (physical spring) or any entrance with `elastic`/`overshoot`.

### Hosted docs

A static, hostable docs site with GIF demos lives in `apps/studio/public/docs/` — served at `http://localhost:5173/docs/index.html` during development, deployable to any static host, and included in `pnpm build` output. Regenerate the GIFs (rendered by the app's own pipeline) with `pnpm docs:gifs`.

Notes:
- **Glitch** + **RGB Split** + **Camera Shake** together = the classic cyberpunk look (see the Glitch Title preset).
- **Ken Burns** spans the whole clip: set zoom from/to and pan, done — no keyframing.
- **Drift** moves linearly across the whole clip — use for news tickers or floating clouds.
- **Camera Shake** uses `@remotion/noise` for organic, deterministic motion (renders identically every time).

## 5. Presets

Presets now insert **one track per clip** (top layer first), so every piece is immediately visible and editable in its own lane.

Double-click (or drag onto the timeline) to insert a fully-built animation on a new track, positioned at the playhead and scaled to your canvas:

- **Title Intro** — spring-pop title + typewriter subtitle
- **Lower Third** — broadcast-style name/role, wipes and slides
- **Glitch Title** — glitch + RGB split + shake
- **Ken Burns Photo** — cinematic photo zoom/pan
- **Social Pop** — emoji burst + follow CTA
- **Stat Counter** — animated glowing number + label
- **News Ticker** — scrolling headline bar
- **Quote Card** — typewriter quote + author reveal
- **End Card** — letter-pop thanks + pulsing subscribe button

After inserting, every piece is just normal clips — tweak text, colors, timing in the Inspector.

## 6. Saving & opening

- **Autosave**: every change is saved to a local SQLite database in your browser's OPFS storage, and restored when you reopen the editor. A localStorage backend and an in-memory backend are the fallbacks when the browser cannot host the SQLite one. The editor shows which backend is in use, and it will not let the page go away with unsaved work — it flushes the pending save first and asks before leaving if anything is still unsaved.
- **💾 Save / Save As… / 📂 Open**: in Chrome-family browsers, Open remembers the file and **Save overwrites it in place**; *Save As…* picks a new file. (Browsers without the File System Access API fall back to downloading a JSON.)
- **Changing the canvas size rescales your content**: picking a Size preset (or committing new W×H values) scales every clip's position and size proportionally — 1080p → 4K keeps the layout identical at the new resolution.
- **✚ New** starts a blank project (your previous state stays in undo history).
- **Undo/redo**: ⌘Z / ⇧⌘Z, up to 100 steps.

## 7. Rendering & export

### Stills

**📷 Still** in the top bar renders the current frame as a PNG through the same pipeline and downloads it — great for thumbnails and posters.

### In-app (recommended)

Click **⬇ Export MP4**. The render server bundles the composition (first render only, ~20 s), renders with Remotion's renderer (headless Chrome + FFmpeg, downloaded automatically on first use), shows progress, and gives you a download. Files are also written to `out/`.

- **Resolution**: whatever the project Size is, times the export scale (0.5× draft / 1× / 2×).
- **Up to 4K60**: pick *4K UHD 3840×2160* (or type custom dimensions) and *60* FPS in the top bar. 4K DCI, vertical 4K, square, 4:5, ultrawide presets included.
- Codec is H.264 MP4.

### CLI

```bash
pnpm render                      # renders ./project.json → out/animation.mp4
pnpm render -- path/to/p.json out/custom.mp4
```

Save a project JSON from the editor first.

> The render server bundles `packages/video/remotion/` once per run — if you edit the composition **code**, restart `pnpm dev`. Project changes don't need a restart.

## 8. Selection, copy & paste, layout

- **Multi-select**: ⌘/Ctrl/Shift-click clips in the timeline to add or remove them from the selection. Dragging any selected clip moves the whole group; effects double-clicked in the library apply to every selected clip.
- **Groups**: with several clips selected, `⌘G` (or the Inspector button) links them — clicking any member selects the whole group, so they move as one. `⇧⌘G` ungroups. Grouped clips show a ⛓ badge. (Trimming stays per-clip.)
- **Tracks are yours to arrange**: rename a track by typing in its header, reorder layers with the ▲▼ buttons, and drag a clip **up or down** — on release it lands on the track under the cursor (Shift-click a lane still works too).
- **Copy / paste**: `⌘C` copies the selection, `⌘V` pastes it at the playhead (relative timing preserved, same tracks). `⌘D` duplicates in place, right after each original.
- **Resizable panes**: drag the dividers between the library, preview, inspector, and timeline. Sizes are remembered.
- The timeline **ruler stays pinned** while you scroll through many tracks, and track headers stay aligned.

## 9. Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| 🔊/🔇 (top bar) | Mute the preview — if playback ever refuses to start (strict autoplay environments), mute and it will run |
| `Delete` / `Backspace` | Remove selected clip(s) |
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌘C` / `⌘V` | Copy / paste selection at playhead |
| `⌘D` | Duplicate selection |
| `Esc` | Clear selection |
| ⌘/Ctrl-click a clip | Add/remove it from the selection |
| Shift-click a lane | Move selected clip to that track |

## 10. Architecture (for developers)

| Path | Purpose |
| --- | --- |
| `packages/core/src/` | The project schemas, the component contract, the registration mechanism, the candle maths — pure TypeScript |
| `packages/components/src/base/` | The 22 base element definitions and their render adapters |
| `packages/components/src/trading/` | The candlestick chart and its inspector |
| `packages/components/src/motion/` | The adapted Remocn components, their definitions and the provenance record |
| `packages/components/src/registry.ts` | The aggregator: importing it registers every component |
| `packages/components/src/project-migrate.ts` | Validates a stored project against the component catalogue |
| `packages/ui/src/` | The shadcn primitives, the inspector and library pieces |
| `packages/editor/src/` | The store, the timeline pieces, the local database |
| `packages/video/src/` | The Remotion composition; `packages/video/remotion/` is the server-render entry point |
| `packages/video/tools/` | The render server and the CLI render script |
| `apps/studio/src/` | The editor shell — the panels, the presets, the theme |
| `vendor/remocn/` | The verbatim upstream Remocn source, kept as the licence and provenance record; never bundled |

### Extending

**New element**: write a definition that calls `registerComponent` — a stable `type`, a `label`, an `icon`, a `description`, a `category`, `defaults`, `params`, a `render` adapter, `bounds`, `propsVersion` and `defaultDuration` — then import that module in `packages/components/src/registry.ts` so it registers itself. The registry lives in `packages/core/src/registry.ts`.

**New effect**: add to `EffectType` in `packages/core/src/schemas.ts` → register in `EFFECTS` (`packages/components/src/base/effects.ts`) → implement in `computeEffectStyle` (or the renderers for text/overlay effects).

**New preset**: add an entry to `PRESETS` (`packages/editor/src/presets.ts`) — it's just a function from canvas size to clip specs.

Whatever you register appears in the library and Inspector automatically.

### Remotion feature coverage

A note on "effects": Remotion itself ships almost no ready-made effects — it's a programmatic framework (React + `interpolate`/`spring`/`Easing` + a few media components). Every effect in this editor is built *on* those primitives. What Remotion provides and we use: `<Player>`, `Sequence`, `spring`, `interpolate`/`Easing` (incl. bounce/elastic/back curves), `Img`, `OffthreadVideo`, `Audio`, `@remotion/gif`, `@remotion/shapes`, `@remotion/noise`, `@remotion/paths` (motion paths), `@remotion/media-utils` (audio visualisation — the Liquid Wave effect analyses the track with `useAudioData`/`visualizeAudio` and lets the bass drive the amplitude), `calculateMetadata`, and server-side rendering with `@remotion/bundler` + `@remotion/renderer`.

Remotion packages **not yet** integrated, and what they'd add:

- `@remotion/transitions` — real cross-clip transitions (slide/wipe/flip between scenes); the object model has no transition slot yet, so there is nowhere to mount one
- `@remotion/three` — **3D**: embeds React Three Fiber scenes (`<ThreeCanvas>`), so GLB/GLTF models, 3D text, and camera moves render frame-perfectly. The path to support: add a "3D Model" element that loads a GLB URL with `useGLTF` and exposes camera/rotation/lighting params.
- `@remotion/lottie` — play After Effects/Lottie JSON animations
- `@remotion/skia` — advanced 2D drawing (real blurs, shaders, masks)
- `@remotion/google-fonts` — hundreds of typefaces
- Remotion Lambda — cloud rendering at scale
