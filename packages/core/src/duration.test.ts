import { describe, expect, it } from 'vitest';

import { derivedDuration, effectiveDuration } from './duration';
import type { Clip, Project } from './schemas';

const clip = (id: string, from: number, durationInFrames: number, extra = {}): Clip => ({
  id,
  name: id,
  element: 'text',
  from,
  durationInFrames,
  props: {},
  effects: [],
  ...extra,
});

const project = (clips: Clip[], durationInFrames = 240, durationMode?: 'derived' | 'fixed'): Project => ({
  name: 'Project',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames,
  backgroundColor: '#000000',
  tracks: [{ id: 't1', name: 'Track 1', clips }],
  ...(durationMode ? { durationMode } : {}),
});

describe('derivedDuration', () => {
  it('derives the duration from the longest clip', () => {
    const subject = project([clip('a', 0, 90), clip('b', 90, 150), clip('c', 240, 30)]);
    expect(derivedDuration(subject)).toBe(270);
  });

  it('includes the chart elements out frames', () => {
    const chart = clip('chart', 0, 60, {
      element: 'candlestickChart',
      props: { panes: [{ out: 200 }, { out: 120 }] },
    });
    expect(derivedDuration(project([chart]))).toBe(200);
  });

  it('clamps a derived duration to at least one frame', () => {
    expect(derivedDuration(project([]))).toBe(1);
  });
});

describe('effectiveDuration', () => {
  it('leaves a fixed duration alone', () => {
    const subject = project([clip('a', 0, 90)], 300, 'fixed');
    expect(effectiveDuration(subject)).toBe(300);
  });

  it('derives the duration when the mode asks for it', () => {
    const subject = project([clip('a', 0, 90)], 300, 'derived');
    expect(effectiveDuration(subject)).toBe(90);
  });

  it('keeps the authored length for a legacy project with no mode', () => {
    const subject = project([clip('a', 0, 90)], 300);
    expect(effectiveDuration(subject)).toBe(300);
  });
});
