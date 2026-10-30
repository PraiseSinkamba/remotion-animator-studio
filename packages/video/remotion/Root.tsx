import React from 'react';
import { Composition } from 'remotion';
import { migrateProject } from '@chart-studio/components';
import { sampleProject, type Project } from '@chart-studio/core';
import { MainComposition } from '@chart-studio/video';
import { authoredPathProject } from './authored-path-fixture';

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
      {/* A chart driven by a drawn path, rendered as its own composition so the
          render gate proves the authored path without touching the composition
          that proves a migrated project still renders the same. */}
      <Composition
        id="AuthoredPath"
        component={MainComposition as React.FC<{ project: Project }>}
        defaultProps={{ project: authoredPathProject }}
        durationInFrames={authoredPathProject.durationInFrames}
        fps={authoredPathProject.fps}
        width={authoredPathProject.width}
        height={authoredPathProject.height}
        calculateMetadata={({ props, defaultProps }) => {
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
    </>
  );
};
