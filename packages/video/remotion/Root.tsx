import React from 'react';
import { Composition } from 'remotion';
import { migrateProject } from '@chart-studio/components';
import { sampleProject, type Project } from '@chart-studio/core';
import { MainComposition } from '@chart-studio/video';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={MainComposition as React.FC<{ project: Project }>}
      defaultProps={{ project: sampleProject }}
      durationInFrames={sampleProject.durationInFrames}
      fps={sampleProject.fps}
      width={sampleProject.width}
      height={sampleProject.height}
      calculateMetadata={({ props, defaultProps }) => {
        // The CLI passes the project as input props; the studio merges it with
        // the default props. Either way the document is migrated before use.
        const project = migrateProject(props.project ?? defaultProps.project);
        return {
          durationInFrames: project.durationInFrames,
          fps: project.fps,
          width: project.width,
          height: project.height,
          props: { project },
        };
      }}
    />
  );
};
