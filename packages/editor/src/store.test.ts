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

  it('creates a horizontal line as an independent clip', () => {
    chartProject();
    useStore.getState().ensureChartMarket(chartClip().id);

    const id = useStore.getState().addDrawing('horizontalLine', {
      x: 500,
      y: 300,
      width: 480,
      height: 24,
    });

    const clip = useStore.getState().project.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
    expect(clip?.element).toBe('horizontalLine');
    // The drawing owns its box: no chart, no pane, no anchors.
    expect(clip?.props.x).toBe(500);
    expect(clip?.props.y).toBe(300);
    expect(clip?.props.width).toBe(480);
    expect(clip?.props.height).toBe(24);
    expect(clip?.props.chartClipId).toBeUndefined();
    expect(clip?.props.paneId).toBeUndefined();
    expect(clip?.props.anchors).toBeUndefined();
  });

  it('duplicates a drawing without sharing its points', () => {
    chartProject();
    useStore.getState().ensureChartMarket(chartClip().id);
    const id = useStore.getState().addDrawing('trendline', {
      x: 500,
      y: 300,
      width: 320,
      height: 180,
      points: { start: { x: 0.1, y: 0.2 }, end: { x: 0.8, y: 0.9 } },
    });

    useStore.setState({ selectedClipIds: [id] });
    useStore.getState().duplicateSelection();

    const drawings = useStore
      .getState()
      .project.tracks.flatMap((t) => t.clips)
      .filter((c) => c.element === 'trendline');
    expect(drawings).toHaveLength(2);

    const original = drawings.find((c) => c.id === id)!;
    const copy = drawings.find((c) => c.id !== id)!;
    expect(copy.props.points).toEqual(original.props.points);
    expect(copy.props.points).not.toBe(original.props.points);
    expect(copy.props.points.start).not.toBe(original.props.points.start);
  });

  it('gives a new drawing its own frame range', () => {
    chartProject();
    const id = useStore.getState().addDrawing('horizontalLine', {
      x: 500,
      y: 300,
      width: 480,
      height: 24,
      from: 40,
      durationInFrames: 60,
    });

    const clip = useStore.getState().project.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
    expect(clip?.from).toBe(40);
    expect(clip?.durationInFrames).toBe(60);
  });

  it('locks and hides a drawing', () => {
    chartProject();
    const id = useStore.getState().addDrawing('horizontalLine', {
      x: 500,
      y: 300,
      width: 480,
      height: 24,
    });

    useStore.getState().setClipLocked(id, true);
    useStore.getState().setClipHidden(id, true);

    const clip = useStore.getState().project.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
    expect(clip?.locked).toBe(true);
    expect(clip?.hidden).toBe(true);
  });

  it('undoes a drawing deletion', () => {
    chartProject();
    const id = useStore.getState().addDrawing('horizontalLine', {
      x: 500,
      y: 300,
      width: 480,
      height: 24,
    });

    useStore.setState({ selectedClipIds: [id] });
    useStore.getState().removeClips([id]);

    const drawings = useStore
      .getState()
      .project.tracks.flatMap((t) => t.clips)
      .filter((c) => c.element === 'horizontalLine');
    expect(drawings).toHaveLength(0);

    useStore.getState().undo();
    const restored = useStore
      .getState()
      .project.tracks.flatMap((t) => t.clips)
      .filter((c) => c.element === 'horizontalLine');
    expect(restored).toHaveLength(1);
  });
});

describe('store — the pause points of a pane', () => {
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

  /** A chart with the market it needs, and the pane that market gives it. */
  const chartWithPane = (): { clipId: string; paneId: string } => {
    useStore.getState().addClip('candlestickChart', 't-empty', 0);
    const clip = useStore
      .getState()
      .project.tracks.flatMap((t) => t.clips)
      .find((c) => c.element === 'candlestickChart')!;
    useStore.getState().ensureChartMarket(clip.id);
    return { clipId: clip.id, paneId: `${clip.id}-pane-0` };
  };

  /** The pane as the project holds it. */
  const pane = (clipId: string, paneId: string) => {
    const clip = useStore
      .getState()
      .project.tracks.flatMap((t) => t.clips)
      .find((c) => c.id === clipId)!;
    const panes = clip.props.panes as Array<{ id: string; holds?: unknown[]; zoom?: unknown }>;
    return panes.find((entry) => entry.id === paneId)!;
  };

  it('adds a hold to a pane and undoes it', () => {
    const { clipId, paneId } = chartWithPane();

    useStore.getState().addHold(clipId, paneId, 'series-1:2', 30, 60);
    expect(pane(clipId, paneId).holds).toEqual([{ barId: 'series-1:2', in: 30, out: 60 }]);

    useStore.getState().undo();
    expect(pane(clipId, paneId).holds ?? []).toEqual([]);
  });

  it('changes and removes a hold, one undo step each', () => {
    const { clipId, paneId } = chartWithPane();
    useStore.getState().addHold(clipId, paneId, 'series-1:2', 30, 60);

    useStore.getState().updateHold(clipId, paneId, 'series-1:2', { out: 90 });
    expect(pane(clipId, paneId).holds).toEqual([{ barId: 'series-1:2', in: 30, out: 90 }]);

    useStore.getState().removeHold(clipId, paneId, 'series-1:2');
    expect(pane(clipId, paneId).holds ?? []).toEqual([]);
  });

  it('replaces the camera zoom track of a pane', () => {
    const { clipId, paneId } = chartWithPane();
    const track = {
      segments: [
        { in: 0, out: 60, from: { aggregation: 1, fromBar: 0 }, to: { aggregation: 5, fromBar: 20 } },
      ],
    };

    useStore.getState().updateZoomTrack(clipId, paneId, track);
    expect(pane(clipId, paneId).zoom).toEqual(track);

    useStore.getState().undo();
    expect(pane(clipId, paneId).zoom ?? null).toBeNull();
  });
});

describe('store — the transitions', () => {
  const twoClips = () => {
    useStore.getState().addClip('text', 't-empty', 0);
    const first = useStore.getState().project.tracks[0].clips[0];
    // The second clip starts exactly where the first ends, so they meet.
    useStore.getState().addClip('text', 't-empty', first.from + first.durationInFrames);
    return useStore.getState().project.tracks[0];
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

  it('adds a transition between two adjacent clips', () => {
    const track = twoClips();
    const [from, to] = track.clips;

    useStore.getState().addTransition(track.id, from.id, to.id, 'crossfade');

    const updated = useStore.getState().project.tracks[0];
    expect(updated.transitions).toHaveLength(1);
    expect(updated.transitions?.[0].fromClipId).toBe(from.id);
    expect(updated.transitions?.[0].toClipId).toBe(to.id);
    expect(updated.transitions?.[0].element).toBe('crossfade');
  });

  it('refuses a transition between clips that do not meet', () => {
    useStore.getState().addClip('text', 't-empty', 0);
    const first = useStore.getState().project.tracks[0].clips[0];
    useStore.getState().addClip('text', 't-empty', first.from + first.durationInFrames + 10);
    const track = useStore.getState().project.tracks[0];
    const [from, to] = track.clips;

    useStore.getState().addTransition(track.id, from.id, to.id, 'crossfade');

    expect(useStore.getState().project.tracks[0].transitions ?? []).toHaveLength(0);
  });

  it('undoes a transition', () => {
    const track = twoClips();
    const [from, to] = track.clips;

    useStore.getState().addTransition(track.id, from.id, to.id, 'crossfade');
    expect(useStore.getState().project.tracks[0].transitions).toHaveLength(1);

    useStore.getState().undo();
    expect(useStore.getState().project.tracks[0].transitions ?? []).toHaveLength(0);
  });
});

describe('store — the duration mode', () => {
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

  it('switches the duration mode and keeps the fixed length', () => {
    useStore.getState().setFixedDuration(10);
    expect(useStore.getState().project.durationInFrames).toBe(300);

    useStore.getState().setDurationMode('derived');
    expect(useStore.getState().project.durationMode).toBe('derived');
    // The author's own number is kept, so switching back keeps it.
    expect(useStore.getState().project.durationInFrames).toBe(300);

    useStore.getState().setDurationMode('fixed');
    expect(useStore.getState().project.durationMode).toBe('fixed');
    expect(useStore.getState().project.durationInFrames).toBe(300);
  });
});

describe('store — holding the market', () => {
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

  it('holds the pane on a bar and releases it again', () => {
    useStore.getState().addClip('candlestickChart', 't-empty', 0);
    const clip = useStore.getState().project.tracks[0].clips[0];
    useStore.getState().ensureChartMarket(clip.id);
    const market = useStore.getState().project.tracks[0].clips[0];
    const pane = market.props.panes[0];

    useStore.getState().togglePaneHold(market.id, pane.id, 'series-x:3');

    const held = useStore.getState().project.tracks[0].clips[0].props.panes[0].holds;
    expect(held).toHaveLength(1);
    expect(held[0].barId).toBe('series-x:3');

    useStore.getState().togglePaneHold(market.id, pane.id, 'series-x:3');
    const released = useStore.getState().project.tracks[0].clips[0].props.panes[0].holds;
    expect(released).toHaveLength(0);
  });
});

describe('store — the notice', () => {
  it('holds no notice by default', () => {
    expect(useStore.getInitialState().notice).toBeNull();
  });

  it('holds the message the creator is shown, and lets it go again', () => {
    useStore.getState().setNotice('A drawing needs a chart.');
    expect(useStore.getState().notice).toBe('A drawing needs a chart.');

    useStore.getState().setNotice(null);
    expect(useStore.getState().notice).toBeNull();
  });
});

describe('store — placing a drawing on a chart', () => {
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

  it('creates a drawing that needs no chart to resolve', () => {
    useStore.getState().addClip('candlestickChart', 't-empty', 0);
    const chart = useStore.getState().project.tracks[0].clips[0];

    const id = useStore.getState().addDrawing('horizontalLine', {
      x: 960,
      y: 540,
      width: 480,
      height: 24,
    });

    expect(id).not.toBe('');
    const drawing = useStore.getState().project.tracks[0].clips.find((c) => c.id === id);
    expect(drawing?.element).toBe('horizontalLine');
    expect(drawing?.props.chartClipId).toBeUndefined();
    expect(drawing?.props.width).toBe(480);
  });
});

describe('store — where a new drawing lands', () => {
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
      currentFrame: 0,
    });
  });

  /** A project with two tracks, so the track rule can be told apart. */
  const twoTracks = (): void => {
    useStore.setState({
      project: {
        ...useStore.getState().project,
        tracks: [
          { id: 't-top', name: 'Top', clips: [] },
          { id: 't-bottom', name: 'Bottom', clips: [] },
        ],
      },
    });
  };

  const draft = (extra: Record<string, unknown> = {}) => ({
    x: 960,
    y: 540,
    width: 480,
    height: 24,
    ...extra,
  });

  it('puts a new drawing on the track above the chart it was dropped on', () => {
    twoTracks();
    useStore.getState().addClip('candlestickChart', 't-bottom', 0);
    const chart = useStore.getState().project.tracks[1].clips[0];

    const id = useStore.getState().addDrawing('horizontalLine', draft({ trackId: 't-bottom' }));

    const tracks = useStore.getState().project.tracks;
    expect(tracks[1].clips.some((c) => c.id === id)).toBe(false);
    expect(tracks[0].clips.some((c) => c.id === id)).toBe(true);
    expect(chart.element).toBe('candlestickChart');
  });

  it("puts a new drawing on the chart's own track when the chart is already on the top layer", () => {
    twoTracks();
    useStore.getState().addClip('candlestickChart', 't-top', 0);

    const id = useStore.getState().addDrawing('horizontalLine', draft({ trackId: 't-top' }));

    const tracks = useStore.getState().project.tracks;
    expect(tracks[0].clips.some((c) => c.id === id)).toBe(true);
    // appended, so it draws above the chart already there
    expect(tracks[0].clips[tracks[0].clips.length - 1].id).toBe(id);
  });

  it("falls back to the selected clip's track", () => {
    twoTracks();
    useStore.getState().addClip('text', 't-bottom', 0);
    const text = useStore.getState().project.tracks[1].clips[0];
    useStore.setState({ selectedClipIds: [text.id] });

    const id = useStore.getState().addDrawing('horizontalLine', draft());

    const tracks = useStore.getState().project.tracks;
    expect(tracks[1].clips.some((c) => c.id === id)).toBe(true);
    expect(tracks[0].clips.some((c) => c.id === id)).toBe(false);
  });

  it('falls back to the first track when nothing is selected', () => {
    twoTracks();

    const id = useStore.getState().addDrawing('horizontalLine', draft());

    const tracks = useStore.getState().project.tracks;
    expect(tracks[0].clips.some((c) => c.id === id)).toBe(true);
  });

  it('gives a new drawing its own frame range starting at the current frame', () => {
    useStore.setState({ currentFrame: 40 });

    const id = useStore.getState().addDrawing('horizontalLine', draft());

    const drawing = useStore.getState().project.tracks[0].clips.find((c) => c.id === id);
    expect(drawing?.from).toBe(40);
    expect(drawing?.durationInFrames).toBe(90);
  });
});

describe('store — the layer order, the lock and the rename', () => {
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
      renameClipId: null,
    });
  });

  /** A project with two tracks, so the layer order can be told apart. */
  const twoTracks = (): void => {
    useStore.setState({
      project: {
        ...useStore.getState().project,
        tracks: [
          { id: 't-top', name: 'Top', clips: [] },
          { id: 't-bottom', name: 'Bottom', clips: [] },
        ],
      },
    });
  };

  const addText = (trackId: string): string => {
    useStore.getState().addClip('text', trackId, 0);
    const clip = useStore
      .getState()
      .project.tracks.find((t) => t.id === trackId)?.clips.slice(-1)[0];
    if (!clip) throw new Error('the clip was not created');
    return clip.id;
  };

  it('brings a clip to the front of the top layer', () => {
    twoTracks();
    const id = addText('t-bottom');

    useStore.getState().bringToFront(id);

    const tracks = useStore.getState().project.tracks;
    expect(tracks[0].clips.map((c) => c.id)).toContain(id);
    expect(tracks[1].clips.map((c) => c.id)).not.toContain(id);
    // the top layer draws last, so it is on top of everything
    expect(tracks[0].clips[tracks[0].clips.length - 1].id).toBe(id);
  });

  it('sends a clip behind every other clip', () => {
    twoTracks();
    const id = addText('t-top');
    const other = addText('t-top');

    useStore.getState().sendToBack(id);

    const tracks = useStore.getState().project.tracks;
    expect(tracks[1].clips.map((c) => c.id)).toContain(id);
    expect(tracks[0].clips.map((c) => c.id)).not.toContain(id);
    // the bottom track draws first, so the first clip there is behind
    expect(tracks[1].clips[0].id).toBe(id);
    // the other clip keeps its own track, and that track draws above the
    // bottom one, so it still draws over the clip that was sent back
    expect(tracks[0].clips.map((c) => c.id)).toContain(other);
  });

  it('keeps a locked clip selectable on the timeline but not on the canvas', () => {
    const id = addText('t-empty');

    useStore.getState().setClipLocked(id, true);

    const clip = useStore.getState().project.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
    expect(clip?.locked).toBe(true);
    // the clip is still in the project, so the timeline still shows it
    expect(useStore.getState().project.tracks.flatMap((t) => t.clips).length).toBe(1);
  });

  it('keeps a hidden clip in the project until it is unhidden', () => {
    const id = addText('t-empty');

    useStore.getState().setClipHidden(id, true);
    expect(
      useStore.getState().project.tracks.flatMap((t) => t.clips).find((c) => c.id === id)?.hidden,
    ).toBe(true);

    useStore.getState().setClipHidden(id, false);
    const clip = useStore.getState().project.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
    expect(clip?.hidden).toBe(false);
    expect(clip).toBeTruthy();
  });

  it('requests a rename for the selected clip', () => {
    const id = addText('t-empty');

    useStore.getState().requestRename(id);

    expect(useStore.getState().renameClipId).toBe(id);
    expect(useStore.getState().selectedClipIds).toEqual([id]);

    useStore.getState().clearRenameRequest();
    expect(useStore.getState().renameClipId).toBeNull();
  });
});

describe('atomic unlocked edits', () => {
 it('keeps locked clips unchanged and publishes a batch once', () => {
  useStore.setState({project:emptyProject()});
  useStore.getState().addClip('shape','t-empty',0);
  useStore.getState().addClip('shape','t-empty',0);
  const [a,b] = useStore.getState().project.tracks[0].clips;
  useStore.getState().setClipLocked(b.id,true);
  const original = useStore.getState().project.tracks[0].clips[1];
  let count=0;
  const unsub=useStore.subscribe(()=>count++);
  useStore.getState().updateClipsProps([{clipId:a.id,patch:{x:800}},{clipId:b.id,patch:{x:800}}]);
  unsub();
  expect(count).toBe(1);
  expect(useStore.getState().project.tracks[0].clips[0].props.x).toBe(800);
  expect(useStore.getState().project.tracks[0].clips[1]).toBe(original);
  useStore.getState().updateClipProps(b.id,{x:900});
  expect(useStore.getState().project.tracks[0].clips[1]).toBe(original);
 });
});


describe('atomic validated props edits',()=>{
 it('retains project and history on invalid supplied values',()=>{
 useStore.setState({project:emptyProject(),history:[],future:[],notice:null});
 useStore.getState().addClip('shape','t-empty',0);
 const before=useStore.getState();const clip=before.project.tracks[0].clips[0];
 useStore.getState().updateClipProps(clip.id,{width:-100,x:'wrong'});
 const after=useStore.getState();expect(after.project).toBe(before.project);expect(after.history).toBe(before.history);expect(after.notice).toContain(clip.id);
 });
});

it('rejects an entire props batch when one unlocked member is invalid', () => {
  useStore.setState({project:emptyProject(),history:[],future:[],notice:null});
  useStore.getState().addClip('shape','t-empty',0);
  useStore.getState().addClip('shape','t-empty',0);
  const before=useStore.getState();const [first,second]=before.project.tracks[0].clips;
  useStore.getState().updateClipsProps([{clipId:first.id,patch:{x:20}},{clipId:second.id,patch:{height:'wrong'}}]);
  expect(useStore.getState().project).toBe(before.project);
  expect(useStore.getState().history).toBe(before.history);
  expect(useStore.getState().notice).toContain(second.id);
});

it('rejects chart enum and timing mutations without changing project or history',()=>{
 useStore.setState({project:emptyProject(),history:[],future:[],notice:null});
 useStore.getState().addClip('candlestickChart','t-empty',0);
 const before=useStore.getState();const clip=before.project.tracks[0].clips[0];
 for(const patch of [{revealMode:'unsupported'},{framesPerBar:0},{framesPerBar:-1}]) {
  useStore.getState().updateClipProps(clip.id,patch);
  expect(useStore.getState().project).toBe(before.project);expect(useStore.getState().history).toBe(before.history);
  expect(useStore.getState().notice).toMatch(/revealMode|framesPerBar/);
 }
});
