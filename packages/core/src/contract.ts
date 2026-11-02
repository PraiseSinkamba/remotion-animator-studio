import type React from 'react';
import type { Clip, ElementType, ParamDef, Project } from './schemas';

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
export type RenderMode = 'content' | 'audio' | 'background' | 'transition';

/** Library grouping shown in the left-hand panel. */
export type ComponentCategory = 'base' | 'trading' | 'motion';

export interface ComponentRenderContext {
  clip: Clip;
  props: ComponentProps;
  /** Clip-relative frame: 0 is the clip's first frame. */
  frame: number;
  /** Project frame rate — constant for the whole composition. */
  fps: number;
  /**
   * The result of the component's own `evaluate` step for this frame, if it
   * has one. `undefined` for every component that does not evaluate.
   */
  evaluated?: unknown;
}

/**
 * An action a component offers on the transport bar.
 *
 * Declared by the component and executed by the shell, so the shell never
 * names a component and a component never reaches into the editor.
 */
export interface TransportAction {
  id: string;
  /** The button's label. */
  label: string;
  /** An icon name the shell knows how to draw. */
  icon: string;
  /** 'seek' jumps the transport; 'toggle' flips a state the component owns. */
  kind: 'seek' | 'toggle';
  /**
   * Absolute frame to seek to. `null` when the action does not apply at the
   * current frame.
   */
  seekTo?: (input: { props: ComponentProps; sceneFrame: number }) => number | null;
  /** Toggle target, resolved by the shell through the component's own props. */
  toggle?: 'hold';
}

/** What a component's `evaluate` step receives. */
export interface ComponentEvaluationInput {
  clip: Clip;
  props: ComponentProps;
  /** The absolute scene frame. */
  sceneFrame: number;
  /** The project snapshot. */
  project: Project;
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

/**
 * How an element is picked on the canvas.
 *
 * - `box` — the element is a rectangle; the pointer hits it inside the box.
 * - `segment` — the element is a line between two points.
 * - `point` — the element is a single point.
 */
export type ElementPickKind = 'box' | 'segment' | 'point';

/**
 * What dragging a handle does.
 *
 * - `scale` — resize the element from a fixed opposite corner.
 * - `font` — change the size of the element's content (its font size).
 * - `wrap` — change the width the element's content wraps at.
 * - `point` — move one endpoint of a segment.
 * - `level` — move one level of a multi-level element.
 * - `move` — move the element itself.
 */
export type ElementHandleEffect = 'scale' | 'font' | 'wrap' | 'point' | 'level' | 'move';

/**
 * One draggable handle on a selected element.
 *
 * A handle does not say where it sits — the editor derives its position from
 * the element's own geometry and the handle's `id` (a corner such as `nw`, a
 * side such as `n`, or the name of the point it moves).
 */
export interface ElementHandle {
  /** The handle's name: a corner (`nw`), a side (`n`) or a point (`start`). */
  id: string;
  /** What dragging the handle does. */
  effect: ElementHandleEffect;
  /** The props the handle writes, for the effects that write props. */
  props?: string[];
}

/**
 * How an element is picked and edited on the canvas.
 *
 * An element that declares no edit model keeps the plain box behaviour.
 */
export interface EditPoint { x: number; y: number }
export interface EditBox { left: number; top: number; width: number; height: number }
export interface ComponentGeometry {
  anchor: EditPoint;
  box: EditBox | null;
  /** CSS wrapper origin for pose projection; may differ from the pick box center. */
  origin: EditPoint;
  /** Intrinsic renderer rotation in degrees, applied before clip effects. */
  rotation?: number;
  points?: Record<string, EditPoint>;
  /** Filled component geometry used for generic canvas picking. */
  pickPolygons?: EditPoint[][];
  /** Painted strokes in authored coordinates, including their width. */
  pickStrokes?: { from: EditPoint; to: EditPoint; width: number }[];
}
export interface ElementEditModel {
  coordinates?: 'absolute' | 'fractional';
  resize?: 'axes' | 'uniform' | ((props: Record<string, unknown>) => 'axes' | 'uniform');
  contentSized?: boolean;
  /** How the element is picked. */
  pick: ElementPickKind;
  /** The handles the editor draws on the element while it is selected. */
  handles: ElementHandle[];
}

export interface ComponentInspectorContext {
  clip: Clip;
  props: ComponentProps;
  /** Merge a partial prop patch into the clip. */
  onChange: (patch: ComponentProps) => void;
  /** Change the clip's timing or name. */
  updateClip: (patch: Partial<Pick<Clip, 'from' | 'durationInFrames' | 'name'>>) => void;
  /** Push an undo snapshot before a discrete edit. */
  commit: () => void;
  /**
   * The absolute scene frame the editor is on.
   *
   * A panel that edits the market needs to know where the playhead is: a hold
   * starts at the frame the creator is looking at.
   */
  sceneFrame?: number;
  /**
   * The component's own evaluation at that frame, as its `evaluate` step
   * returned it.
   *
   * The shell runs the evaluation so a panel reads the same state the renderer
   * draws, instead of evaluating the market a second time.
   */
  evaluated?: unknown;
}

/**
 * The single contract every exportable video object implements — first-party
 * trading components, adapted Remocn motion components and the base
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
  /** Definition-owned validation and default normalization at load/edit/render boundaries. */
  validateProps?: import('./component-props').PropsValidator;
  /** Inspector controls rendered above the custom inspector section. */
  params: ParamDef[];
  /**
   * Deterministic render adapter. Receives the clip-relative frame and must
   * not read editor state, the DOM or the clock.
   */
  render: React.FC<ComponentRenderContext>;
  /**
   * Optional pure evaluation step, run once per clip per frame before the
   * render adapter.
   *
   * A market-anchored component cannot resolve its geometry from
   * (clip, props, frame, fps) alone: it needs the project snapshot at the
   * current frame. The step is pure — it reads no editor state, no DOM and
   * no clock — so the preview and the export run the same evaluation and the
   * same frame always evaluates to the same thing, whatever order the frames
   * were visited in.
   */
  evaluate?: (input: ComponentEvaluationInput) => unknown;
  /**
   * Actions this component offers on the transport bar. Declared here and
   * executed by the shell, so the shell never names a component.
   */
  transportActions?: TransportAction[];
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
  geometry?: (props: Record<string, unknown>, measured?: { width: number; height: number }) => ComponentGeometry;
  bounds?: (props: Record<string, unknown>) => ComponentBounds;
  /**
   * Optional edit model: how the element is picked and which handles the
   * editor draws while it is selected. An element that declares none keeps
   * the plain box behaviour.
   */
  edit?: ElementEditModel;
}
