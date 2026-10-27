/** Shared metrics and colour accents for the timeline shell. */

export const TRACK_HEIGHT = 28;
export const RULER_HEIGHT = 22;
export const LABEL_COLUMN_WIDTH = 132;

export const framesToLabel = (frames: number, fps: number) => {
  const s = frames / fps;
  return s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`;
};

/**
 * Per-track accent. The project model carries no track colour, so the accent
 * is derived from the track's position: the same track always gets the same
 * colour and the palette cycles. The colours come from the theme's chart
 * tokens, so they are the same in both modes.
 */
export interface TrackAccent {
  /** chip border */
  border: string;
  /** chip fill */
  fill: string;
  /** the dot in the label column */
  dot: string;
}

export const TRACK_ACCENTS: TrackAccent[] = [
  { border: 'border-chart-1/60', fill: 'bg-chart-1/15', dot: 'bg-chart-1' },
  { border: 'border-chart-2/60', fill: 'bg-chart-2/15', dot: 'bg-chart-2' },
  { border: 'border-chart-3/60', fill: 'bg-chart-3/15', dot: 'bg-chart-3' },
  { border: 'border-chart-4/60', fill: 'bg-chart-4/15', dot: 'bg-chart-4' },
  { border: 'border-chart-5/60', fill: 'bg-chart-5/15', dot: 'bg-chart-5' },
];

export const accentForTrack = (index: number): TrackAccent =>
  TRACK_ACCENTS[((index % TRACK_ACCENTS.length) + TRACK_ACCENTS.length) % TRACK_ACCENTS.length];
