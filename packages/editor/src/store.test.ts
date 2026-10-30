import { beforeEach, describe, expect, it } from 'vitest';

import { getComponent } from '@chart-studio/components';
import { materialiseSeries, sampleProject, seriesRevision } from '@chart-studio/core';
import { useStore } from './store';
import type { Project, SeriesSpec } from '@chart-studio/core';

/** A project with one empty track, so every clip in it is one we created. */
const emptyProject = (): Project => ({
  ...sampleProject,
  tracks: [{ id: 't-empty', name: 'Track 1', clips: [] }],
});

describe('store — clip creation', () => {
  beforeEach(() => {
    useStore.setState({
      project: emptyProject(),
      selectedClipIds: [],
      history: [],
      future: [],
      workspaceId: null,
      workspaceRevision: null,
    });
  });

  it('stamps the component props version on a new clip', () => {
    useStore.getState().addClip('text', 't-empty', 0);

    const clips = useStore.getState().project.tracks[0].clips;
    const clip = clips[clips.length - 1];
    expect(clip.element).toBe('text');
    expect(clip.propsVersion).toBe(getComponent('text')?.propsVersion ?? 1);
  });

  it('stamps the component props version on every clip of a preset', () => {
    useStore.getState().addPreset('titleIntro', 0);

    const clips = useStore.getState().project.tracks.flatMap((t) => t.clips);
    expect(clips.length).toBeGreaterThan(0);
    for (const clip of clips) {
      expect(clip.propsVersion).toBe(getComponent(clip.element)?.propsVersion ?? 1);
    }
  });
});

describe('store — the swing path', () => {
  const chartProject = (): Project => {
    const project = emptyProject();
    useStore.getState().addClip('candlestickChart', 't-empty', 0);
    return useStore.getState().project;
  };

  const chartClip = () => {
    const clips = useStore.getState().project.tracks.flatMap((t) => t.clips);
    return clips.find((clip) => clip.element === 'candlestickChart')!;
  };

  const authoredSeries = (): SeriesSpec | undefined => {
    const clip = chartClip();
    return useStore.getState().project.series?.find((s) => s.id === clip.props.seriesId);
  };

  /** How many anchors the path holds. */
  const anchorCount = (): number => {
    const series = authoredSeries();
    return series?.origin === 'authored-path' ? series.path.anchors.length : 0;
  };

  /** The bars a series materialises to. */
  const materialise = (series: SeriesSpec | undefined) =>
    series ? materialiseSeries(series).bars : [];

  /** The id of the anchor at a position in the path. */
  const anchorId = (index: number): string => {
    const series = authoredSeries();
    const anchor =
      series?.origin === 'authored-path' ? series.path.anchors[index] : undefined;
    if (!anchor) throw new Error(`The path has no anchor at ${index}.`);
    return anchor.id;
  };

  /** The id of the anchor at a price — the creator's own anchors, not the seeded ones. */
  const anchorIdByPrice = (price: number): string => {
    const series = authoredSeries();
    const anchor =
      series?.origin === 'authored-path'
        ? series.path.anchors.find((a) => a.price === price)
        : undefined;
    if (!anchor) throw new Error(`The path has no anchor at ${price}.`);
    return anchor.id;
  };

  beforeEach(() => {
    useStore.setState({
      project: emptyProject(),
      selectedClipIds: [],
      history: [],
      future: [],
      workspaceId: null,
      workspaceRevision: null,
      swingPath: null,
    });
  });

  it('adds a swing anchor to the chart’s authored series', () => {
    chartProject();
    const clip = chartClip();
    useStore.getState().startSwingPath(clip.id);
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 3, price: 100 });
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 8, price: 120 });

    const series = authoredSeries();
    expect(series?.origin).toBe('authored-path');
    if (series?.origin !== 'authored-path') throw new Error('expected an authored path');
    // The path starts as a flat market the creator reshapes, so the two
    // placed anchors are added to it rather than replacing it.
    expect(series.path.anchors.length).toBe(4);
    expect(series.path.anchors.map((a) => a.price)).toContain(120);
  });

  it('regenerates the series when an anchor moves', () => {
    chartProject();
    const clip = chartClip();
    useStore.getState().startSwingPath(clip.id);
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 3, price: 100 });
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 8, price: 120 });

    const before = authoredSeries();
    const beforeRevision = before ? seriesRevision(before) : undefined;
    useStore.getState().moveSwingAnchor(clip.id, anchorIdByPrice(120), { price: 130 });
    const after = authoredSeries();

    if (after?.origin !== 'authored-path') throw new Error('expected an authored path');
    expect(after.path.anchors.some((a) => a.price === 130)).toBe(true);
    expect(seriesRevision(after)).not.toBe(beforeRevision);
  });

  it('regenerates identical bars after the same anchor move', () => {
    chartProject();
    const clip = chartClip();
    useStore.getState().startSwingPath(clip.id);
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 3, price: 100 });
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 8, price: 120 });

    const first = materialise(authoredSeries());
    useStore.getState().moveSwingAnchor(clip.id, anchorIdByPrice(120), { price: 130 });
    const moved = materialise(authoredSeries());

    // Moving back to the same place gives the same bars: the path and the
    // seed are the only inputs.
    useStore.getState().moveSwingAnchor(clip.id, anchorIdByPrice(130), { price: 120 });
    const returned = materialise(authoredSeries());

    expect(moved.map((b) => b.c)).not.toEqual(first.map((b) => b.c));
    expect(returned.map((b) => b.c)).toEqual(first.map((b) => b.c));
  });

  it('undoes an anchor move back to the previous path', () => {
    chartProject();
    const clip = chartClip();
    useStore.getState().startSwingPath(clip.id);
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 3, price: 100 });
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 8, price: 120 });

    useStore.getState().moveSwingAnchor(clip.id, anchorIdByPrice(120), { price: 130 });
    const moved = authoredSeries();
    if (moved?.origin !== 'authored-path') throw new Error('expected an authored path');
    expect(moved.path.anchors.some((a) => a.price === 130)).toBe(true);

    useStore.getState().undo();
    const after = authoredSeries();
    if (after?.origin !== 'authored-path') throw new Error('expected an authored path');
    expect(after.path.anchors.some((a) => a.price === 120)).toBe(true);
  });

  it('keeps the series seed across an anchor move', () => {
    chartProject();
    const clip = chartClip();
    useStore.getState().startSwingPath(clip.id);
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 3, price: 100 });
    useStore.getState().addSwingAnchor(clip.id, { barIndex: 8, price: 120 });

    const before = authoredSeries();
    if (before?.origin !== 'authored-path') throw new Error('expected an authored path');
    useStore.getState().moveSwingAnchor(clip.id, anchorIdByPrice(120), { price: 130 });
    const after = authoredSeries();
    if (after?.origin !== 'authored-path') throw new Error('expected an authored path');

    expect(after.seed).toBe(before.seed);
  });
});

describe('store — the drawing tools', () => {
  const chartProject = (): void => {
    useStore.getState().addClip('candlestickChart', 't-empty', 0);
  };

  const chartClip = () => {
    const clips = useStore.getState().project.tracks.flatMap((t) => t.clips);
    return clips.find((clip) => clip.element === 'candlestickChart')!;
  };

  beforeEach(() => {
    useStore.setState({
      project: emptyProject(),
      selectedClipIds: [],
      history: [],
      future: [],
      workspaceId: null,
      workspaceRevision: null,
      swingPath: null,
      drawingTool: null,
    });
  });

  it('creates a price line as a clip anchored to a chart and a pane', () => {
    chartProject();
    const chart = chartClip();
    useStore.getState().ensureChartMarket(chart.id);

    const id = useStore
      .getState()
      .addDrawing('priceLine', chart.id, `${chart.id}-pane-0`, {
        price: { kind: 'price', price: 4200 },
      });

    const clip = useStore.getState().project.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
    expect(clip?.element).toBe('priceLine');
    expect(clip?.props.chartClipId).toBe(chart.id);
    expect(clip?.props.paneId).toBe(`${chart.id}-pane-0`);
    expect(clip?.props.anchors).toEqual({ price: { kind: 'price', price: 4200 } });
  });

  it('duplicates a drawing without sharing its anchors', () => {
    chartProject();
    const chart = chartClip();
    useStore.getState().ensureChartMarket(chart.id);
    const id = useStore
      .getState()
      .addDrawing('priceLine', chart.id, `${chart.id}-pane-0`, {
        price: { kind: 'price', price: 4200 },
      });

    useStore.setState({ selectedClipIds: [id] });
    useStore.getState().duplicateSelection();

    const drawings = useStore
      .getState()
      .project.tracks.flatMap((t) => t.clips)
      .filter((c) => c.element === 'priceLine');
    expect(drawings).toHaveLength(2);

    const original = drawings.find((c) => c.id === id)!;
    const copy = drawings.find((c) => c.id !== id)!;
    expect(copy.props.anchors).toEqual(original.props.anchors);
    expect(copy.props.anchors).not.toBe(original.props.anchors);
  });

  it('locks and hides a drawing', () => {
    chartProject();
    const chart = chartClip();
    useStore.getState().ensureChartMarket(chart.id);
    const id = useStore
      .getState()
      .addDrawing('priceLine', chart.id, `${chart.id}-pane-0`, {
        price: { kind: 'price', price: 4200 },
      });

    useStore.getState().setDrawingLocked(id, true);
    useStore.getState().setDrawingHidden(id, true);

    const clip = useStore.getState().project.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
    expect(clip?.locked).toBe(true);
    expect(clip?.hidden).toBe(true);
  });

  it('undoes a drawing deletion', () => {
    chartProject();
    const chart = chartClip();
    useStore.getState().ensureChartMarket(chart.id);
    const id = useStore
      .getState()
      .addDrawing('priceLine', chart.id, `${chart.id}-pane-0`, {
        price: { kind: 'price', price: 4200 },
      });

    useStore.setState({ selectedClipIds: [id] });
    useStore.getState().removeClips([id]);

    const drawings = useStore
      .getState()
      .project.tracks.flatMap((t) => t.clips)
      .filter((c) => c.element === 'priceLine');
    expect(drawings).toHaveLength(0);

    useStore.getState().undo();
    const restored = useStore
      .getState()
      .project.tracks.flatMap((t) => t.clips)
      .filter((c) => c.element === 'priceLine');
    expect(restored).toHaveLength(1);
  });
});
