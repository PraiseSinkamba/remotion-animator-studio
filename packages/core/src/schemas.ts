import type { SeriesSpec } from './series';

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
  /** Market-linked drawing tools (Chart Studio). */
  | 'priceLine'
  | 'highLowLine'
  | 'verticalLine'
  | 'trendline'
  | 'priceZone'
  | 'textLabel'
  | 'arrow'
  | 'position';

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

export interface Track {
  id: string;
  name: string;
  clips: Clip[];
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
