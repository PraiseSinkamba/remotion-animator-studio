import React from 'react';
import { interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Clip } from '../types';

/** Deterministic pseudo-random in [0,1) from a seed + indices. */
const prand = (seed: string, a: number, b: number): number => {
  let h = 2166136261;
  const str = `${seed}|${a}|${b}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
};

/* ---------------- 1. Synthwave perspective grid ---------------- */

export const SynthGrid: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = clip.props;
  const w = Number(p.width);
  const h = Number(p.height);
  const spacing = Number(p.spacing);
  const offset = ((frame / fps) * Number(p.speed) * spacing) % spacing;
  const line = String(p.lineColor);

  return (
    <div style={{ width: w, height: h, overflow: 'hidden', position: 'relative', opacity: p.opacity }}>
      <div
        style={{
          position: 'absolute',
          left: '-100%',
          top: 0,
          width: '300%',
          height: '500%',
          transformOrigin: '50% 0',
          transform: `perspective(300px) rotateX(60deg)`,
          backgroundImage: `repeating-linear-gradient(to bottom, ${line} 0 4px, transparent 4px ${spacing}px), repeating-linear-gradient(to right, ${line} 0 4px, transparent 4px ${spacing}px)`,
          backgroundSize: `${spacing}px ${spacing}px`,
          backgroundPosition: `0 ${offset}px`,
          boxShadow: `0 0 ${Number(p.glow)}px ${line}`,
        }}
      />
      {/* horizon haze */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '30%',
          background: `linear-gradient(to bottom, ${p.horizonColor} 0%, transparent 100%)`,
        }}
      />
    </div>
  );
};

/* ---------------- 1b. Neon striped sun ---------------- */

export const NeonSun: React.FC<{ clip: Clip }> = ({ clip }) => {
  const p = clip.props;
  const size = Number(p.size);
  const stripes = Math.max(0, Math.round(Number(p.stripes)));
  const id = clip.id;

  const bands: React.ReactNode[] = [];
  for (let i = 0; i < stripes; i++) {
    // stripes thicken and pack toward the bottom half, like the classic outrun sun
    const yPct = 50 + (i / stripes) * 50;
    const hPct = 1.2 + (i / stripes) * 3.4;
    bands.push(<rect key={i} x="0" y={`${yPct}%`} width="100%" height={`${hPct}%`} fill="#000" />);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: 'block', filter: `drop-shadow(0 0 ${Number(p.glow)}px ${p.colorBottom})`, opacity: p.opacity }}
    >
      <defs>
        <linearGradient id={`sun-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={String(p.colorTop)} />
          <stop offset="100%" stopColor={String(p.colorBottom)} />
        </linearGradient>
        <mask id={`mask-${id}`}>
          <circle cx="50" cy="50" r="50" fill="#fff" />
          {bands}
        </mask>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#sun-${id})`} mask={`url(#mask-${id})`} />
    </svg>
  );
};

/* ---------------- 3. Generative isometric city ---------------- */

export const IsoCity: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = clip.props;
  const n = Math.max(2, Math.min(9, Math.round(Number(p.gridSize))));
  const tile = Number(p.tileSize);
  const maxH = Number(p.buildingHeight);
  const stagger = Number(p.stagger);
  const seed = String(p.seed);
  const palette = String(p.colors)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  const tw = tile; // iso tile half-width
  const th = tile / 2;
  const W = (n + n) * tw + tile;
  const H = (n + n) * th + maxH + tile;
  const cx = W / 2;
  const topY = maxH + th;

  const shade = (hex: string, f: number): string => {
    const v = parseInt(hex.replace('#', ''), 16);
    const r = Math.round(((v >> 16) & 255) * f);
    const g = Math.round(((v >> 8) & 255) * f);
    const b = Math.round((v & 255) * f);
    return `rgb(${r},${g},${b})`;
  };

  const buildings: React.ReactNode[] = [];
  // draw back-to-front so nearer buildings overlap correctly
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = cx + (c - r) * tw;
      const y = topY + (c + r) * th;
      const dist = Math.abs(c - (n - 1) / 2) + Math.abs(r - (n - 1) / 2);
      const delay = dist * stagger + prand(seed, r, c) * stagger;
      const grow = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 13, mass: 0.7 } });
      const bh = (0.3 + prand(seed, r, c + 99) * 0.7) * maxH * grow;
      const color = palette[Math.floor(prand(seed, r, c + 7) * palette.length)] ?? '#7c5cff';
      const yT = y - bh;
      buildings.push(
        <g key={`${r}-${c}`}>
          {/* left face */}
          <polygon
            points={`${x - tw},${yT + th} ${x},${yT + 2 * th} ${x},${y + 2 * th} ${x - tw},${y + th}`}
            fill={shade(color, 0.55)}
          />
          {/* right face */}
          <polygon
            points={`${x + tw},${yT + th} ${x},${yT + 2 * th} ${x},${y + 2 * th} ${x + tw},${y + th}`}
            fill={shade(color, 0.8)}
          />
          {/* top face */}
          <polygon
            points={`${x},${yT} ${x + tw},${yT + th} ${x},${yT + 2 * th} ${x - tw},${yT + th}`}
            fill={color}
          />
        </g>,
      );
    }
  }

  // blueprint street glow sweeping outward just ahead of the growth wave
  const sweep = (frame / stagger) * 1.2;
  const streets: React.ReactNode[] = [];
  for (let i = 0; i <= n; i++) {
    const glowOn = interpolate(sweep - i, [0, 1.5], [0, 0.5], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const x0 = cx + (0 - i) * tw;
    const y0 = topY + (0 + i) * th + 2 * th;
    const x1 = cx + (n - i) * tw;
    const y1 = topY + (n + i) * th + 2 * th;
    streets.push(
      <line key={`a${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={String(p.streetColor)} strokeWidth={2} opacity={glowOn} />,
      <line
        key={`b${i}`}
        x1={cx + (i - 0) * tw}
        y1={topY + (i + 0) * th + 2 * th}
        x2={cx + (i - n) * tw}
        y2={topY + (i + n) * th + 2 * th}
        stroke={String(p.streetColor)}
        strokeWidth={2}
        opacity={glowOn}
      />,
    );
  }

  return (
    <svg width={W} height={H} style={{ display: 'block', opacity: p.opacity }}>
      {streets}
      {buildings}
    </svg>
  );
};

/* ---------------- 4. Procedural day/night cycle ---------------- */

export const SkyCycle: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const p = clip.props;
  const w = Number(p.width);
  const h = Number(p.height);
  const seed = String(p.seed);
  const dur = Math.max(1, clip.durationInFrames);
  const t = (frame / dur) % 1; // one full day per clip

  // 0 = noon, .3 = sunset, .55 = midnight, .8 = sunrise, 1 = noon
  const stops = [0, 0.3, 0.55, 0.8, 1];
  const skyTop = interpolateColors(t, stops, ['#3d8fe0', '#c2373b', '#0d0b26', '#b3455f', '#3d8fe0']);
  const skyBottom = interpolateColors(t, stops, ['#a8d4f2', '#ffb45c', '#221a4a', '#ffc178', '#a8d4f2']);
  const nightness = interpolate(t, [0.35, 0.5, 0.85, 0.95], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stars: React.ReactNode[] = [];
  const starCount = Math.round(Number(p.stars));
  for (let i = 0; i < starCount; i++) {
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame / 20 + i * 1.7));
    stars.push(
      <circle
        key={i}
        cx={prand(seed, i, 1) * w}
        cy={prand(seed, i, 2) * h * 0.6}
        r={0.6 + prand(seed, i, 3) * 1.6}
        fill="#fff"
        opacity={nightness * tw}
      />,
    );
  }

  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: p.opacity }}>
      <defs>
        <linearGradient id={`sky-${clip.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyTop} />
          <stop offset="100%" stopColor={skyBottom} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#sky-${clip.id})`} />
      {stars}
    </svg>
  );
};

/** Sun and moon arcing across the clip — one full day per clip, same phase math as SkyCycle. */
export const SunMoon: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const p = clip.props;
  const w = Number(p.width);
  const h = Number(p.height);
  const t = (frame / Math.max(1, clip.durationInFrames)) % 1;
  const size = Number(p.size);

  const sunPhase = ((t + 0.2) % 1) / 0.5; // 0..1 while the sun is up
  const sunUp = sunPhase <= 1;
  const moonPhase = ((t - 0.3 + 1) % 1) / 0.5;
  const nightness = interpolate(t, [0.35, 0.5, 0.85, 0.95], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const moonUp = moonPhase <= 1 && nightness > 0.1;

  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: p.opacity }}>
      {sunUp ? (
        <circle
          cx={sunPhase * w}
          cy={h * 0.9 - Math.sin(sunPhase * Math.PI) * h * 0.72}
          r={size}
          fill={String(p.sunColor)}
          style={{ filter: `drop-shadow(0 0 ${size * 0.7}px ${p.sunColor})` }}
        />
      ) : null}
      {moonUp ? (
        <circle
          cx={moonPhase * w}
          cy={h * 0.85 - Math.sin(moonPhase * Math.PI) * h * 0.62}
          r={size * 0.7}
          fill={String(p.moonColor)}
          opacity={0.92}
          style={{ filter: `drop-shadow(0 0 ${size * 0.4}px ${p.moonColor})` }}
        />
      ) : null}
    </svg>
  );
};

/** A single seeded mountain silhouette whose fill blends day→night over the clip. */
export const Ridge: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const p = clip.props;
  const w = Number(p.width);
  const h = Number(p.height);
  const seed = String(p.seed);
  const peaks = Math.max(3, Math.round(Number(p.peaks)));
  const t = (frame / Math.max(1, clip.durationInFrames)) % 1;
  const stops = [0, 0.3, 0.55, 0.8, 1];
  // blend between the day and night fills following the same phases as the sky
  const fill = interpolateColors(t, stops, [
    String(p.colorDay),
    interpolateColors(0.5, [0, 1], [String(p.colorDay), String(p.colorNight)]),
    String(p.colorNight),
    interpolateColors(0.5, [0, 1], [String(p.colorDay), String(p.colorNight)]),
    String(p.colorDay),
  ]);

  let d = `M 0 ${h}`;
  for (let i = 0; i <= peaks; i++) {
    const x = (w / peaks) * i;
    const y = h - Number(p.baseHeight) - prand(seed, 7, i) * Number(p.amplitude);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  d += ` L ${w} ${h} Z`;

  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: p.opacity }}>
      <path d={d} fill={fill} />
    </svg>
  );
};

/* ---------------- Story trail: waypoint nodes along a drawn route ---------------- */

interface TrailPoint {
  x: number;
  y: number;
  label?: string;
  /** colors this node and the link leaving it; falls back to the element defaults */
  color?: string;
  /** index of the waypoint this one branches from (default: the previous one) */
  from?: number;
}

export const NodeTrail: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = clip.props;
  let pts: TrailPoint[] = [];
  try {
    const parsed = JSON.parse(String(p.data));
    if (Array.isArray(parsed)) {
      pts = parsed
        .filter((q) => q && typeof q === 'object')
        .map((q) => ({
          x: Number(q.x) || 0,
          y: Number(q.y) || 0,
          label: q.label,
          color: q.color,
          from: q.from === undefined ? undefined : Number(q.from),
        }));
    }
  } catch {
    /* invalid JSON — draw nothing until it parses */
  }
  if (pts.length < 2) return null;

  const interval = fps / Number(p.speed);
  const progress = frame / interval;
  const nodeSize = Number(p.nodeSize);
  const curved = p.curved !== 'no';

  const pad = 120;
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const svgW = Math.max(...xs) - minX + pad;
  const svgH = Math.max(...ys) - minY + pad;

  const links: React.ReactNode[] = [];
  const nodes: React.ReactNode[] = [];
  pts.forEach((pt, i) => {
    const x = pt.x - minX;
    const y = pt.y - minY;
    const nodeCol = pt.color || String(p.nodeColor);
    if (i > 0) {
      // links go to the previous waypoint unless `from` points elsewhere — that's a branch
      const parentIdx = pt.from !== undefined && pt.from >= 0 && pt.from < i ? pt.from : i - 1;
      const prev = pts[parentIdx];
      const px = prev.x - minX;
      const py = prev.y - minY;
      const linkCol = pt.color || prev.color || String(p.color);
      const seg = interpolate(progress - (i - 1), [0, 1], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const len = Math.hypot(x - px, y - py) * 1.3;
      const d = curved
        ? `M ${px} ${py} C ${px + (x - px) / 2} ${py} ${px + (x - px) / 2} ${y} ${x} ${y}`
        : `M ${px} ${py} L ${x} ${y}`;
      links.push(
        <path
          key={`l${i}`}
          d={d}
          fill="none"
          stroke={linkCol}
          strokeWidth={Number(p.lineWidth)}
          strokeDasharray={len}
          strokeDashoffset={(1 - seg) * len}
          opacity={0.85}
        />,
      );
    }
    const pop = spring({ frame: Math.max(0, frame - i * interval), fps, config: { damping: 11, mass: 0.6 } });
    const above = i % 2 === 0;
    nodes.push(
      <g key={`n${i}`} transform={`translate(${x}, ${y})`} opacity={Math.min(1, pop * 1.4)}>
        <circle
          r={nodeSize * pop}
          fill="#0e0f13"
          stroke={nodeCol}
          strokeWidth={Math.max(2, nodeSize / 4)}
          style={{ filter: `drop-shadow(0 0 ${nodeSize * 0.8}px ${nodeCol})` }}
        />
        {pt.label ? (
          <text
            y={above ? -nodeSize * 2 : nodeSize * 2 + Number(p.fontSize) * 0.8}
            textAnchor="middle"
            fill={String(p.textColor)}
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={Number(p.fontSize)}
            fontWeight="bold"
          >
            {pt.label}
          </text>
        ) : null}
      </g>,
    );
  });

  // zero-size anchor keeps the first waypoint pinned to the clip's x/y
  return (
    <div style={{ width: 0, height: 0, position: 'relative', opacity: p.opacity }}>
      <svg
        width={svgW}
        height={svgH}
        style={{ position: 'absolute', left: minX, top: minY, overflow: 'visible', display: 'block' }}
      >
        {links}
        {nodes}
      </svg>
    </div>
  );
};

/* ---------------- 5. Git commit graph timeline ---------------- */

interface CommitDatum {
  m: string;
  b?: number;
  a?: number;
  d?: number;
}

export const CommitGraph: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = clip.props;
  const w = Number(p.width);
  const h = Number(p.height);
  let commits: CommitDatum[] = [];
  try {
    const parsed = JSON.parse(String(p.data));
    if (Array.isArray(parsed)) commits = parsed;
  } catch {
    /* bad JSON — draw nothing until it parses */
  }
  const laneColors = String(p.laneColors)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const gap = Number(p.nodeGap);
  const interval = fps / Number(p.speed); // frames between node reveals
  const progress = frame / interval;

  const laneY = (lane: number) => h / 2 + (lane - 0.5) * 110;
  const nodeX = (i: number) => 80 + i * gap;

  // camera: keep the reveal point around 60% width once it passes it
  const camShift = Math.max(0, nodeX(Math.min(progress, commits.length - 1)) - w * 0.6);

  const nodes: React.ReactNode[] = [];
  const links: React.ReactNode[] = [];
  commits.forEach((c, i) => {
    const lane = Number(c.b ?? 0);
    const color = laneColors[lane % laneColors.length] ?? '#6ee7a8';
    const reveal = spring({ frame: Math.max(0, frame - i * interval), fps, config: { damping: 11, mass: 0.6 } });
    const x = nodeX(i);
    const y = laneY(lane);
    if (i > 0) {
      const prev = commits[i - 1];
      const px = nodeX(i - 1);
      const py = laneY(Number(prev.b ?? 0));
      // link draws in just before its node pops
      const seg = interpolate(progress - (i - 1), [0, 1], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      links.push(
        <path
          key={`l${i}`}
          d={`M ${px} ${py} C ${px + gap / 2} ${py} ${x - gap / 2} ${y} ${x} ${y}`}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={gap * 1.4}
          strokeDashoffset={(1 - seg) * gap * 1.4}
          opacity={0.8}
        />,
      );
    }
    const adds = Math.round(Number(c.a ?? 0) * Math.min(1, reveal));
    const dels = Math.round(Number(c.d ?? 0) * Math.min(1, reveal));
    const typed = String(c.m).slice(0, Math.max(0, Math.floor((frame - i * interval) / 1.5)));
    nodes.push(
      <g key={`n${i}`} transform={`translate(${x}, ${y})`} opacity={Math.min(1, reveal * 1.4)}>
        <circle r={16 * reveal} fill="#0e0f13" stroke={color} strokeWidth={4} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
        <text
          y={lane === 0 ? -38 : 54}
          textAnchor="middle"
          fill="#e8eaf0"
          fontFamily="'Courier New', monospace"
          fontSize={26}
          fontWeight="bold"
        >
          {typed}
        </text>
        {(c.a ?? 0) + (c.d ?? 0) > 0 ? (
          <text y={lane === 0 ? -70 : 88} textAnchor="middle" fontFamily="'Courier New', monospace" fontSize={22}>
            <tspan fill="#6ee7a8">+{adds}</tspan>
            <tspan fill="#ff5c6c"> −{dels}</tspan>
          </text>
        ) : null}
      </g>,
    );
  });

  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: p.opacity, overflow: 'hidden' }}>
      <g transform={`translate(${-camShift}, 0)`}>
        {links}
        {nodes}
      </g>
    </svg>
  );
};
