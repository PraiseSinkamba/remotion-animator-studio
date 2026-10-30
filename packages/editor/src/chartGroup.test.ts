import { beforeEach, describe, expect, it } from 'vitest';

import { sampleProject, type ChartGroupSpec, type Project } from '@chart-studio/core';
import { useStore } from './store';
import { groupLayoutRects, PIP_SMALL } from './chartGroup';

const emptyProject = (): Project => ({
  ...sampleProject,
  tracks: [{ id: 't-empty', name: 'Track 1', clips: [] }],
});

const reset = () => {
  useStore.setState({
    project: emptyProject(),
    selectedClipIds: [],
    history: [],
    future: [],
    workspaceId: null,
    workspaceRevision: null,
  });
};

/** Two chart clips, side by side, in one track. */
const twoCharts = (): string[] => {
  const store = useStore.getState();
  store.addClip('candlestickChart', 't-empty', 0);
  store.addClip('candlestickChart', 't-empty', 0);
  const clips = useStore.getState().project.tracks.flatMap((t) => t.clips);
  const charts = clips.filter((c) => c.element === 'candlestickChart');
  // The group's box is the union of the charts' own boxes: two charts of
  // 400 wide at x 200 and x 600 make a 800 wide box.
  useStore.getState().updateClipProps(charts[0].id, { x: 200, y: 300, width: 400, height: 200 });
  useStore.getState().updateClipProps(charts[1].id, { x: 600, y: 300, width: 400, height: 200 });
  return charts.map((c) => c.id);
};

const chartProps = (id: string) => {
  const clip = useStore
    .getState()
    .project.tracks.flatMap((t) => t.clips)
    .find((c) => c.id === id)!;
  return clip.props as Record<string, any>;
};

const group = (): ChartGroupSpec | undefined => useStore.getState().project.chartGroups?.[0];

describe('store — the grouped chart', () => {
  beforeEach(reset);

  it('records the group on the project', () => {
    const [first, second] = twoCharts();
    const groupId = useStore.getState().addChartGroup([first, second], 'split-horizontal');

    expect(groupId).not.toBe('');
    expect(group()?.id).toBe(groupId);
    expect(group()?.chartClipIds).toEqual([first, second]);
    expect(group()?.layout).toBe('split-horizontal');
  });

  it('gives every chart the same clock', () => {
    const [first, second] = twoCharts();
    useStore.getState().addChartGroup([first, second], 'split-horizontal');

    const clock = group()?.clock;
    expect(clock).toBeDefined();
    expect(chartProps(first).clock).toEqual(clock);
    expect(chartProps(second).clock).toEqual(clock);
  });

  it('gives a chart without a market one, so it can host a pane', () => {
    const [first] = twoCharts();
    useStore.getState().addChartGroup([first], 'single');

    expect(typeof chartProps(first).seriesId).toBe('string');
    expect(Array.isArray(chartProps(first).panes)).toBe(true);
    expect(chartProps(first).panes).toHaveLength(1);
  });

  it('puts two charts side by side', () => {
    const [first, second] = twoCharts();
    useStore.getState().addChartGroup([first, second], 'split-horizontal');

    // The group box is the union of the two charts' boxes: 0..800 wide.
    expect(chartProps(first).x).toBe(200);
    expect(chartProps(first).width).toBe(400);
    expect(chartProps(first).y).toBe(300);
    expect(chartProps(first).height).toBe(200);
    expect(chartProps(second).x).toBe(600);
    expect(chartProps(second).width).toBe(400);
  });

  it('stacks two charts', () => {
    const [first, second] = twoCharts();
    useStore.getState().addChartGroup([first, second], 'split-vertical');

    expect(chartProps(first).y).toBe(250);
    expect(chartProps(first).height).toBe(100);
    expect(chartProps(second).y).toBe(350);
    expect(chartProps(second).height).toBe(100);
    expect(chartProps(first).x).toBe(400);
    expect(chartProps(second).x).toBe(400);
  });

  it('puts the small chart in the corner of the pip layout', () => {
    const [first, second] = twoCharts();
    useStore.getState().addChartGroup([first, second], 'pip');

    expect(chartProps(first).width).toBe(800);
    expect(chartProps(first).height).toBe(200);
    expect(chartProps(second).width).toBe(800 * PIP_SMALL);
    expect(chartProps(second).height).toBe(200 * PIP_SMALL);
    // The small chart sits in the bottom-right corner of the group box.
    expect(chartProps(second).x).toBe(800 - (800 * PIP_SMALL) / 2);
    expect(chartProps(second).y).toBe(400 - (200 * PIP_SMALL) / 2);
  });

  it('fills the box with a single chart', () => {
    const [first] = twoCharts();
    useStore.getState().addChartGroup([first], 'single');

    expect(chartProps(first).width).toBe(400);
    expect(chartProps(first).height).toBe(200);
    expect(chartProps(first).x).toBe(200);
  });

  it('moves the charts when the layout changes', () => {
    const [first, second] = twoCharts();
    const groupId = useStore.getState().addChartGroup([first, second], 'split-horizontal');
    useStore.getState().setChartGroupLayout(groupId, 'split-vertical');

    expect(group()?.layout).toBe('split-vertical');
    expect(chartProps(first).height).toBe(100);
    expect(chartProps(second).height).toBe(100);
    expect(chartProps(first).y).not.toBe(chartProps(second).y);
  });

  it('keeps the group box when the layout is applied again', () => {
    const [first, second] = twoCharts();
    const groupId = useStore.getState().addChartGroup([first, second], 'split-horizontal');
    const before = { x: chartProps(first).x, y: chartProps(first).y, width: chartProps(first).width };

    useStore.getState().setChartGroupLayout(groupId, 'split-horizontal');

    expect(chartProps(first).x).toBe(before.x);
    expect(chartProps(first).y).toBe(before.y);
    expect(chartProps(first).width).toBe(before.width);
  });

  it('gives the charts of a group a shared selection', () => {
    const [first, second] = twoCharts();
    useStore.getState().addChartGroup([first, second], 'split-horizontal');

    useStore.getState().selectClip(first);
    expect(useStore.getState().selectedClipIds).toEqual([first, second]);
  });

  it('undoes the grouping in one step', () => {
    const [first, second] = twoCharts();
    useStore.getState().addChartGroup([first, second], 'split-horizontal');

    useStore.getState().undo();

    expect(useStore.getState().project.chartGroups).toBeUndefined();
    expect(chartProps(first).width).toBe(400);
    expect(chartProps(second).width).toBe(400);
  });
});

describe('store — the grouped chart presets', () => {
  beforeEach(reset);

  /** The preset's charts, in the order the group holds them. */
  const groupCharts = () => {
    const project = useStore.getState().project;
    const clips = project.tracks.flatMap((t) => t.clips);
    return (project.chartGroups?.[0].chartClipIds ?? []).map(
      (id) => clips.find((c) => c.id === id)!.props as Record<string, any>,
    );
  };

  it('drops a split onto the timeline as one group', () => {
    useStore.getState().addPreset('chartSplitHorizontal', 0);

    const project = useStore.getState().project;
    const charts = project.tracks.flatMap((t) => t.clips).filter((c) => c.element === 'candlestickChart');
    expect(charts).toHaveLength(2);
    expect(project.chartGroups).toHaveLength(1);
    expect(project.chartGroups?.[0].layout).toBe('split-horizontal');
    expect(project.chartGroups?.[0].chartClipIds).toHaveLength(2);
    // The charts share the group's clock.
    expect(charts[0].props.clock).toEqual(project.chartGroups?.[0].clock);
    expect(charts[1].props.clock).toEqual(project.chartGroups?.[0].clock);
  });

  it('places the two charts of a horizontal split side by side', () => {
    useStore.getState().addPreset('chartSplitHorizontal', 0);

    const [first, second] = groupCharts();

    expect(first.x).toBeLessThan(second.x);
    expect(first.x + first.width / 2).toBeCloseTo(second.x - second.width / 2, 6);
    expect(first.width).toBeCloseTo(second.width, 6);
  });

  it('drops a pip as one group with a small chart in the corner', () => {
    useStore.getState().addPreset('chartPip', 0);

    const [first, second] = groupCharts();

    expect(useStore.getState().project.chartGroups?.[0].layout).toBe('pip');
    expect(second.width).toBeCloseTo(first.width * PIP_SMALL, 6);
    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBeGreaterThan(first.y);
  });
});

describe('the layout rectangles', () => {
  const box = { left: 100, top: 200, width: 800, height: 400 };

  it('tiles the box exactly', () => {
    for (const layout of ['split-horizontal', 'split-vertical'] as const) {
      const rects = groupLayoutRects(layout, 2, box);
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.left + r.width));
      const bottom = Math.max(...rects.map((r) => r.top + r.height));
      expect(left).toBe(box.left);
      expect(top).toBe(box.top);
      expect(right).toBe(box.left + box.width);
      expect(bottom).toBe(box.top + box.height);
    }
  });
});
