import type { PaneSpec } from './elements';
import type { Project } from './schemas';

/**
 * The composition's length, derived from what the project holds.
 *
 * Every clip contributes its own end frame (`from + durationInFrames`). A
 * chart contributes its panes' out frames as well: a pane's lifecycle is
 * relative to the chart clip's first frame, so the absolute end is the
 * clip's `from` plus the pane's `out`. A chart whose panes run past its own
 * length is therefore not cut short.
 *
 * The result is at least one frame: an empty project still has a composition.
 */
export const derivedDuration = (project: Project): number => {
  let frames = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      frames = Math.max(frames, clip.from + clip.durationInFrames);
      const panes = clip.props.panes;
      if (Array.isArray(panes)) {
        for (const pane of panes as PaneSpec[]) {
          if (typeof pane.out === 'number') frames = Math.max(frames, clip.from + pane.out);
        }
      }
    }
  }
  return Math.max(1, frames);
};

/**
 * The composition's length, in the mode the project asks for.
 *
 * 'derived' computes the length from the elements; 'fixed' uses the author's
 * own number. A project without a mode is a legacy document and keeps its
 * authored length.
 */
export const effectiveDuration = (project: Project): number =>
  project.durationMode === 'derived' ? derivedDuration(project) : project.durationInFrames;
