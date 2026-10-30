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
    expect(clip.props.panes).toHaveLength(1);
  });
});
