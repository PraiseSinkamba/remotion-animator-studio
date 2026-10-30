import { describe, expect, it } from 'vitest';

import { materialiseSeries, seriesRevision, type SeriesSpec } from './series';
import { moveSwingAnchor } from './path';

type ManualSpec = Extract<SeriesSpec, { origin: 'manual' }>;
type AuthoredSpec = Extract<SeriesSpec, { origin: 'authored-path' }>;

const manualSpec = (): ManualSpec => ({
  id: 'series-a',
  origin: 'manual',
  label: 'Manual series',
  timeBasis: 'logical',
  bars: [
    { id: 'x', t: 20, o: 10, h: 12, l: 9, c: 11 },
    { id: 'x', t: 10, o: 9, h: 11, l: 8, c: 10 },
  ],
});

const authoredSpec = (): AuthoredSpec => ({
  id: 'series-b',
  origin: 'authored-path',
  label: 'Authored path',
  timeBasis: 'logical',
  seed: 'seed-b',
  algorithmVersion: 1,
  path: {
    anchors: [
      { id: 'a0', barIndex: 0, price: 100 },
      { id: 'a1', barIndex: 10, price: 120 },
      { id: 'a2', barIndex: 20, price: 95 },
    ],
  },
});

describe('materialiseSeries', () => {
  it('materialises a manual series into a datasource with stable bar ids', () => {
    const datasource = materialiseSeries(manualSpec());
    expect(datasource.id).toBe('series-a');
    expect(datasource.origin).toBe('manual');
    expect(datasource.bars.map((bar) => bar.id)).toEqual(['series-a:0', 'series-a:1']);
  });

  it('keeps the materialised bars ascending by time', () => {
    const datasource = materialiseSeries(manualSpec());
    const times = datasource.bars.map((bar) => bar.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('materialises an authored path into bars whose anchor bars close at the placed price', () => {
    const datasource = materialiseSeries(authoredSpec());
    expect(datasource.origin).toBe('authored-path');
    expect(datasource.bars[0].c).toBe(100);
    expect(datasource.bars[10].c).toBe(120);
    expect(datasource.bars[20].c).toBe(95);
  });

  it('materialises an imported series as stored', () => {
    const spec: SeriesSpec = {
      id: 'series-c',
      origin: 'imported',
      label: 'Imported',
      timeBasis: 'utc',
      revision: 'upstream-revision',
      bars: [{ id: 'i0', t: 1_700_000_000_000, o: 10, h: 12, l: 9, c: 11 }],
    };
    const datasource = materialiseSeries(spec);
    expect(datasource.origin).toBe('imported');
    expect(datasource.bars).toHaveLength(1);
    expect(datasource.bars[0].o).toBe(10);
    expect(datasource.bars[0].t).toBe(1_700_000_000_000);
  });

  it('materialises a synthetic series from its generator settings', () => {
    const spec: SeriesSpec = {
      id: 'series-d',
      origin: 'synthetic',
      label: 'Synthetic',
      timeBasis: 'logical',
      seed: 'seed-d',
      algorithmVersion: 1,
      generator: { count: 6, startPrice: 100, timeframeMs: 60_000 },
    };
    const datasource = materialiseSeries(spec);
    expect(datasource.bars).toHaveLength(6);
    expect(datasource.bars[0].id).toBe('series-d:0');
  });
});

describe('seriesRevision', () => {
  it('gives the same revision for the same spec', () => {
    expect(seriesRevision(manualSpec())).toBe(seriesRevision(manualSpec()));
  });

  it('changes the revision when a bar changes', () => {
    const before = seriesRevision(manualSpec());
    const changed = manualSpec();
    const bars = [...changed.bars];
    bars[0] = { ...bars[0], c: 999 };
    const after = seriesRevision({ ...changed, bars });
    expect(after).not.toBe(before);
  });

  it('changes the revision when the seed changes', () => {
    const before = seriesRevision(authoredSpec());
    const after = seriesRevision({ ...authoredSpec(), seed: 'other-seed' });
    expect(after).not.toBe(before);
  });

  it('changes the revision when an anchor moves', () => {
    const before = seriesRevision(authoredSpec());
    const moved = moveSwingAnchor(authoredSpec().path, 'a1', { price: 125 });
    const after = seriesRevision({ ...authoredSpec(), path: moved });
    expect(after).not.toBe(before);
  });

  it('keeps the revision when the same path is materialised twice', () => {
    const spec = authoredSpec();
    expect(seriesRevision(spec)).toBe(seriesRevision(spec));
    expect(materialiseSeries(spec).revision).toBe(materialiseSeries(spec).revision);
  });

  it('ignores the bar ids, so the same content shares a revision', () => {
    const renamed = manualSpec();
    const bars = renamed.bars.map((bar) => ({ ...bar, id: 'completely-different' }));
    expect(seriesRevision({ ...renamed, bars })).toBe(seriesRevision(manualSpec()));
  });
});
