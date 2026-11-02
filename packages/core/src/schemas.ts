import type { ChartGroupSpec } from './elements';
// Type-only, so it is erased at runtime and the two modules do not cycle.
import type { ComponentProps } from './contract';
import type { SeriesSpec } from './series';

/**
 * The project schema version this build writes and understands.
 *
 * A document that carries a higher version is rejected by the migration,
 * never guessed at.
 */
export const CURRENT_PROJECT_SCHEMA_VERSION = 4;

export type ElementType =
  | 'text'
  | 'shape'
  | 'image'
  | 'emoji'
  | 'background'
  | 'video'
  | 'audio'
  | 'gif'
  | 'counter'
  | 'wave'
  | 'blob'
  | 'particles'
  | 'html'
  | 'cursor'
  | 'synthGrid'
  | 'neonSun'
  | 'isoCity'
  | 'skyCycle'
  | 'sunMoon'
  | 'ridge'
  | 'commitGraph'
  | 'nodeTrail'
  /** First-party trading component (Chart Studio). */
  | 'candlestickChart'
  /** Source-owned Remocn motion component adapted to the registry. */
  | 'remocnMarkerHighlight'
  /** Source-owned Remocn motion component adapted to the registry. */
  | 'remocnSoftBlurIn'
  /** Source-owned Remocn motion component adapted to the registry. */
  | 'remocnTypewriter'
  /** Independent drawing tools (Chart Studio). */
  | 'horizontalLine'
  | 'verticalLine'
  | 'trendline'
  | 'rectangle'
  | 'arrow'
  | 'position'
  /** Transition components: they render at a clip boundary, not as a clip. */
  | 'crossfade'
  | 'wipe';

export type EffectType =
  | 'fadeIn'
  | 'fadeOut'
  | 'slideIn'
  | 'slideOut'
  | 'zoomIn'
  | 'zoomOut'
  | 'springPop'
  | 'spinIn'
  | 'rotate'
  | 'pulse'
  | 'wiggle'
  | 'blurIn'
  | 'typewriter'
  | 'wipeIn'
  | 'wipeOut'
  | 'kenBurns'
  | 'shake'
  | 'glitch'
  | 'rgbSplit'
  | 'glow'
  | 'shadow'
  | 'shine'
  | 'strobe'
  | 'letterPop'
  | 'drift'
  | 'transform'
  | 'motionPath'
  | 'bounceDrop'
  | 'flipIn'
  | 'flipOut'
  | 'colorAdjust'
  | 'flicker'
  | 'float'
  | 'clickPulse'
  | 'letterWave';

export interface EffectInstance {
  id: string;
  type: EffectType;
  params: Record<string, number | string>;
}

export interface Clip {
  id: string;
  name: string;
  element: ElementType;
  /** Start frame within the composition */
  from: number;
  durationInFrames: number;
  props: Record<string, any>;
  effects: EffectInstance[];
  /** Clips sharing a groupId select and move as one */
  groupId?: string;
  /** Props schema version of the component this clip was authored against. */
  propsVersion?: number;
  /** Editor flag: a locked clip is not selectable on the canvas and not editable. */
  locked?: boolean;
  /** Editor flag: a hidden clip is not rendered. */
  hidden?: boolean;
}

/**
 * A transition at the boundary between two adjacent clips on a track.
 *
 * A transition is not a clip: it has no place of its own on the track, it
 * only names the outgoing clip, the incoming clip, the transition component
 * and how long the transition may last.
 */
export interface TrackTransition {
  id: string;
  /** The clip that leaves. */
  fromClipId: string;
  /** The clip that arrives. */
  toClipId: string;
  /** The transition component that renders the boundary. */
  element: ElementType;
  /** The requested duration, in frames. The compositor clamps it. */
  durationInFrames: number;
  /** Props of the transition component. */
  props?: ComponentProps;
}

export interface Track {
  id: string;
  name: string;
  clips: Clip[];
  /** The transitions on this track's clip boundaries. */
  transitions?: TrackTransition[];
}

export interface Project {
  name: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  backgroundColor: string;
  /** tracks[0] renders on top (like layers) */
  tracks: Track[];
  /** Document schema version. Absent means legacy (version 1). */
  schemaVersion?: number;
  /**
   * Project-level market data registry. Charts reference a series by id; the
   * chart never holds the bars itself.
   */
  series?: SeriesSpec[];
  /**
   * Scene-level chart groups. A group arranges one to three chart clips, gives
   * them a shared clock and declares the relations between their panes.
   */
  chartGroups?: ChartGroupSpec[];
  /**
   * 'derived' computes the length from the elements; 'fixed' uses
   * durationInFrames. Absent means legacy (version 1).
   */
  durationMode?: 'derived' | 'fixed';
}

export interface ParamDef {
  key: string;
  label: string;
  kind: 'number' | 'color' | 'text' | 'textarea' | 'select' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}
