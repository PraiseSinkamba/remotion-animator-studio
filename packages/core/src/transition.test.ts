import { describe, expect, it } from 'vitest';

import { clampTransitionDuration, planTrackTransitions, transitionSplit } from './transition';
import type { Clip, Track, TrackTransition } from './schemas';

const clip = (id: string, from: number, durationInFrames: number): Clip => ({
  id,
  name: id,
  element: 'text',
  from,
  durationInFrames,
  props: {},
  effects: [],
});

const trackWith = (clips: Clip[], transitions?: Track['transitions']): Track => ({
  id: 't1',
  name: 'Track 1',
  clips,
  transitions,
});

describe('clampTransitionDuration', () => {
  it('clamps a transition to the shorter adjacent clip', () => {
    const from = clip('a', 0, 30);
    const to = clip('b', 30, 10);

    expect(clampTransitionDuration(from, to, 20)).toBe(10);
  });

  it('never lets a transition overlap the outgoing clip', () => {
    const from = clip('a', 0, 12);
    const to = clip('b', 12, 90);

    expect(clampTransitionDuration(from, to, 60)).toBe(12);
  });

  it('returns zero when no duration is asked for', () => {
    expect(clampTransitionDuration(clip('a', 0, 30), clip('b', 30, 30), 0)).toBe(0);
    expect(clampTransitionDuration(clip('a', 0, 30), clip('b', 30, 30), -5)).toBe(0);
  });

  it('keeps the clips own in and out frames', () => {
    const from = clip('a', 0, 30);
    const to = clip('b', 30, 30);
    const before = { ...from };
    const after = { ...to };

    clampTransitionDuration(from, to, 20);

    expect(from).toEqual(before);
    expect(to).toEqual(after);
  });
});

describe('transitionSplit', () => {
  it('centres the window on the cut', () => {
    expect(transitionSplit(10)).toEqual({ before: 5, after: 5 });
    expect(transitionSplit(11)).toEqual({ before: 5, after: 6 });
  });
});

describe('planTrackTransitions', () => {
  const transition: TrackTransition = {
    id: 'tr1',
    fromClipId: 'a',
    toClipId: 'b',
    element: 'crossfade',
    durationInFrames: 10,
  };

  it('plans a transition on a real boundary', () => {
    const track = trackWith([clip('a', 0, 30), clip('b', 30, 30)], [transition]);
    const plans = planTrackTransitions(track);

    expect(plans).toHaveLength(1);
    expect(plans[0].durationInFrames).toBe(10);
    expect(plans[0].start).toBe(25);
  });

  it('ignores a transition whose clips do not meet', () => {
    const track = trackWith([clip('a', 0, 30), clip('b', 40, 30)], [transition]);
    expect(planTrackTransitions(track)).toHaveLength(0);
  });

  it('clamps the planned duration to what the clips can give', () => {
    const track = trackWith([clip('a', 0, 30), clip('b', 30, 4)], [
      { ...transition, durationInFrames: 20 },
    ]);
    const plans = planTrackTransitions(track);

    expect(plans[0].durationInFrames).toBe(4);
  });
});
