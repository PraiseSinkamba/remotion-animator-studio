# Animated Line Chart
URL: https://remocn.dev/docs/ui-blocks/animated-line-chart

A line chart whose path draws on from left to right

- Install: `npx shadcn@latest add @remocn/animated-line-chart`
- Vibe: data
- Natural length: 90f @ 30fps

## Installation

```bash
npx shadcn@latest add @remocn/animated-line-chart
```

## Usage

```tsx
// src/Root.tsx
import { Composition } from "remotion";
import { AnimatedLineChart } from "@/components/remocn/animated-line-chart";

const AnimatedLineChartScene = () => (
  <AnimatedLineChart
    data={[12, 19, 8, 15, 22, 18, 28, 25, 32]}
    strokeColor="#22c55e"
  />
);

export const RemotionRoot = () => (
  <Composition
    id="AnimatedLineChart"
    component={AnimatedLineChartScene}
    durationInFrames={90}
    fps={30}
    width={1280}
    height={720}
  />
);
```

### With Backdrop

Renders transparent — supply the background via `Backdrop`:

```tsx
import { Backdrop } from "@/components/remocn/backdrop";
import { AnimatedLineChart } from "@/components/remocn/animated-line-chart";

<Backdrop fill={{ type: "color", value: "#0a0a0a" }}>
  <AnimatedLineChart data={[12, 19, 8, 15, 22, 18, 28, 25, 32]} strokeColor="#22c55e" />
</Backdrop>
```

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `number[]` | `[12, 19, 8, 15, 22, 18, 28, 25, 32]` | Y-values of the chart. Auto-scaled to the available height. |
| `width` | `number` | `1000` | SVG viewBox width |
| `height` | `number` | `500` | SVG viewBox height |
| `strokeColor` | `string` | `"#22c55e"` | Color of the line stroke |
| `strokeWidth` | `number` | `4` | Line stroke width in pixels |
| `gridColor` | `string` | `"#27272a"` | Grid and axis line color |
| `showDot` | `boolean` | `true` | Render a dot at the leading edge of the line as it draws |
| `className` | `string` | — | Optional className passed to the outer container |

## Use when
- Showing growth or trend over time — revenue curve, DAU climb, error-rate drop.
- A SaaS demo needs a "hockey stick" moment where the line visibly inflects upward.
- You want a single continuous reveal motion rather than per-bar stagger.

## Don't use when
- The data is categorical (not time-ordered) — use `animated-bar-chart` to compare discrete values side by side.
- You have only 2–3 data points; a near-straight line adds little; use a number counter or a headline stat instead.