import { describe, expect, it } from 'vitest';
import { packLanes } from './shared';

const clip = (id: string, from: number, durationInFrames: number) => ({ id, from, durationInFrames });

describe('packLanes', () => {
  it('keeps clips that do not overlap in one lane', () => {
    const lanes = packLanes([clip('a', 0, 10), clip('b', 10, 10), clip('c', 20, 10)]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(0);
    expect(lanes.get('c')).toBe(0);
  });

  it('separates overlapping clips into their own lane', () => {
    const lanes = packLanes([clip('a', 0, 20), clip('b', 10, 20)]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
  });

  it('packs a third clip into the first lane that is free again', () => {
    const lanes = packLanes([clip('a', 0, 20), clip('b', 10, 20), clip('c', 20, 10)]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
    expect(lanes.get('c')).toBe(0);
  });

  it('is stable for clips that start on the same frame', () => {
    const lanes = packLanes([clip('b', 0, 10), clip('a', 0, 10)]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
  });

  it('returns an empty map for a track without clips', () => {
    expect(packLanes([]).size).toBe(0);
  });
});
