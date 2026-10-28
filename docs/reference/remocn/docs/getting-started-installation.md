# Installation
URL: https://remocn.dev/docs/getting-started/installation

Add remocn to an existing Remotion project

remocn assumes you already have Remotion installed. If you don't, run `npx create-video@latest` first.

## 1. Initialize shadcn

If your project doesn't already have a `components.json`, run:

```bash
npx shadcn@latest init
```

Pick the defaults: remocn components are framework-agnostic and only need the path aliases.

## 2. Add a component

## Installation

```bash
npx shadcn@latest add @remocn/soft-blur-in
```

This copies `soft-blur-in.tsx` into `components/remocn/` (or wherever your `components.json` points).

## Install everything

Want the whole library at once? Copy this command to add every remocn component in a single run.

```bash
npx shadcn@latest add @remocn/soft-blur-in @remocn/per-character-rise @remocn/bottom-up-letters @remocn/top-down-letters @remocn/spring-scale-in @remocn/micro-scale-fade @remocn/scale-down-fade @remocn/blur-out-up @remocn/focus-blur-resolve @remocn/lens-zoom @remocn/line-by-line-slide @remocn/per-word-crossfade @remocn/word-stream @remocn/word-push @remocn/sheen-slide-in @remocn/squeeze-in @remocn/fog-rise @remocn/caret-swap @remocn/zoom-words @remocn/centered-word-build @remocn/inline-pill-takeover @remocn/typed-split-wipe @remocn/shadow-sweep-text @remocn/outline-fill-track-text @remocn/gradient-scale-cut-text @remocn/rush-type @remocn/extrude-pop @remocn/fade-through @remocn/shared-axis-y @remocn/shared-axis-z @remocn/short-slide-right @remocn/kinetic-morph-text @remocn/kinetic-warp @remocn/kinetic-center-build @remocn/short-slide-down @remocn/typewriter @remocn/inline-highlight @remocn/stretch-in @remocn/strikethrough-replace @remocn/staggered-fade-up @remocn/mask-reveal-up @remocn/tracking-in @remocn/shimmer-sweep @remocn/marker-highlight @remocn/slot-machine-roll @remocn/matrix-decode @remocn/rgb-glitch-text @remocn/infinite-marquee @remocn/shader-mesh-gradient @remocn/shader-mesh-gradient-dusk @remocn/shader-mesh-gradient-lagoon @remocn/shader-mesh-gradient-peach @remocn/shader-mesh-gradient-aurora @remocn/shader-mesh-gradient-lavender @remocn/shader-mesh-gradient-ember @remocn/shader-mesh-gradient-mint @remocn/shader-mesh-gradient-synthwave @remocn/shader-mesh-gradient-ink @remocn/shader-grain-gradient @remocn/shader-grain-gradient-sunrise @remocn/shader-grain-gradient-nebula @remocn/shader-grain-gradient-orb @remocn/shader-grain-gradient-horizon @remocn/shader-grain-gradient-blush @remocn/shader-grain-gradient-tide @remocn/shader-grain-gradient-arcade @remocn/shader-grain-gradient-dune @remocn/shader-grain-gradient-ultraviolet @remocn/shader-warp @remocn/shader-warp-silk @remocn/shader-warp-sunset @remocn/shader-warp-ocean @remocn/shader-warp-marble @remocn/shader-warp-acid @remocn/shader-warp-cream @remocn/shader-warp-deep-sea @remocn/shader-warp-rose-gold @remocn/shader-warp-storm @remocn/shader-swirl @remocn/shader-swirl-candy @remocn/shader-swirl-sunburst @remocn/shader-swirl-hypno @remocn/shader-swirl-neon @remocn/shader-swirl-tide @remocn/shader-swirl-citrus @remocn/shader-swirl-ember @remocn/shader-swirl-lilac @remocn/shader-swirl-retro @remocn/shader-water @remocn/shader-spiral @remocn/shader-liquid-metal @remocn/shader-color-panels @remocn/shader-neuro-noise @remocn/shader-perlin-noise @remocn/shader-simplex-noise @remocn/shader-voronoi @remocn/shader-dot-orbit @remocn/shader-dithering @remocn/shader-god-rays @remocn/shader-smoke-ring @remocn/shader-metaballs @remocn/shader-pulsing-border @remocn/simulated-cursor @remocn/swirl-dissolve @remocn/dither-dissolve @remocn/perlin-dissolve @remocn/smoke-dissolve @remocn/wave-wipe @remocn/ripple-zoom @remocn/gooey-morph @remocn/grain-dissolve @remocn/warp-dissolve @remocn/whip-pan @remocn/push-through @remocn/focus-pull @remocn/zoom-blur @remocn/rolodex-flip @remocn/value-swap @remocn/chat-to-preview-layout @remocn/animated-line-chart @remocn/animated-bar-chart @remocn/terminal-simulator @remocn/terminal-cursor-zoom @remocn/glass-code-block @remocn/glass-code-walk @remocn/perspective-marquee @remocn/perspective-squeeze @remocn/ecosystem-constellation @remocn/live-code-compilation @remocn/infinite-bento-pan @remocn/github-sponsors @remocn/github-stars @remocn/number-wheel @remocn/rolling-number @remocn/x-follow-card @remocn/x-followers-overview @remocn/claude-chat @remocn/chat-gpt @remocn/v0 @remocn/claude-code @remocn/opencode @remocn/chromatic-wave @remocn/radial-burst @remocn/confetti @remocn/backdrop @remocn/drift @remocn/stage @remocn/logo-enter @remocn/handwrite @remocn/ink-underline @remocn/paper-wobble @remocn/ink-arrow @remocn/paper-sticker @remocn/polaroid @remocn/hand-count @remocn/brush @remocn/crumple-toss @remocn/scribble-circle @remocn/check-list @remocn/page-turn @remocn/stop-motion @remocn/ascii-dissolve @remocn/caret-wipe @remocn/icon-scatter @remocn/shader-caustics @remocn/shader-gem-smoke @remocn/shader-strata @remocn/shader-weave @remocn/reel @remocn/scene-motion @remocn/slide-swap @remocn/spring-settle @remocn/canvas-presentation @remocn/ember-burn @remocn/displacement @remocn/hologram @remocn/security-cam @remocn/tv-power-off @remocn/camera-lens @remocn/underwater-ripple @remocn/halftone-print @remocn/ascii-render @remocn/pixelate-region @remocn/sustained-glitch @remocn/crt-screen @remocn/vhs-filter @remocn/grid-wave @remocn/particle-dissolve @remocn/glitch-cut @remocn/search-reveal @remocn/cursor-gravity @remocn/type-fossil @remocn/shader-seam @remocn/shader-text-reveal @remocn/inline-word-roll @remocn/shader-light-tunnel @remocn/shader-spiral-pass @remocn/truchet-flip @remocn/mondrian-split @remocn/bauhaus-build @remocn/squiggle @remocn/speed-lines @remocn/trim-burst @remocn/keystroke @remocn/code-morph @remocn/agent-run @remocn/selection-snap @remocn/echo-stack @remocn/type-wall @remocn/ring-text @remocn/period-drop @remocn/outline-trace @remocn/glyph-anatomy @remocn/stripe-type @remocn/path-ride @remocn/type-repeater @remocn/caption-core @remocn/caption-karaoke @remocn/caption-highlight-box @remocn/caption-active-pop @remocn/caption-word-pop @remocn/caption-bounce-in @remocn/caption-blur-in @remocn/caption-rise @remocn/caption-typewriter @remocn/caption-slot @remocn/caption-subtitle @remocn/caption-dim-progress @remocn/caption-underline @remocn/caption-scramble @remocn/caption-weight @remocn/caption-emoji @remocn/caption-speaker @remocn/caption-stack @remocn/caption-outline @remocn/caption-marker @remocn/caption-stamp @remocn/caption-handwrite @remocn/caption-redact @remocn/caption-prosody @remocn/caption-timeline @remocn/caption-teleprompter @remocn/caption-knockout @remocn/caption-slice @remocn/caption-cube @remocn/caption-split-flap @remocn/caption-label-maker @remocn/caption-drop @remocn/iris-wipe @remocn/venetian-blinds @remocn/paper-tear @remocn/pixel-sort @remocn/light-leak @remocn/orbit-lock @remocn/puzzle-snap @remocn/spotlight @remocn/neon-sign @remocn/inflate @remocn/liquid-fill @remocn/accordion-unfold @remocn/anamorphic-flare @remocn/pendulum-wave @remocn/flow-field @remocn/isometric-build @remocn/life-grid @remocn/string-art @remocn/topo-lines @remocn/phyllotaxis @remocn/hyperspace @remocn/parallax-depth @remocn/dolly-zoom @remocn/turntable @remocn/gravity-pile @remocn/cloth-reveal @remocn/exploded-view @remocn/tiny-planet @remocn/impact-shake @remocn/riso-print @remocn/line-boil @remocn/blueprint @remocn/duotone-beat @remocn/comic-panels @remocn/long-shadow @remocn/synthwave @remocn/brick-mosaic @remocn/x-ray-scan @remocn/remocn-ui @remocn/spinner @remocn/caret @remocn/button @remocn/accordion @remocn/alert-dialog @remocn/dialog @remocn/sheet @remocn/drawer @remocn/checkbox @remocn/radio @remocn/switch @remocn/input @remocn/blur-in @remocn/field @remocn/select-item @remocn/select @remocn/select-menu @remocn/dropdown-menu-item @remocn/tabs @remocn/dropdown-menu @remocn/cursor @remocn/toast @remocn/command-menu-item @remocn/command-menu @remocn/tooltip @remocn/progress @remocn/skeleton-block @remocn/skeleton @remocn/slider @remocn/combobox @remocn/popover @remocn/context-menu @remocn/toggle-group @remocn/stepper @remocn/resizable @remocn/signup-flow @remocn/ai-prompt-flow @remocn/checkout-flow @remocn/onboarding-stepper-flow @remocn/settings-toggle-flow @remocn/message-bubble @remocn/typing-indicator @remocn/chat-flow @remocn/telegram-chat-flow @remocn/imessage-chat-flow
```

## Add straight to Remotion Studio

If a [Remotion Studio](https://www.remotion.dev/docs/studio) (4.0.502 or newer) is running locally, most components can skip the CLI entirely. Component pages show an **Add to Studio** button next to the preview — it finds your running Studio and drops the component into the active composition as source code. The drag handle beside it does the same thing by drag and drop, so you can place the element on the timeline yourself. Icons work the same way from the [icons gallery](/docs/icons/gallery).

Either way the result matches `npx shadcn add`: the source lands in your project and is yours to edit. On top of that, elements arrive with editable controls — the same knobs each docs page shows (text, colors, timings, speed) appear as native controls in the Studio sidebar, alongside the standard timeline and transform handles. Compositions and components that build on other remocn components install through the CLI only.

## 3. Use it in a Remotion composition

```tsx
import { Composition } from "remotion";
import { SoftBlurIn } from "@/components/remocn/soft-blur-in";

export const RemotionRoot = () => (
  <Composition
    id="HelloWorld"
    component={SoftBlurIn}
    durationInFrames={60}
    fps={30}
    width={1280}
    height={720}
    defaultProps={{ text: "Hello, world" }}
  />
);
```

That's it. Render with `npx remotion render HelloWorld out.mp4`.