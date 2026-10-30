import { describe, expect, it } from 'vitest';
import { evaluateClip } from './evaluate';
import type { Clip, Project, VideoComponentDefinition } from '@chart-studio/core';

const PROJECT: Project = {
  name: 'Project',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#000000',
  tracks: [],
};

const CLIP: Clip = {
  id: 'c1',
  name: 'Clip',
  element: 'candlestickChart',
  from: 30,
  durationInFrames: 90,
  props: { seriesId: 'series-a' },
  effects: [],
};

const definitionWith = (
  evaluate: VideoComponentDefinition['evaluate'],
): VideoComponentDefinition => ({
  type: 'candlestickChart',
  label: 'Chart',
  icon: 'x',
  description: 'test',
  category: 'trading',
  defaults: {},
  params: [],
  render: () => null,
  evaluate,
});

describe('evaluateClip', () => {
  it('runs the definition evaluate step once per clip', () => {
    let calls = 0;
    const definition = definitionWith(() => {
      calls += 1;
      return 'evaluated';
    });

    const result = evaluateClip(definition, {
      clip: CLIP,
      props: CLIP.props,
      sceneFrame: 45,
      project: PROJECT,
    });

    expect(calls).toBe(1);
    expect(result).toBe('evaluated');
  });

  it('returns undefined when the definition has no evaluate step', () => {
    const definition = definitionWith(undefined);
    expect(
      evaluateClip(definition, {
        clip: CLIP,
        props: CLIP.props,
        sceneFrame: 45,
        project: PROJECT,
      }),
    ).toBeUndefined();
  });

  it('passes the scene frame and the project snapshot to evaluate', () => {
    let seen: { sceneFrame: number; project: Project } | undefined;
    const definition = definitionWith((input) => {
      seen = { sceneFrame: input.sceneFrame, project: input.project };
      return null;
    });

    evaluateClip(definition, {
      clip: CLIP,
      props: CLIP.props,
      sceneFrame: 45,
      project: PROJECT,
    });

    expect(seen?.sceneFrame).toBe(45);
    expect(seen?.project).toBe(PROJECT);
  });

  it('gives the same evaluated value for the same frame regardless of seek order', () => {
    const definition = definitionWith(({ sceneFrame }) => `frame-${sceneFrame - 30}`);
    const frames = [30, 31, 32, 33];

    const visit = (order: number[]) =>
      Object.fromEntries(
        order.map((sceneFrame) => [
          sceneFrame,
          evaluateClip(definition, { clip: CLIP, props: CLIP.props, sceneFrame, project: PROJECT }),
        ]),
      );

    const forwards = visit(frames);
    const backwards = visit([...frames].reverse());

    expect(backwards).toEqual(forwards);
    expect(forwards[30]).toBe('frame-0');
    expect(forwards[33]).toBe('frame-3');
  });
});
