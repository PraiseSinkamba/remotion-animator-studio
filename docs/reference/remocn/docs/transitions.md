# Transitions
URL: https://remocn.dev/docs/transitions

Scene transitions built as presentations for TransitionSeries

Most transitions here are presentations for `@remotion/transitions` — pass one to a `TransitionSeries.Transition` between two sequences and control the pace with `linearTiming` or `springTiming`. The sequencers at the bottom work differently: they own the whole run of scenes themselves.

## Camera Motion

Pure CSS-transform physics, no dependencies beyond Remotion.

- [WhipPan](https://remocn.dev/docs/transitions/whip-pan) — Whip the camera sideways with motion blur so both scenes fly through in one move
- [PushThrough](https://remocn.dev/docs/transitions/push-through) — Dolly through the outgoing scene while the next one approaches from the depth
- [FocusPull](https://remocn.dev/docs/transitions/focus-pull) — Rack focus from one scene to the next through a soft defocus breath
- [ZoomBlur](https://remocn.dev/docs/transitions/zoom-blur) — Push the outgoing scene through the viewer while the incoming one resolves out of blur

## Shader

Textured, organic transitions driven by frame-synced shaders. Most use `@paper-design/shaders-react`; Shader Seam and Shader Spiral Pass use a local OpenShaders export.

- [ShaderSpiralPass](https://remocn.dev/docs/transitions/shader-spiral-pass) — Fly into a luminous spiral and emerge through its center into the next scene
- [ShaderSeam](https://remocn.dev/docs/transitions/shader-seam) — Dissolve an OpenShaders material in place to uncover the next scene
- [GrainDissolve](https://remocn.dev/docs/transitions/grain-dissolve) — Disintegrate the outgoing scene into soft grainy shapes and condense the next out of the noise
- [WaveWipe](https://remocn.dev/docs/transitions/wave-wipe) — Sweep a grainy wave up across the frame and reveal the next scene from below
- [RippleZoom](https://remocn.dev/docs/transitions/ripple-zoom) — Fly the camera through the center of grainy ripple rings while the next scene approaches
- [SwirlDissolve](https://remocn.dev/docs/transitions/swirl-dissolve) — Twist the frame into swirling bands that unwind into the next scene
- [DitherDissolve](https://remocn.dev/docs/transitions/dither-dissolve) — Dissolve through an animated dither pattern for a retro print texture
- [PerlinDissolve](https://remocn.dev/docs/transitions/perlin-dissolve) — Sweep a perlin-noise threshold across the frame to dissolve into the next scene
- [SmokeDissolve](https://remocn.dev/docs/transitions/smoke-dissolve) — Expand a smoke ring outward across the frame to reveal the next scene
- [WarpDissolve](https://remocn.dev/docs/transitions/warp-dissolve) — Melt the outgoing scene into a folding domain-warp field that straightens into the next

## Stylized

Kinetic, interface-flavored transitions — typed wipes, scattering icons, and messaging motion.

- [AsciiDissolve](https://remocn.dev/docs/transitions/ascii-dissolve) — Dissolve one scene into the next through a drifting field of ASCII glyphs
- [CaretWipe](https://remocn.dev/docs/transitions/caret-wipe) — Sweep a typing caret across the frame, wiping the outgoing scene into the next
- [IconScatter](https://remocn.dev/docs/transitions/icon-scatter) — Scatter a field of icons over the cut, hiding the scene swap at the field's peak

## Graphic Cuts

Bold, showy cuts built from plain CSS and SVG: shapes, slats, torn paper, streaks and light. No dependencies beyond Remotion.

- [IrisWipe](https://remocn.dev/docs/transitions/iris-wipe) — Close a cartoon iris on the subject, hold it as a dot, then open it on the next scene
- [VenetianBlinds](https://remocn.dev/docs/transitions/venetian-blinds) — Turn the outgoing scene edge-on in staggered horizontal slats to reveal the next one
- [PaperTear](https://remocn.dev/docs/transitions/paper-tear) — Rip the frame down the middle and fling both torn halves apart on impact
- [PixelSort](https://remocn.dev/docs/transitions/pixel-sort) — Melt the scene into glowing vertical streaks and drop the next one in column by column
- [LightLeak](https://remocn.dev/docs/transitions/light-leak) — Drift a warm analog light leak across the frame and hard-cut under its blow-out
- [Hyperspace](https://remocn.dev/docs/transitions/hyperspace) — Stretch a starfield into streaks, tunnel forward and land on the next scene through a flash

## Canvas

Pixel-level transitions. These read the actual pixels of both scenes through the experimental html-in-canvas browser API and post-process them per frame, which is what makes tearing, burning, and shattering possible at all. Chrome 149+ behind `chrome://flags/#canvas-draw-element` shows the real effect; every other browser degrades to a CSS approximation of the same edit, so previews and renders never break.

- [GlitchCut](https://remocn.dev/docs/transitions/glitch-cut) — Tear a hard cut into displaced slices with channel split and corrupted blocks
- [EmberBurn](https://remocn.dev/docs/transitions/ember-burn) — Set the outgoing frame on fire so it boils, chars, and blows away as sparks that carry its own colour
- [ParticleDissolve](https://remocn.dev/docs/transitions/particle-dissolve) — Grind the frame into drifting grey dust and let the next scene coalesce back out of it
- [GridWave](https://remocn.dev/docs/transitions/grid-wave) — Send a wave across the frame that raises the picture into solid blocks and sets them down carrying the next scene
- [Displacement](https://remocn.dev/docs/transitions/displacement) — Shear the frame into a grid of offset colour-fringed tiles and settle them back on the next scene

## Scene Sequencers

Not presentations. Each of these takes the whole list of scenes and runs the timeline itself, so the boundary is a property of the film rather than something dropped between two sequences. Scenes never overlap and the stage is continuous, which is what makes a run of them read as one cut instead of a slideshow.

- [SlideSwapScenes](https://remocn.dev/docs/transitions/slide-swap) — Shove one scene off the canvas and spring the next in from the opposite edge
- [SpringSettleScenes](https://remocn.dev/docs/transitions/spring-settle) — Shrink a scene away as one group, hold the stage empty for a beat, then land the next from above