import type { Project } from './types';

export const sampleProject: Project = {
  name: 'My animation',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 240,
  backgroundColor: '#0d0d14',
  tracks: [
    {
      id: 't-text',
      name: 'Text',
      clips: [
        {
          id: 'c-title',
          name: 'Title',
          element: 'text',
          from: 15,
          durationInFrames: 150,
          props: {
            text: 'Made with Remotion',
            fontSize: 110,
            color: '#ffffff',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 700,
            letterSpacing: 1,
            x: 960,
            y: 460,
          },
          effects: [
            { id: 'e1', type: 'springPop', params: { damping: 10, mass: 0.8 } },
            { id: 'e2', type: 'fadeOut', params: { duration: 20 } },
          ],
        },
        {
          id: 'c-sub',
          name: 'Subtitle',
          element: 'text',
          from: 40,
          durationInFrames: 125,
          props: {
            text: 'Drag, drop, animate.',
            fontSize: 48,
            color: '#b9a8ff',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontWeight: 400,
            letterSpacing: 4,
            x: 960,
            y: 600,
          },
          effects: [
            { id: 'e3', type: 'typewriter', params: { charsPerSecond: 18 } },
            { id: 'e4', type: 'fadeOut', params: { duration: 20 } },
          ],
        },
      ],
    },
    {
      id: 't-stickers',
      name: 'Stickers',
      clips: [
        {
          id: 'c-rocket',
          name: 'Rocket',
          element: 'emoji',
          from: 170,
          durationInFrames: 70,
          props: { char: '🚀', size: 220, x: 960, y: 540 },
          effects: [
            { id: 'e5', type: 'springPop', params: { damping: 12, mass: 1 } },
            { id: 'e6', type: 'pulse', params: { amount: 0.06, speed: 1.5 } },
          ],
        },
      ],
    },
    {
      id: 't-bg',
      name: 'Background',
      clips: [
        {
          id: 'c-bg',
          name: 'Gradient',
          element: 'background',
          from: 0,
          durationInFrames: 240,
          props: { fillType: 'linear', colorA: '#131024', colorB: '#3b1f6e', angle: 135 },
          effects: [],
        },
      ],
    },
  ],
};
