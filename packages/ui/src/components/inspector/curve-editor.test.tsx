// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CurveEditor } from './curve-editor';

afterEach(() => cleanup());

describe('the curve editor', () => {
  it('reads the curve it is given', () => {
    render(<CurveEditor value={{ kind: 'preset', name: 'easeIn' }} onChange={() => {}} />);

    const select = screen.getByLabelText('Curve') as HTMLSelectElement;
    expect(select.value).toBe('easeIn');
  });

  it('reads a custom bezier as custom', () => {
    render(
      <CurveEditor
        value={{ kind: 'cubicBezier', p: [0.1, 0.2, 0.3, 0.4] }}
        onChange={() => {}}
      />,
    );

    const select = screen.getByLabelText('Curve') as HTMLSelectElement;
    expect(select.value).toBe('custom');
  });

  it('produces the curve of the preset that was chosen', () => {
    const onChange = vi.fn();
    render(<CurveEditor value={{ kind: 'preset', name: 'easeIn' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Curve'), { target: { value: 'bounceOut' } });

    expect(onChange).toHaveBeenCalledWith({ kind: 'preset', name: 'bounceOut' });
  });

  it('produces a cubic bezier when a handle is dragged', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor value={{ kind: 'preset', name: 'easeIn' }} onChange={onChange} />,
    );

    const handle = container.querySelector('[data-testid="curve-handle-1"]');
    expect(handle).not.toBeNull();

    fireEvent.mouseDown(handle!, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 80, clientY: 40 });
    fireEvent.mouseUp(window);

    expect(onChange).toHaveBeenCalled();
    const curve = onChange.mock.calls.at(-1)?.[0];
    expect(curve.kind).toBe('cubicBezier');
    expect(curve.p).toHaveLength(4);
    expect(curve.p.every((n: number) => Number.isFinite(n))).toBe(true);
  });

  it('never produces NaN when the pad has no size', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor value={{ kind: 'preset', name: 'linear' }} onChange={onChange} />,
    );

    // jsdom reports a zero-sized rect for every element.
    const handle = container.querySelector('[data-testid="curve-handle-1"]');
    fireEvent.mouseDown(handle!, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(window);

    const curve = onChange.mock.calls.at(-1)?.[0];
    expect(curve.p.every((n: number) => Number.isFinite(n))).toBe(true);
  });

  it('clears the curve when no curve is chosen', () => {
    const onClear = vi.fn();
    render(
      <CurveEditor
        value={{ kind: 'preset', name: 'easeIn' }}
        onChange={() => {}}
        onClear={onClear}
      />,
    );

    fireEvent.change(screen.getByLabelText('Curve'), { target: { value: '' } });

    expect(onClear).toHaveBeenCalled();
  });
});
