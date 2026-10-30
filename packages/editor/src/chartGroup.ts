/**
 * The grouped chart: the arrangement of one to three chart clips.
 *
 * A group owns the *arrangement* — the layout, the shared clock and the
 * declared relations. It does not own the charts' data: each chart keeps its
 * own series, price scale, viewport and lifecycle (CH-003, CH-004).
 *
 * The layout maths lives here, in the editor, because a rect is a pixel fact
 * about the composition, not a market fact. The core stays free of it.
 *
 * A clip's content is centred on its position, so a chart's box spans
 * `x - width/2 … x + width/2` in composition coordinates. Every rect below is
 * in those coordinates, and every layout tiles the group's box exactly, so
 * re-laying a group out never drifts.
 */
import type {
  ChartGroupSpec,
  Clip,
  MarketClock,
  OhlcBar,
  PaneSpec,
  Project,
  SeriesSpec,
} from '@chart-studio/core';

/** A box in composition coordinates: top-left origin, pixels. */
export interface CompositionBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The size of the small chart in a PIP layout, as a fraction of the group box. */
export const PIP_SMALL = 0.3;

/** The layouts a grouped chart can take. */
export const CHART_GROUP_LAYOUTS = [
  'single',
  'split-horizontal',
  'split-vertical',
  'pip',
] as const satisfies readonly ChartGroupSpec['layout'][];

/** What each layout is called in the editor. */
export const CHART_GROUP_LAYOUT_LABELS: Record<ChartGroupSpec['layout'], string> = {
  single: 'Single',
  'split-horizontal': 'Side by side',
  'split-vertical': 'Stacked',
  pip: 'Picture in picture',
};

/** The box a chart clip occupies. Its content is centred on `x`/`y`. */
export const clipBox = (clip: Clip): CompositionBox => {
  const x = Number(clip.props.x) || 0;
  const y = Number(clip.props.y) || 0;
  const width = Number(clip.props.width) || 0;
  const height = Number(clip.props.height) || 0;
  return { left: x - width / 2, top: y - height / 2, width, height };
};

/** The box that holds every given box. */
export const unionBox = (boxes: readonly CompositionBox[]): CompositionBox => {
  if (boxes.length === 0) return { left: 0, top: 0, width: 0, height: 0 };
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
};

/**
 * The boxes the group's charts take in a layout.
 *
 * - `single` — every chart fills the box: the group shows one chart.
 * - `split-horizontal` — the charts sit side by side.
 * - `split-vertical` — the charts are stacked.
 * - `pip` — the first chart fills the box and the rest are small insets in
 *   its corners.
 */
export const groupLayoutRects = (
  layout: ChartGroupSpec['layout'],
  count: number,
  box: CompositionBox,
): CompositionBox[] => {
  const charts = Math.max(1, Math.floor(count));
  if (layout === 'single') {
    return Array.from({ length: charts }, () => ({ ...box }));
  }
  if (layout === 'split-horizontal') {
    const column = box.width / charts;
    return Array.from({ length: charts }, (_, i) => ({
      left: box.left + i * column,
      top: box.top,
      width: column,
      height: box.height,
    }));
  }
  if (layout === 'split-vertical') {
    const row = box.height / charts;
    return Array.from({ length: charts }, (_, i) => ({
      left: box.left,
      top: box.top + i * row,
      width: box.width,
      height: row,
    }));
  }
  // PIP: the first chart fills the box, the others are small insets.
  const small = { width: box.width * PIP_SMALL, height: box.height * PIP_SMALL };
  const corners = [
    { left: box.left + box.width - small.width, top: box.top + box.height - small.height },
    { left: box.left + box.width - small.width, top: box.top },
    { left: box.left, top: box.top + box.height - small.height },
  ];
  return Array.from({ length: charts }, (_, i) =>
    i === 0
      ? { ...box }
      : {
          ...small,
          left: corners[(i - 1) % corners.length].left,
          top: corners[(i - 1) % corners.length].top,
        },
  );
};

/** The clock a group shares: the first chart's series is the reference. */
export const groupClock = (
  id: string,
  referenceSeriesId: string,
  framesPerStep: number,
): MarketClock => ({
  id,
  unit: 'logical',
  referenceSeriesId,
  stepBars: 1,
  framesPerStep: framesPerStep > 0 ? framesPerStep : 15,
});

/**
 * Gives a chart the market it needs to host panes: a series, a pane and a
 * clock. Pure — the caller commits.
 *
 * A chart added from the library carries inline bars and no series, and a pane
 * cannot resolve against a chart that has no evaluated series.
 */
export const withChartMarket = (project: Project, clipId: string): Project => {
  const clip = project.tracks
    .flatMap((track) => track.clips)
    .find((entry) => entry.id === clipId);
  if (!clip || clip.element !== 'candlestickChart') return project;
  if (
    typeof clip.props.seriesId === 'string' &&
    Array.isArray(clip.props.panes) &&
    clip.props.clock
  ) {
    return project;
  }

  const seriesId = `series-${clip.id}`;
  const bars: OhlcBar[] = Array.isArray(clip.props.bars) ? (clip.props.bars as OhlcBar[]) : [];
  const stamped = bars.map((bar, index) => ({ ...bar, id: `${seriesId}:${index}` }));
  const framesPerBar = typeof clip.props.framesPerBar === 'number' ? clip.props.framesPerBar : 15;
  const symbol = typeof clip.props.symbol === 'string' ? clip.props.symbol : 'Series';
  const isSynthetic = clip.props.dataSource === 'synthetic';

  const series: SeriesSpec = isSynthetic
    ? {
        id: seriesId,
        origin: 'synthetic',
        label: symbol,
        symbol: typeof clip.props.symbol === 'string' ? clip.props.symbol : undefined,
        timeBasis: 'logical',
        seed: `${seriesId}-seed`,
        algorithmVersion: 1,
        generator: {
          count: stamped.length,
          startPrice: stamped[0]?.o ?? 1,
          timeframeMs: 60_000,
        },
        // The bars are the record: the chart's own bars are what it was
        // showing, and the recipe cannot make them again.
        bars: stamped,
      }
    : {
        id: seriesId,
        origin: 'manual',
        label: symbol,
        symbol: typeof clip.props.symbol === 'string' ? clip.props.symbol : undefined,
        timeBasis: 'logical',
        bars: stamped,
      };

  const panes: PaneSpec[] = [
    {
      id: `${clip.id}-pane-0`,
      name: `${symbol} pane`,
      seriesId,
      aggregation: { factor: 1 },
      rect: { x: 0, y: 0, width: 1, height: 1 },
      in: 0,
      out: clip.durationInFrames,
      opacity: 1,
      clock: { kind: 'reference' },
      priceRange: { mode: 'auto' },
    },
  ];

  return {
    ...project,
    series: [...(project.series ?? []), series],
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((entry) =>
        entry.id === clipId
          ? {
              ...entry,
              props: {
                ...entry.props,
                seriesId,
                panes,
                clock: groupClock(`${clip.id}-clock`, seriesId, framesPerBar),
              },
            }
          : entry,
      ),
    })),
  };
};

/**
 * Builds the group: a shared clock on every chart, the panes bound to that
 * clock, the charts placed by the layout, and the group recorded on the
 * project. Pure — the caller commits.
 */
export const buildChartGroup = (
  project: Project,
  groupId: string,
  chartClipIds: readonly string[],
  layout: ChartGroupSpec['layout'],
): Project => {
  const clips = chartClipIds
    .map((id) => project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === id))
    .filter((clip): clip is Clip => clip !== undefined && clip.element === 'candlestickChart');
  if (clips.length === 0) return project;

  const referenceSeriesId = String(clips[0].props.seriesId ?? '');
  const framesPerStep = Number(clips[0].props.framesPerBar) || 15;
  const clock = groupClock(`${groupId}-clock`, referenceSeriesId, framesPerStep);

  const box = unionBox(clips.map(clipBox));
  const rects = groupLayoutRects(layout, clips.length, box);

  const group: ChartGroupSpec = {
    id: groupId,
    name: 'Chart group',
    chartClipIds: clips.map((clip) => clip.id),
    layout,
    clock,
    relations: [],
  };

  const placed = new Map(clips.map((clip, index) => [clip.id, rects[index]]));

  return {
    ...project,
    chartGroups: [...(project.chartGroups ?? []), group],
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        const rect = placed.get(clip.id);
        if (!rect) return clip;
        const panes: PaneSpec[] = Array.isArray(clip.props.panes)
          ? (clip.props.panes as PaneSpec[])
          : [];
        return {
          ...clip,
          // The group's convenience: the charts move together by default.
          groupId: groupId,
          props: {
            ...clip.props,
            clock,
            // A pane on another series reads its own series at the clock's
            // index: an authored link, not market time.
            panes: panes.map((pane) =>
              pane.seriesId === referenceSeriesId
                ? pane
                : { ...pane, clock: { kind: 'offset' as const, offsetBars: 0 } },
            ),
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: rect.width,
            height: rect.height,
          },
        };
      }),
    })),
  };
};

/**
 * Moves a group's charts into another layout. Pure — the caller commits.
 *
 * The box is the union of the charts' own boxes, which every layout tiles
 * exactly, so a group keeps its place when it is laid out again.
 */
export const relayoutChartGroup = (
  project: Project,
  groupId: string,
  layout: ChartGroupSpec['layout'],
): Project => {
  const group = project.chartGroups?.find((entry) => entry.id === groupId);
  if (!group) return project;
  const clips = group.chartClipIds
    .map((id) => project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === id))
    .filter((clip): clip is Clip => clip !== undefined);
  if (clips.length === 0) return project;

  const box = unionBox(clips.map(clipBox));
  const rects = groupLayoutRects(layout, clips.length, box);
  const placed = new Map(clips.map((clip, index) => [clip.id, rects[index]]));

  return {
    ...project,
    chartGroups: (project.chartGroups ?? []).map((entry) =>
      entry.id === groupId ? { ...entry, layout } : entry,
    ),
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        const rect = placed.get(clip.id);
        if (!rect) return clip;
        return {
          ...clip,
          props: {
            ...clip.props,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: rect.width,
            height: rect.height,
          },
        };
      }),
    })),
  };
};
