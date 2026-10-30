/**
 * Running a component's evaluation step.
 *
 * Pure: no Remotion import, no clock, no DOM. The composition calls this
 * once per clip per frame and hands the result to the render adapter, so the
 * preview and the export run the same evaluation.
 */

import type { Clip, ComponentProps, Project, VideoComponentDefinition } from '@chart-studio/core';

/** What a component's evaluation is given. */
export interface EvaluateClipInput {
  clip: Clip;
  props: ComponentProps;
  /** The absolute scene frame. */
  sceneFrame: number;
  /** The project snapshot. */
  project: Project;
}

/**
 * Runs a definition's evaluation step.
 *
 * A definition without one evaluates to `undefined`, which is what every
 * component that does not need the project snapshot gets.
 */
export const evaluateClip = (
  definition: VideoComponentDefinition,
  input: EvaluateClipInput,
): unknown => (definition.evaluate ? definition.evaluate(input) : undefined);
