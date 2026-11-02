/**
 * The transition components.
 *
 * A transition belongs to the boundary between two adjacent clips on a track,
 * not to a clip. It is a registry component like any other — its own element
 * type, its own defaults — but it renders **only** in the composition, over
 * the cut between the two clips. Nothing an editor draws for it ever reaches
 * the render path.
 *
 * A transition never shifts a clip and never duplicates a clip's content:
 * the outgoing clip fades over its own tail and the incoming clip comes in
 * over its own head. That is why a true simultaneous dissolve is not
 * possible here — two images of the same instant would need one of them
 * duplicated or one of the clips retimed.
 */

import React from 'react';

import { registerComponent, createPropsValidator, type TransitionBlend, type VideoComponentDefinition } from '@chart-studio/core';

/** The props a transition component is given. */
interface TransitionComponentProps {
  fromClip: { from: number; durationInFrames: number };
  toClip: { from: number; durationInFrames: number };
  durationInFrames: number;
}

/** The frames before the cut — the outgoing clip's share of the transition. */
const beforeCut = (durationInFrames: number): number => Math.floor(Math.max(0, durationInFrames) / 2);

/**
 * The crossfade.
 *
 * The outgoing clip fades out over the first half of the transition — the
 * tail of its own frames — and the incoming clip fades in over the second
 * half, the head of its own frames. The cut is a fade through: at no point
 * are both clips half visible at once, because that would need one of them
 * shown outside its own frames.
 */
const crossfade: VideoComponentDefinition = {
  renderMode: 'transition',
  type: 'crossfade',
  label: 'Crossfade',
  icon: '◐',
  description: 'The outgoing clip fades out over its tail and the incoming clip fades in over its head.',
  category: 'base',
  defaults: {},
  params: [],
  evaluate: ({ clip, props, sceneFrame }): TransitionBlend => {
    const p = props as unknown as TransitionComponentProps;
    const duration = Math.max(1, p.durationInFrames ?? 1);
    const before = beforeCut(duration);
    const after = duration - before;
    const frame = sceneFrame - clip.from;

    const fromOpacity =
      before > 0 ? 1 - Math.min(1, Math.max(0, frame) / before) : 1;
    const toOpacity =
      after > 0 ? Math.min(1, Math.max(0, (frame - before) / after)) : 1;

    return { fromOpacity, toOpacity };
  },
  // The transition draws the two clips; it draws nothing itself.
  render: () => null,
};

/**
 * The wipe.
 *
 * The incoming clip is revealed across its own head, edge first, while the
 * outgoing clip stays as it is until the wipe reaches it. The reveal is a
 * clip path, so the incoming clip's own content is never touched.
 */
const wipe: VideoComponentDefinition = {
  renderMode: 'transition',
  type: 'wipe',
  label: 'Wipe',
  icon: '▚',
  description: 'The incoming clip is revealed edge first over its own head.',
  category: 'base',
  defaults: {},
  params: [],
  evaluate: ({ clip, props, sceneFrame }): TransitionBlend => {
    const p = props as unknown as TransitionComponentProps;
    const duration = Math.max(1, p.durationInFrames ?? 1);
    const before = beforeCut(duration);
    const after = duration - before;
    const frame = sceneFrame - clip.from;

    const progress = after > 0 ? Math.min(1, Math.max(0, (frame - before) / after)) : 1;

    return {
      fromOpacity: 1,
      toOpacity: 1,
      // The revealed fraction grows from the left edge.
      toClipPath: `inset(0 ${((1 - progress) * 100).toFixed(3)}% 0 0)`,
    };
  },
  render: () => null,
};

crossfade.validateProps = createPropsValidator(crossfade.defaults, crossfade.params);
registerComponent(crossfade);
wipe.validateProps = createPropsValidator(wipe.defaults, wipe.params);
registerComponent(wipe);

export { crossfade, wipe };
export const TRANSITION_TYPES = ['crossfade', 'wipe'] as const;
