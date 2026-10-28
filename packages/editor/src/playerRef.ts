import type { PlayerRef } from '@remotion/player';
import { createRef } from 'react';

/** Shared ref to the Remotion Player so any panel (timeline, top bar) can control playback. */
export const playerRef = createRef<PlayerRef>();

export const seekTo = (frame: number) => {
  playerRef.current?.seekTo(Math.max(0, Math.round(frame)));
};

export const togglePlay = () => {
  playerRef.current?.toggle();
};
