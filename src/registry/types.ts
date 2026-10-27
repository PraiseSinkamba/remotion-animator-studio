import type React from 'react';
import type { Clip, ElementType, ParamDef } from '../types';

/**
 * Every component's props are a plain, JSON-serialisable bag.
 * `any` is deliberate here: each component narrows its own props in its
 * render adapter. The registry itself never inspects prop shapes.
 */
export type ComponentProps = Record<string, any>;

/**
 * How the compositor treats a component's rendered output.
 * - `content`  — positioned at (x, y) inside the clip box, effects apply.
 * - `audio`    — an audio layer, not wrapped in the positioned box.
 * - `background` — fills the frame, not wrapped in the positioned box.
 */
export type RenderMode = 'content' | 'audio' | 'background';

/** Library grouping shown in the left-hand panel. */
export type ComponentCategory = 'generic' | 'trading' | 'motion';

export interface ComponentRenderContext {
  clip: Clip;
  props: ComponentProps;
  /** Clip-relative frame: 0 is the clip's first frame. */
  frame: number;
  /** Project frame rate — constant for the whole composition. */
  fps: number;
}

/**
 * The editor's selection box for a component, in composition pixels.
 *
 * `x`/`y` are the component's anchor — the compositor centres a component's
 * content on it (`translate(-50%, -50%)`) — so the box spans `x ± width / 2`
 * and `y ± height / 2`.
 */
export interface ComponentBounds {
  /** Anchor X, in composition pixels. */
  x: number;
  /** Anchor Y, in composition pixels. */
  y: number;
  /** Box width, in composition pixels. */
  width: number;
  /** Box height, in composition pixels. */
  height: number;
}

/** Box size used for components that expose no width/height of their own. */
const FALLBACK_SIZE = { width: 320, height: 180 };

/**
 * The default selection box: the component's anchor plus its own size.
 * Width and height come from the props (the definition defaults are already
 * merged in by the caller), then a 320×180 fallback so the overlay still
 * shows where a component without a size sits.
 */
export const componentBounds = (props: Record<string, unknown>): ComponentBounds => ({
  x: typeof props.x === 'number' ? props.x : 0,
  y: typeof props.y === 'number' ? props.y : 0,
  width: typeof props.width === 'number' ? props.width : FALLBACK_SIZE.width,
  height: typeof props.height === 'number' ? props.height : FALLBACK_SIZE.height,
});

export interface ComponentInspectorContext {
  clip: Clip;
  props: ComponentProps;
  /** Merge a partial prop patch into the clip. */
  onChange: (patch: ComponentProps) => void;
  /** Change the clip's timing or name. */
  updateClip: (patch: Partial<Pick<Clip, 'from' | 'durationInFrames' | 'name'>>) => void;
  /** Push an undo snapshot before a discrete edit. */
  commit: () => void;
}

/**
 * The single contract every exportable video object implements — first-party
 * trading components, adapted Remocn motion components and the generic
 * elements inherited from the upstream editor.
 *
 * See docs/spec/COMPONENT_CONTRACT.md and docs/decisions/ADR-003-COMPONENT-SYSTEM.md.
 */
export interface VideoComponentDefinition {
  /** Stable ID persisted in project files. Never renumber or reuse. */
  type: ElementType;
  label: string;
  icon: string;
  description: string;
  category: ComponentCategory;
  /** Props applied to a freshly created instance. */
  defaults: ComponentProps;
  /** Inspector controls rendered above the custom inspector section. */
  params: ParamDef[];
  /**
   * Deterministic render adapter. Receives the clip-relative frame and must
   * not read editor state, the DOM or the clock.
   */
  render: React.FC<ComponentRenderContext>;
  /** Optional custom inspector panel, rendered below the generated params. */
  inspector?: React.FC<ComponentInspectorContext>;
  /**
   * Frames a newly created instance occupies. A function derives the length
   * from the instance's own props (a chart fits its series, for example).
   */
  defaultDuration?: number | ((props: ComponentProps) => number);
  /** Version of this component's props schema. Bump on breaking prop changes. */
  propsVersion?: number;
  /** Set when the implementation is adapted third-party source. */
  provenance?: {
    source: string;
    license: string;
    /** Upstream revision, commit or fetch date. */
    revision?: string;
    notes?: string;
  };
  /** Defaults to `content`. */
  renderMode?: RenderMode;
  /**
   * Editor-only geometry of the component's rendered box, in composition
   * pixels. The selection overlay draws this rectangle; it is metadata and
   * never reaches the composition, so it cannot change a rendered pixel.
   */
  bounds?: (props: Record<string, unknown>) => ComponentBounds;
}
