import { beforeEach, describe, expect, it } from 'vitest';

import { getComponent } from './registry';
import { sampleProject } from './sampleProject';
import { useStore } from './store';
import type { Project } from './types';

/** A project with one empty track, so every clip in it is one we created. */
const emptyProject = (): Project => ({
  ...sampleProject,
  tracks: [{ id: 't-empty', name: 'Track 1', clips: [] }],
});

describe('store — clip creation', () => {
  beforeEach(() => {
    useStore.setState({
      project: emptyProject(),
      selectedClipIds: [],
      history: [],
      future: [],
      workspaceId: null,
      workspaceRevision: null,
    });
  });

  it('stamps the component props version on a new clip', () => {
    useStore.getState().addClip('text', 't-empty', 0);

    const clips = useStore.getState().project.tracks[0].clips;
    const clip = clips[clips.length - 1];
    expect(clip.element).toBe('text');
    expect(clip.propsVersion).toBe(getComponent('text')?.propsVersion ?? 1);
  });

  it('stamps the component props version on every clip of a preset', () => {
    useStore.getState().addPreset('titleIntro', 0);

    const clips = useStore.getState().project.tracks.flatMap((t) => t.clips);
    expect(clips.length).toBeGreaterThan(0);
    for (const clip of clips) {
      expect(clip.propsVersion).toBe(getComponent(clip.element)?.propsVersion ?? 1);
    }
  });
});
