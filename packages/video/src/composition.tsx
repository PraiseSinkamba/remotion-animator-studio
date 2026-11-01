import { noise2D } from '@remotion/noise';
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { computeEffectStyle, type ComputedStyle } from '@chart-studio/components';
import { getComponent } from '@chart-studio/components';
import { evaluateClip } from './evaluate';
import type { Clip, Project } from '@chart-studio/core';
import {
  planTrackTransitions,
  transitionClip,
  transitionProps,
  type TransitionBlend,
  type TransitionPlan,
} from '@chart-studio/core';

/** Renders glitch slice copies on top of the content when the glitch gate is open. */
const GlitchLayers: React.FC<{
  cfg: NonNullable<ComputedStyle['glitch']>;
  children: React.ReactNode;
}> = ({ cfg, children }) => {
  const frame = useCurrentFrame();
  const bucket = Math.floor(frame / 3);
  const gate = (noise2D('glitch-gate', bucket, 0) + 1) / 2 < cfg.frequency;
  if (!gate) return null;

  const slices = [0, 1, 2].map((i) => {
    const top = ((noise2D('gl-top', bucket, i * 3) + 1) / 2) * 80;
    const height = 6 + ((noise2D('gl-h', bucket, i * 5) + 1) / 2) * 18;
    const dx = noise2D('gl-dx', bucket, i * 7) * 60 * cfg.intensity;
    return { top, height, dx, i };
  });

  return (
    <>
      {slices.map(({ top, height, dx, i }) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `inset(${top}% 0 ${Math.max(0, 100 - top - height)}% 0)`,
            transform: `translateX(${dx}px)`,
            filter: i === 1 ? 'hue-rotate(90deg)' : undefined,
          }}
        >
          {children}
        </div>
      ))}
    </>
  );
};

const ClipRenderer: React.FC<{
  clip: Clip;
  project: Project;
  /** Set when this clip is one of the two a transition joins. */
  transition?: { plan: TransitionPlan; role: 'from' | 'to' };
}> = ({ clip, project, transition }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fx = computeEffectStyle(frame, clip.durationInFrames, fps, clip.effects);
  const definition = getComponent(clip.element);
  if (!definition) return null;
  // A hidden clip is not rendered. The shell honours the flag for every
  // clip, so hiding an element hides it in the preview and in the export.
  if (clip.hidden) return null;

  const props = clip.props;
  // Inside the Sequence the frame is clip-relative; the evaluation wants the
  // absolute scene frame.
  const evaluated = evaluateClip(definition, {
    clip,
    props,
    sceneFrame: clip.from + frame,
    project,
  });
  const content = React.createElement(definition.render, { clip, props, frame, fps, evaluated });

  // A transition's blend, when this clip is one of the two it joins. The
  // transition never shifts a clip: the outgoing clip fades over its own tail
  // and the incoming clip comes in over its own head.
  let blendOpacity = 1;
  let blendClipPath: string | undefined;
  if (transition) {
    const { plan, role } = transition;
    const transitionFrame = clip.from + frame - plan.start;
    const inWindow =
      role === 'from'
        ? transitionFrame >= 0 && transitionFrame < plan.before
        : transitionFrame >= plan.before && transitionFrame < plan.durationInFrames;
    if (inWindow) {
      const transitionDefinition = getComponent(plan.transition.element);
      const blend = transitionDefinition?.evaluate?.({
        clip: transitionClip(plan),
        props: transitionProps(plan),
        sceneFrame: plan.start + transitionFrame,
        project,
      }) as TransitionBlend | undefined;
      if (blend) {
        blendOpacity = role === 'from' ? blend.fromOpacity : blend.toOpacity;
        if (role === 'to') blendClipPath = blend.toClipPath;
      }
    }
  }

  if (definition.renderMode === 'audio') {
    // Audio layers are not wrapped in the positioned box.
    return content;
  }

  const filters = [...(fx.blur > 0.01 ? [`blur(${fx.blur}px)`] : []), ...fx.extraFilters];

  if (definition.renderMode === 'background') {
    // Backgrounds fill the frame — no translate/rotate, only the frame effects.
    return (
      <AbsoluteFill
        style={{
          opacity: fx.opacity * blendOpacity,
          filter: filters.length ? filters.join(' ') : undefined,
          clipPath: blendClipPath ?? fx.clipPath ?? undefined,
          transform: `scale(${fx.scale})`,
        }}
      >
        {content}
      </AbsoluteFill>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: props.x,
        top: props.y,
        opacity: fx.opacity * blendOpacity,
        filter: filters.length ? filters.join(' ') : undefined,
        clipPath: blendClipPath ?? fx.clipPath ?? undefined,
        transform:
          `translate(-50%, -50%) translate(${fx.translateX}px, ${fx.translateY}px) scale(${fx.scale}) rotate(${fx.rotate}deg)` +
          (fx.rotateX !== 0 || fx.rotateY !== 0
            ? ` perspective(1200px) rotateX(${fx.rotateX}deg) rotateY(${fx.rotateY}deg)`
            : ''),
      }}
    >
      <div style={{ position: 'relative' }}>
        {content}
        {fx.glitch ? <GlitchLayers cfg={fx.glitch}>{content}</GlitchLayers> : null}
        {fx.shine ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '-20%',
                background: `linear-gradient(105deg, transparent 42%, rgba(255,255,255,${fx.shine.strength}) 50%, transparent 58%)`,
                transform: `translateX(${(fx.shine.progress * 2 - 1) * 150}%)`,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const MainComposition: React.FC<{ project: Project }> = ({ project }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: project.backgroundColor }}>
      {/* tracks[0] is the top layer, so render in reverse order */}
      {[...project.tracks].reverse().map((track) => {
        const plans = planTrackTransitions(track);
        return track.clips.map((clip) => {
          const plan = plans.find(
            (candidate) =>
              candidate.fromClip.id === clip.id || candidate.toClip.id === clip.id,
          );
          const role = plan
            ? plan.fromClip.id === clip.id
              ? ('from' as const)
              : ('to' as const)
            : undefined;
          return (
            <Sequence
              key={clip.id}
              from={clip.from}
              durationInFrames={Math.max(1, clip.durationInFrames)}
              layout="none"
            >
              <ClipRenderer
                clip={clip}
                project={project}
                transition={plan && role ? { plan, role } : undefined}
              />
            </Sequence>
          );
        });
      })}
    </AbsoluteFill>
  );
};
