# Components
URL: https://remocn.dev/docs/components

Every component in remocn, grouped by category

A complete index of every component in remocn. Browse by category or jump straight to the one you need.

## Layout

Scene scaffolding — backgrounds and camera wrappers.

- [Backdrop](https://remocn.dev/docs/layout/backdrop) — Full-frame fill with an optional rounded, shadowed content frame for any scene
- [Drift](https://remocn.dev/docs/layout/drift) — Wrap any scene in a slow camera push-in so no frame is ever static

## Typography

Text effects, reveals, and kinetic type.

### Reveals

- [SoftBlurIn](https://remocn.dev/docs/typography/soft-blur-in) — Per-character fade-in with a gentle blur and upward motion
- [PerCharacterRise](https://remocn.dev/docs/typography/per-character-rise) — Letters slide up from below with no blur — crisp and kinetic
- [BottomUpLetters](https://remocn.dev/docs/typography/bottom-up-letters) — Letters rise from below in a pronounced staircase, one symbol at a time
- [TopDownLetters](https://remocn.dev/docs/typography/top-down-letters) — Letters descend from above in a pronounced staircase, one symbol at a time
- [Handwrite](https://remocn.dev/docs/typography/handwrite) — Letters laid down one pose at a time, each with its own slant and baseline wobble
- [SpringScaleIn](https://remocn.dev/docs/typography/spring-scale-in) — Words pop in with a soft overshoot scale, like a spring settling
- [MicroScaleFade](https://remocn.dev/docs/typography/micro-scale-fade) — A calm, tiny scale pop for subtle premium polish
- [ScaleDownFade](https://remocn.dev/docs/typography/scale-down-fade) — Subtle premium settle-in with a restrained scale-down fade on exit
- [BlurOutUp](https://remocn.dev/docs/typography/blur-out-up) — Words arrive clean and depart upward with increasing blur
- [FocusBlurResolve](https://remocn.dev/docs/typography/focus-blur-resolve) — A premium focus pull from heavy blur to crisp text, then a soft blur-out exit
- [LineByLineSlide](https://remocn.dev/docs/typography/line-by-line-slide) — Each line slides in from the left with a staggered flow
- [StaggeredFadeUp](https://remocn.dev/docs/typography/staggered-fade-up) — Words rise from below with a soft cascading delay
- [MaskRevealUp](https://remocn.dev/docs/typography/mask-reveal-up) — Lines reveal upward with a soft masked feel and compact stagger
- [TrackingIn](https://remocn.dev/docs/typography/tracking-in) — Letter-spacing collapses from wide to normal with a spring snap

### Highlights

- [InlineHighlight](https://remocn.dev/docs/typography/inline-highlight) — Animates one word inside a sentence from a base color to a brand color
- [MarkerHighlight](https://remocn.dev/docs/typography/marker-highlight) — Marker bar sweeps in behind a phrase, optionally inverting the text color
- [InkUnderline](https://remocn.dev/docs/typography/ink-underline) — A hand-dragged ink stroke that draws itself across in a few stop-motion poses
- [ShimmerSweep](https://remocn.dev/docs/typography/shimmer-sweep) — Bright gradient sweeps across dim text, lighting it up

### Dynamic Text

- [Typewriter](https://remocn.dev/docs/typography/typewriter) — Character-by-character text reveal with a deterministic blinking cursor
- [HandCount](https://remocn.dev/docs/typography/hand-count) — A number that counts up in stop-motion poses, rewritten by hand at every pose
- [SlotMachineRoll](https://remocn.dev/docs/typography/slot-machine-roll) — Numbers and characters roll into place like a casino reel
- [RolodexFlip](https://remocn.dev/docs/typography/rolodex-flip) — Cycle a word through a list of values with a 3D rolodex card flip
- [ValueSwap](https://remocn.dev/docs/typography/value-swap) — Swap a value in place with a vertical slide so the layout never shifts

### Hero & Display

- [InfiniteMarquee](https://remocn.dev/docs/typography/infinite-marquee) — Endlessly scrolling horizontal text band
- [PerspectiveMarquee](https://remocn.dev/docs/typography/perspective-marquee) — Marquee tilted into 3D space with depth fade

### Tech & Glitch

- [MatrixDecode](https://remocn.dev/docs/typography/matrix-decode) — Random characters scramble and resolve into the target string
- [RGBGlitchText](https://remocn.dev/docs/typography/rgb-glitch-text) — Three-channel RGB split with a brief horizontal jitter

### Text Transitions

- [PerWordCrossfade](https://remocn.dev/docs/typography/per-word-crossfade) — One phrase fades out as the next fades in, word by word
- [FadeThrough](https://remocn.dev/docs/typography/fade-through) — Old text fades out as new fades in, Material-style
- [SharedAxisY](https://remocn.dev/docs/typography/shared-axis-y) — Per-word hard-cut staircase for sharp editorial swaps
- [SharedAxisZ](https://remocn.dev/docs/typography/shared-axis-z) — Scale-based depth transition for focus shifts

### Kinetic

- [ShortSlideRight](https://remocn.dev/docs/typography/short-slide-right) — The whole phrase glides in from the left while words reveal in sequence
- [KineticCenterBuild](https://remocn.dev/docs/typography/kinetic-center-build) — Words enter from the right and push the line until the phrase locks centered
- [ShortSlideDown](https://remocn.dev/docs/typography/short-slide-down) — Words drop in from above and stack into a centered composition

## UI Blocks

Pre-assembled interface elements: code editors, layouts, charts, and workflow visualizations.

### Code & CLI

- [GlassCodeBlock](https://remocn.dev/docs/ui-blocks/glass-code-block) — Premium frosted-glass code window with rim light and traffic-light controls
- [TerminalSimulator](https://remocn.dev/docs/ui-blocks/terminal-simulator) — CLI build simulation with chunked log output and step-function scrolling
- [TerminalCursorZoom](https://remocn.dev/docs/ui-blocks/terminal-cursor-zoom) — Camera rides the typing cursor, dollying across a terminal as a command types at high zoom

### Data & System

- [AnimatedLineChart](https://remocn.dev/docs/ui-blocks/animated-line-chart) — SVG line chart drawn left-to-right via stroke-dashoffset
- [AnimatedBarChart](https://remocn.dev/docs/ui-blocks/animated-bar-chart) — Bars spring up from the baseline with deterministic stagger

### Paper & Scrapbook

- [CheckList](https://remocn.dev/docs/ui-blocks/check-list) — A handwritten checklist that writes itself out, then ticks and strikes through every done item
- [PaperSticker](https://remocn.dev/docs/ui-blocks/paper-sticker) — A taped paper chip that slaps onto the scene over two stop-motion poses
- [Polaroid](https://remocn.dev/docs/ui-blocks/polaroid) — An instant-photo frame with a handwritten caption for video, images, or live compositions
- [Reel](https://remocn.dev/docs/ui-blocks/reel) — A fixed centered card where images stack on the z-axis and each blooms open over the last

## Transitions

Scene transitions, camera moves, and stylized wipes.

### Camera Motion

- [WhipPan](https://remocn.dev/docs/transitions/whip-pan) — Whip the camera sideways with motion blur so both scenes fly through in one move
- [PushThrough](https://remocn.dev/docs/transitions/push-through) — Dolly through the outgoing scene while the next one approaches from the depth
- [FocusPull](https://remocn.dev/docs/transitions/focus-pull) — Rack focus from one scene to the next through a soft defocus breath
- [ZoomBlur](https://remocn.dev/docs/transitions/zoom-blur) — Push the outgoing scene through the viewer while the incoming one resolves out of blur
- [PageTurn](https://remocn.dev/docs/transitions/page-turn) — The exiting scene swings up and away like a notebook page in stop-motion poses

### Shader

- [SwirlDissolve](https://remocn.dev/docs/transitions/swirl-dissolve) — Unwind a swirl shader open and wind it shut to reveal the next scene
- [DitherDissolve](https://remocn.dev/docs/transitions/dither-dissolve) — Dissolve one scene into the next through a drifting field of dither pixels
- [PerlinDissolve](https://remocn.dev/docs/transitions/perlin-dissolve) — Sweep a perlin-noise threshold across the frame to dissolve into the next scene
- [SmokeDissolve](https://remocn.dev/docs/transitions/smoke-dissolve) — Expand a smoke ring outward across the frame to reveal the next scene
- [GrainDissolve](https://remocn.dev/docs/transitions/grain-dissolve) — Disintegrate the outgoing scene into soft grainy shapes and condense the next out of the noise
- [WaveWipe](https://remocn.dev/docs/transitions/wave-wipe) — Sweep a grainy wave up across the frame and reveal the next scene from below
- [RippleZoom](https://remocn.dev/docs/transitions/ripple-zoom) — Fly the camera through the center of grainy ripple rings while the next scene approaches from the depth
- [WarpDissolve](https://remocn.dev/docs/transitions/warp-dissolve) — Melt the outgoing scene into a folding domain-warp field that straightens into the next

### Stylized

- [AsciiDissolve](https://remocn.dev/docs/transitions/ascii-dissolve) — Dissolve one scene into the next through a drifting field of ASCII glyphs
- [CaretWipe](https://remocn.dev/docs/transitions/caret-wipe) — Sweep a typing caret across the frame, wiping the outgoing scene into the next
- [IconScatter](https://remocn.dev/docs/transitions/icon-scatter) — Scatter a field of icons over the cut, hiding the scene swap at the field's peak
- [GlitchCut](https://remocn.dev/docs/transitions/glitch-cut) — Tear a hard cut into displaced slices with channel split and corrupted blocks
- [EmberBurn](https://remocn.dev/docs/transitions/ember-burn) — Set the outgoing frame on fire so it boils, chars, and blows away as sparks that carry its own colour
- [ParticleDissolve](https://remocn.dev/docs/transitions/particle-dissolve) — Grind the frame into drifting grey dust and let the next scene coalesce back out of it
- [GridWave](https://remocn.dev/docs/transitions/grid-wave) — Send a wave across the frame that raises the picture into solid blocks and sets them down carrying the next scene
- [Displacement](https://remocn.dev/docs/transitions/displacement) — Shear the frame into a grid of offset colour-fringed tiles and settle them back on the next scene

### Graphic Cuts

Bold, showy cuts built from plain CSS and SVG: shapes, slats, torn paper, streaks and light. No dependencies beyond Remotion.

- [IrisWipe](https://remocn.dev/docs/transitions/iris-wipe) — Close a cartoon iris on the subject, hold it as a dot, then open it on the next scene
- [VenetianBlinds](https://remocn.dev/docs/transitions/venetian-blinds) — Turn the outgoing scene edge-on in staggered horizontal slats to reveal the next one
- [PaperTear](https://remocn.dev/docs/transitions/paper-tear) — Rip the frame down the middle and fling both torn halves apart on impact
- [PixelSort](https://remocn.dev/docs/transitions/pixel-sort) — Melt the scene into glowing vertical streaks and drop the next one in column by column
- [LightLeak](https://remocn.dev/docs/transitions/light-leak) — Drift a warm analog light leak across the frame and hard-cut under its blow-out
- [Hyperspace](https://remocn.dev/docs/transitions/hyperspace) — Stretch a starfield into streaks, tunnel forward and land on the next scene through a flash

### Scene Sequencers

Sequencers rather than presentations — they own the whole run of scenes and the boundary between them.

- [SlideSwapScenes](https://remocn.dev/docs/transitions/slide-swap) — Shove one scene off the canvas and spring the next in from the opposite edge
- [SpringSettleScenes](https://remocn.dev/docs/transitions/spring-settle) — Shrink a scene away as one group, hold the stage empty for a beat, then land the next from above

## Effects

Physical overlays and hand-made motion.

- [PaperWobble](https://remocn.dev/docs/effects/paper-wobble) — Per-pose reshoot jitter that makes any content feel hand-placed on a desk
- [InkArrow](https://remocn.dev/docs/effects/ink-arrow) — A hand-drawn arrow that draws itself from one point to another, head popping on the final pose
- [ScribbleCircle](https://remocn.dev/docs/effects/scribble-circle) — A brush circle that sweeps itself around a region of the frame, opening thin and closing thick
- [CrumpleToss](https://remocn.dev/docs/effects/crumple-toss) — Crushes an element into a ball of paper and throws it out of frame
- [Confetti](https://remocn.dev/docs/effects/confetti) — A one-shot burst of paper confetti for milestone and celebration beats

## Logo Stings

Short brand reveals that land your logo at the open or close of a video.

- [Orbit Lock](https://remocn.dev/docs/logo-stings/orbit-lock) — Moons ride tilted, shrinking orbits into a core that bursts into a ring flash, and the logo springs into place
- [Puzzle Snap](https://remocn.dev/docs/logo-stings/puzzle-snap) — Geometric pieces spin in from scattered positions and snap into a mark with sparks, then the wordmark slides out beside it
- [Spotlight](https://remocn.dev/docs/logo-stings/spotlight) — A soft stage spotlight searches the dark, overshoots, lands on the logo, and the house lights come up
- [Neon Sign](https://remocn.dev/docs/logo-stings/neon-sign) — A glass neon tube stutters alive segment by segment, buzzes off once, then holds lit with a glow on the wall
- [Inflate](https://remocn.dev/docs/logo-stings/inflate) — A flat sliver puffs up like a balloon toy, squashes and settles into a glossy mark, then the wordmark slides out
- [Liquid Fill](https://remocn.dev/docs/logo-stings/liquid-fill) — A drop falls into an outlined mark and liquid rises with a sloshing surface and bubbles until the mark is solid
- [Accordion Unfold](https://remocn.dev/docs/logo-stings/accordion-unfold) — A tight paper zigzag unfolds sideways into a flat card with the logo printed across it
- [Anamorphic Flare](https://remocn.dev/docs/logo-stings/anamorphic-flare) — A point of light stretches into a cinematic horizontal streak that sweeps the frame and reveals the logo behind it

## Camera & Physics

Camera moves and simulated physics that give a scene depth and weight.

### Camera

- [Parallax Depth](https://remocn.dev/docs/camera/parallax-depth) — A layered landscape trucks sideways with a gentle push-in, near layers sliding faster than far ones
- [Dolly Zoom](https://remocn.dev/docs/camera/dolly-zoom) — The vertigo shot: a corridor stretches while the subject in the middle keeps its exact size
- [Turntable](https://remocn.dev/docs/camera/turntable) — A product card with real thickness spins through front, edge and back with face shading and a floor shadow
- [Tiny Planet](https://remocn.dev/docs/camera/tiny-planet) — A flat skyline bends into a tiny planet, then keeps turning beside the sun
- [Exploded View](https://remocn.dev/docs/camera/exploded-view) — An isometric stack of slabs springs apart with leader lines and labels, then clicks back together

### Physics

- [Gravity Pile](https://remocn.dev/docs/camera/gravity-pile) — Seeded shapes rain down, bounce off the floor and each other, and settle into a heap
- [Cloth Reveal](https://remocn.dev/docs/camera/cloth-reveal) — A simulated satin sheet is yanked off your content from one corner, folding and fluttering out of frame
- [Impact Shake](https://remocn.dev/docs/camera/impact-shake) — Heavy content slams down with a squash, a damped camera jolt, a two-frame RGB split and a dust kick

## Graphic Looks

Stylized treatments that restyle a subject as print, film, or a technical drawing.

- [Riso Print](https://remocn.dev/docs/graphic-looks/riso-print) — Two ink plates print the subject; the accent plate slides in off-register, wobbles and settles a hair out of alignment over grainy paper
- [Line Boil](https://remocn.dev/docs/graphic-looks/line-boil) — A hand-drawn outline draws itself, boils on threes like a cel animation, and fills with color while it keeps boiling
- [Blueprint](https://remocn.dev/docs/graphic-looks/blueprint) — A product wipes into a technical drawing with a grid, white linework, dimension lines and a red callout
- [Duotone Beat](https://remocn.dev/docs/graphic-looks/duotone-beat) — A halftone portrait in two inks that swaps its ink pair on every beat and punches in on the downbeat
- [Comic Panels](https://remocn.dev/docs/graphic-looks/comic-panels) — The frame cracks into a three-panel comic page, then the action panel bursts into a full-frame POW
- [Long Shadow](https://remocn.dev/docs/graphic-looks/long-shadow) — A flat icon pops in and casts a long shadow to the frame edge, then the light swings and the shadow sweeps around
- [Synthwave](https://remocn.dev/docs/graphic-looks/synthwave) — A retro neon horizon with a scrolling perspective grid, a rising striped sun and mountain ranges that slide in
- [Brick Mosaic](https://remocn.dev/docs/graphic-looks/brick-mosaic) — Toy bricks drop in row by row from the bottom with a small bounce and build a pixel-art image on a baseplate
- [X-Ray Scan](https://remocn.dev/docs/graphic-looks/x-ray-scan) — A glowing bar sweeps across a device and reveals its white-line internals, with one part marked in red

## Generative Loops

Seeded, deterministic pattern beds for backgrounds and section breaks.

- [Pendulum Wave](https://remocn.dev/docs/motion-graphics/pendulum-wave) — A row of pendulums with tuned periods drifts from a line into waves and braids, then realigns as a seamless loop
- [Flow Field](https://remocn.dev/docs/motion-graphics/flow-field) — Hundreds of particles ride a seeded vector field and leave fine fading trails, as a seamless loop
- [Isometric Build](https://remocn.dev/docs/motion-graphics/isometric-build) — An isometric grid springs up row by row into a stepped block sculpture with one accent tower
- [Life Grid](https://remocn.dev/docs/motion-graphics/life-grid) — Conway's Game of Life on a seeded grid, newborn cells flashing in the accent
- [String Art](https://remocn.dev/docs/motion-graphics/string-art) — Threads string a ring of pins as a times table, then morph from a cardioid through a nephroid and beyond
- [Topo Lines](https://remocn.dev/docs/motion-graphics/topo-lines) — Contour lines around seeded peaks breathe and drift, one line picked out in the accent, as a seamless loop
- [Phyllotaxis](https://remocn.dev/docs/motion-graphics/phyllotaxis) — Seeds spiral out at the golden angle into a sunflower head, then a Fibonacci arm pulses outward

## Compositions

Full scenes built by composing primitives and UI blocks.

### Hero & Outro

- [EcosystemConstellation](https://remocn.dev/docs/compositions/ecosystem-constellation) — Central logo orbited by integration satellites with pulsing data lines
- [InfiniteBentoPan](https://remocn.dev/docs/compositions/infinite-bento-pan) — Camera diagonally drifts across an oversized bento grid behind a soft vignette

### Product Showcases

- [LiveCodeCompilation](https://remocn.dev/docs/compositions/live-code-compilation) — Split-screen where typed code on the left snaps a live UI preview on the right