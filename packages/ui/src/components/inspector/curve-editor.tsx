/**
 * The one curve editor.
 *
 * Every surface that exposes a curve uses this widget: the chart, a pane and
 * a zoom segment all edit the same `Curve` value the same way.
 *
 * React and `@chart-studio/core` only — no UI-kit import. The trading
 * inspectors are part of the Remotion composition, so anything this file
 * pulls in is bundled into the render.
 */
import React from 'react';
import {
  CURVE_PRESETS,
  PRESET_CONTROL_POINTS,
  type Curve,
  type CurvePreset,
} from '@chart-studio/core';

/** The pad's size in svg units. */
const SIZE = 160;
/** The padding around the 0..1 box. */
const PAD = 12;
/** The values the pad shows: the presets overshoot below 0 and above 1. */
const Y_MIN = -0.75;
const Y_MAX = 1.75;

export interface CurveEditorProps {
  /** The curve to show. `undefined` means no curve. */
  value: Curve | undefined;
  /** Called with the new curve. */
  onChange: (curve: Curve) => void;
  /** Called when the curve is removed. Without it, a curve cannot be removed. */
  onClear?: () => void;
  /** The accessible name of the control. */
  label?: string;
}

const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;

/** The control points of a curve. A curve that is not set draws as linear. */
const pointsOf = (curve: Curve | undefined): [number, number, number, number] => {
  if (!curve) return PRESET_CONTROL_POINTS.linear;
  return curve.kind === 'preset' ? PRESET_CONTROL_POINTS[curve.name] : curve.p;
};

export const CurveEditor: React.FC<CurveEditorProps> = ({
  value,
  onChange,
  onClear,
  label = 'Curve',
}) => {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const dragRef = React.useRef<0 | 1 | null>(null);
  const valueRef = React.useRef<Curve | undefined>(value);
  const changeRef = React.useRef(onChange);
  const [dragging, setDragging] = React.useState(false);
  valueRef.current = value;
  changeRef.current = onChange;

  const move = React.useCallback((event: MouseEvent) => {
    const index = dragRef.current;
    const svg = svgRef.current;
    if (index === null || !svg) return;
    const rect = svg.getBoundingClientRect();
    // A zero-sized rect (jsdom, or a hidden pad) must never produce NaN.
    const width = rect.width > 0 ? rect.width : SIZE;
    const height = rect.height > 0 ? rect.height : SIZE;
    const span = SIZE - 2 * PAD;
    const x = clamp(
      (((event.clientX - rect.left) / width) * SIZE - PAD) / span,
      0,
      1,
    );
    const py = clamp(((event.clientY - rect.top) / height) * SIZE - PAD, 0, span);
    const y = Y_MIN + (1 - py / span) * (Y_MAX - Y_MIN);
    const next = [...pointsOf(valueRef.current)] as [number, number, number, number];
    next[index * 2] = x;
    next[index * 2 + 1] = y;
    changeRef.current({ kind: 'cubicBezier', p: next });
  }, []);

  React.useEffect(() => {
    if (!dragging) return;
    const up = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, move]);

  const points = pointsOf(value);
  const [x1, y1, x2, y2] = points;
  const sx = (x: number) => PAD + x * (SIZE - 2 * PAD);
  const sy = (y: number) =>
    SIZE - PAD - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * (SIZE - 2 * PAD);

  const chosen =
    value === undefined ? '' : value.kind === 'preset' ? value.name : 'custom';

  return (
    <div className="flex flex-col gap-2" data-testid="curve-editor">
      <select
        aria-label={label}
        value={chosen}
        onChange={(event) => {
          const next = event.target.value;
          if (next === '') {
            onClear?.();
            return;
          }
          if (next === 'custom') return;
          onChange({ kind: 'preset', name: next as CurvePreset });
        }}
      >
        <option value="" disabled={!onClear}>
          no curve
        </option>
        {CURVE_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
        {value && value.kind !== 'preset' ? (
          <option value="custom">custom</option>
        ) : null}
      </select>

      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="rounded-md border border-border bg-muted/40 text-primary"
        data-testid="curve-pad"
      >
        <rect
          x={sx(0)}
          y={sy(1)}
          width={sx(1) - sx(0)}
          height={sy(0) - sy(1)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        <path
          d={`M ${sx(0)} ${sy(0)} L ${sx(1)} ${sy(1)}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        <path
          d={`M ${sx(0)} ${sy(0)} C ${sx(x1)} ${sy(y1)} ${sx(x2)} ${sy(y2)} ${sx(1)} ${sy(1)}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        />
        <circle
          data-testid="curve-handle-1"
          cx={sx(x1)}
          cy={sy(y1)}
          r={6}
          onMouseDown={() => {
            dragRef.current = 0;
            setDragging(true);
          }}
        />
        <circle
          data-testid="curve-handle-2"
          cx={sx(x2)}
          cy={sy(y2)}
          r={6}
          onMouseDown={() => {
            dragRef.current = 1;
            setDragging(true);
          }}
        />
      </svg>
    </div>
  );
};
