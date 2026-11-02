import { describe, expect, it } from 'vitest';
import { materialiseSeries } from '@chart-studio/core';
import { migrateProject } from '@chart-studio/components';
import { authoredPathProject, AUTHORED_SERIES_ID } from '../remotion/authored-path-fixture';

describe('the authored path verification fixture', () => {
  it('passes the same input boundary as the real Remotion render', () => {
    expect(() => migrateProject(authoredPathProject)).not.toThrow();
  });
  const series = authoredPathProject.series?.find((entry) => entry.id === AUTHORED_SERIES_ID);
  const anchors = series?.origin === 'authored-path' ? series.path.anchors : [];

  it('has three anchors', () => {
    expect(anchors).toHaveLength(3);
  });

  it('closes every anchor bar at the placed price exactly', () => {
    const datasource = materialiseSeries(series!);
    for (const anchor of anchors) {
      expect(datasource.bars[anchor.barIndex].c).toBe(anchor.price);
    }
  });

  it('gives every bar a non-zero range, including at an anchor', () => {
    const datasource = materialiseSeries(series!);
    for (const bar of datasource.bars) {
      expect(bar.h).toBeGreaterThan(bar.l);
    }
  });

  it('renders a chart that resolves the series through the project registry', () => {
    const clip = authoredPathProject.tracks[0].clips[0];
    expect(clip.element).toBe('candlestickChart');
    expect(clip.props.seriesId).toBe(AUTHORED_SERIES_ID);
    // The fixture carries the fine pane and the coarser rollup pane.
    expect(clip.props.panes).toHaveLength(2);
  });

  it('is a schema version 4 document', () => {
    expect(authoredPathProject.schemaVersion).toBe(4);
  });

  it('carries the drawings as independent elements', () => {
    const clips = authoredPathProject.tracks[0].clips;
    const line = clips.find((clip) => clip.id === 'c-horizontal-line');
    const trend = clips.find((clip) => clip.id === 'c-trendline');

    expect(line?.element).toBe('horizontalLine');
    expect(line?.props.caption).toBe('100.5');
    expect(line?.props.chartClipId).toBeUndefined();
    expect(line?.props.anchors).toBeUndefined();
    // The rule keeps its centre and its length, and no band of its own.
    expect(line?.props.width).toBe(1020);
    expect(line?.props.height).toBeUndefined();

    expect(trend?.element).toBe('trendline');
    // The line's two points are places in the composition.
    expect(trend?.props.points).toEqual({
      start: { x: 501, y: 918.6 },
      end: { x: 603, y: 908.44 },
    });
    // The shape is its points: the box it never used is gone.
    expect(trend?.props.x).toBeUndefined();
    expect(trend?.props.width).toBeUndefined();
    expect(trend?.props.chartClipId).toBeUndefined();
    expect(trend?.props.anchors).toBeUndefined();
  });
});
