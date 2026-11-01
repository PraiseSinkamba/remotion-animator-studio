import { describe, expect, it } from 'vitest';
import { materialiseSeries } from '@chart-studio/core';
import { authoredPathProject, AUTHORED_SERIES_ID } from '../remotion/authored-path-fixture';

describe('the authored path verification fixture', () => {
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

  it('is a schema version 3 document', () => {
    expect(authoredPathProject.schemaVersion).toBe(3);
  });

  it('carries the drawings as independent elements', () => {
    const clips = authoredPathProject.tracks[0].clips;
    const line = clips.find((clip) => clip.id === 'c-horizontal-line');
    const trend = clips.find((clip) => clip.id === 'c-trendline');

    expect(line?.element).toBe('horizontalLine');
    expect(line?.props.caption).toBe('100.5');
    expect(line?.props.chartClipId).toBeUndefined();
    expect(line?.props.anchors).toBeUndefined();

    expect(trend?.element).toBe('trendline');
    expect(trend?.props.points).toEqual({
      start: { x: 0.05, y: 0.95 },
      end: { x: 0.15, y: 0.93 },
    });
    expect(trend?.props.chartClipId).toBeUndefined();
    expect(trend?.props.anchors).toBeUndefined();
  });
});
