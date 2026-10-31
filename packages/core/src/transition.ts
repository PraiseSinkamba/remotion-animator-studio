/**
 * Transitions at a clip boundary.
 *
 * A transition belongs to the boundary between two adjacent clips on a track,
 * not to a clip. It never touches the clips themselves: their in and out
 * frames stay what the creator set, so a transition cannot retime the market
 * history a chart shows (TL-006).
 *
 * The arithmetic lives here, in core, because the editor and the compositor
 * have to agree on it: the editor reports the clamp, the compositor renders
 * the clamped window.
 */

import type { Clip, Track, TrackTransition } from './schemas';
import type { ComponentProps } from './contract';

/** What a transition asks the compositor to do on one frame. */
export interface TransitionBlend {
  /** Opacity of the outgoing clip's layer. */
  fromOpacity: number;
  /** Opacity of the incoming clip's layer. */
  toOpacity: number;
  /** Clip path for the incoming clip's layer — a wipe reveals it. */
  toClipPath?: string;
}

/** How a transition's frames split over the two sides of the boundary. */
export interface TransitionSplit {
  /** Frames over the outgoing clip's tail. */
  before: number;
  /** Frames over the incoming clip's head. */
  after: number;
}

/** A transition laid out on one boundary of a track. */
export interface TransitionPlan {
  transition: TrackTransition;
  /** The clip that leaves. */
  fromClip: Clip;
  /** The clip that arrives. */
  toClip: Clip;
  /** The clamped duration, in frames. */
  durationInFrames: number;
  /** The first frame of the transition window. */
  start: number;
  /** Frames of the window over the outgoing clip's tail. */
  before: number;
  /** Frames of the window over the incoming clip's head. */
  after: number;
}

/**
 * The duration two adjacent clips can actually give a transition.
 *
 * The transition covers the outgoing clip's tail and the incoming clip's
 * head, so it may never be longer than the shorter of the two clips — a
 * transition that reached further would run past the outgoing clip's own
 * frames and take content that is not there. The compositor clamps to this
 * value and the inspector reports the clamp rather than overlapping a clip
 * silently (ADR-003).
 *
 * The clips are not touched: their own in and out frames stay as they are.
 */
export const clampTransitionDuration = (from: Clip, to: Clip, requested: number): number => {
  const limit = Math.min(from.durationInFrames, to.durationInFrames);
  const asked = Math.floor(requested);
  if (!Number.isFinite(asked) || asked <= 0) return 0;
  return Math.min(asked, limit);
};

/**
 * Splits a transition's frames over the two sides of the boundary.
 *
 * The window is centred on the cut: the outgoing clip fades out over the
 * first half and the incoming clip comes in over the second half.
 */
export const transitionSplit = (durationInFrames: number): TransitionSplit => {
  const duration = Math.max(0, Math.floor(durationInFrames));
  const before = Math.floor(duration / 2);
  return { before, after: duration - before };
};

/**
 * The transitions of a track that sit on a real boundary.
 *
 * Two clips meet when the second one starts exactly where the first one
 * ends. A transition on any other pair is ignored: there is no cut to
 * render.
 */
export const planTrackTransitions = (track: Track): TransitionPlan[] => {
  const clips = [...track.clips].sort((a, b) => a.from - b.from);
  const plans: TransitionPlan[] = [];
  for (let i = 0; i + 1 < clips.length; i++) {
    const fromClip = clips[i];
    const toClip = clips[i + 1];
    const transition = (track.transitions ?? []).find(
      (t) => t.fromClipId === fromClip.id && t.toClipId === toClip.id,
    );
    if (!transition) continue;
    if (toClip.from !== fromClip.from + fromClip.durationInFrames) continue;
    const durationInFrames = clampTransitionDuration(fromClip, toClip, transition.durationInFrames);
    if (durationInFrames <= 0) continue;
    const { before, after } = transitionSplit(durationInFrames);
    plans.push({
      transition,
      fromClip,
      toClip,
      durationInFrames,
      start: toClip.from - before,
      before,
      after,
    });
  }
  return plans;
};

/**
 * The clip a transition evaluates and renders against.
 *
 * It carries the window and the two clips it joins, so a transition component
 * can work out where it is on the timeline without the editor telling it.
 */
export const transitionClip = (plan: TransitionPlan): Clip => ({
  id: plan.transition.id,
  name: plan.transition.element,
  element: plan.transition.element,
  from: plan.start,
  durationInFrames: plan.durationInFrames,
  props: transitionProps(plan),
  effects: [],
});

/** The props a transition component is given: its own, plus the two clips. */
export const transitionProps = (plan: TransitionPlan): ComponentProps => ({
  ...(plan.transition.props ?? {}),
  fromClip: plan.fromClip,
  toClip: plan.toClip,
  durationInFrames: plan.durationInFrames,
});
