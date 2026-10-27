import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getComponent } from '../registry';
import { findClip, useStore } from '../store';
import { clipGeometry } from './canvas-hit-test';

/**
 * Editor-only selection box drawn over the preview Player.
 *
 * The box is metadata: it never enters the composition, so it cannot change a
 * rendered pixel or the exported video.
 */

/** Where a handle sits on the box and which edges it drags. */
interface Handle {
  id: 'nw' | 'ne' | 'se' | 'sw';
  /** Position on the box, 0..1. */
  fx: number;
  fy: number;
  /** Which edge follows the pointer: -1 west/north, 1 east/south. */
  sx: number;
  sy: number;
  cursor: string;
}

const HANDLES: Handle[] = [
  { id: 'nw', fx: 0, fy: 0, sx: -1, sy: -1, cursor: 'cursor-nwse-resize' },
  { id: 'ne', fx: 1, fy: 0, sx: 1, sy: -1, cursor: 'cursor-nesw-resize' },
  { id: 'se', fx: 1, fy: 1, sx: 1, sy: 1, cursor: 'cursor-nwse-resize' },
  { id: 'sw', fx: 0, fy: 1, sx: -1, sy: 1, cursor: 'cursor-nesw-resize' },
];

/** Smallest box a handle may drag out, when the component has no minimum. */
const MIN_SIZE = 8;

export const SelectionOverlay: React.FC = () => {
  const project = useStore((s) => s.project);
  const selectedClipId = useStore((s) => s.selectedClipIds[0] ?? null);
  const drawingPath = useStore((s) => s.drawingPath);
  const updateClipProps = useStore((s) => s.updateClipProps);
  const commit = useStore((s) => s.commit);

  const layerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drag = useRef<{
    startX: number;
    startY: number;
    scale: number;
    origin: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // The Player letterboxes the composition inside the stage; the overlay has
  // to use the same "meet" fit to sit exactly on the rendered pixels.
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const clip = findClip(project, selectedClipId);
  const definition = clip ? getComponent(clip.element) : undefined;

  /** The clip's box on the canvas — the same rectangle the canvas hit-tests. */
  const geometry = useMemo(() => (clip ? clipGeometry(clip) : null), [clip]);

  /** Only positioned components get a box — audio and background have no anchor. */
  const positioned = !!geometry;

  /** Only components with numeric width/height params can be resized. */
  const resizable =
    !!definition &&
    definition.params.some((p) => p.key === 'width' && p.kind === 'number') &&
    definition.params.some((p) => p.key === 'height' && p.kind === 'number');

  const widthParam = definition?.params.find((p) => p.key === 'width');
  const heightParam = definition?.params.find((p) => p.key === 'height');
  const minWidth = typeof widthParam?.min === 'number' ? widthParam.min : MIN_SIZE;
  const minHeight = typeof heightParam?.min === 'number' ? heightParam.min : MIN_SIZE;
  const maxWidth = typeof widthParam?.max === 'number' ? widthParam.max : Infinity;
  const maxHeight = typeof heightParam?.max === 'number' ? heightParam.max : Infinity;

  const scale = size.width > 0 && size.height > 0 ? Math.min(size.width / project.width, size.height / project.height) : 0;
  const offsetX = (size.width - project.width * scale) / 2;
  const offsetY = (size.height - project.height * scale) / 2;

  const box = geometry
    ? {
        left: offsetX + geometry.box.left * scale,
        top: offsetY + geometry.box.top * scale,
        width: geometry.box.width * scale,
        height: geometry.box.height * scale,
      }
    : null;

  const onHandlePointerDown = (e: React.PointerEvent, handle: Handle) => {
    if (!geometry || !clip) return;
    // Keep the stage's move-drag from starting under the handle.
    e.stopPropagation();
    e.preventDefault();
    commit();
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      scale,
      origin: {
        x: geometry.anchor.x,
        y: geometry.anchor.y,
        width: geometry.box.width,
        height: geometry.box.height,
      },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent, handle: Handle) => {
    const current = drag.current;
    if (!current || !clip) return;
    const dx = (e.clientX - current.startX) / current.scale;
    const dy = (e.clientY - current.startY) / current.scale;
    // Corner handles move both edges: the opposite corner stays put, so the
    // anchor (the box centre) shifts by half of the size change.
    const width = Math.min(maxWidth, Math.max(minWidth, current.origin.width + handle.sx * dx));
    const height = Math.min(maxHeight, Math.max(minHeight, current.origin.height + handle.sy * dy));
    updateClipProps(clip.id, {
      width: Math.round(width),
      height: Math.round(height),
      x: Math.round(current.origin.x + (handle.sx * (width - current.origin.width)) / 2),
      y: Math.round(current.origin.y + (handle.sy * (height - current.origin.height)) / 2),
    });
  };

  const onHandlePointerUp = () => {
    drag.current = null;
  };

  const show = !drawingPath && positioned && !!geometry && !!box && scale > 0;

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-10">
      {show && geometry && box ? (
        <>
          <div
            className="absolute rounded-sm border-2 border-dashed border-primary"
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          />
          {resizable
            ? HANDLES.map((handle) => (
                <div
                  key={handle.id}
                  className={`pointer-events-auto absolute size-3 rounded-sm border border-primary-foreground bg-primary ${handle.cursor}`}
                  style={{
                    left: box.left + handle.fx * box.width,
                    top: box.top + handle.fy * box.height,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onPointerDown={(e) => onHandlePointerDown(e, handle)}
                  onPointerMove={(e) => onHandlePointerMove(e, handle)}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerUp}
                />
              ))
            : null}
          <div
            className="absolute bg-background px-1 font-mono text-[10px] leading-none text-muted-foreground"
            style={{ left: box.left, top: Math.max(2, box.top - 16) }}
          >
            {Math.round(geometry.box.width)} × {Math.round(geometry.box.height)}
          </div>
        </>
      ) : null}
    </div>
  );
};
