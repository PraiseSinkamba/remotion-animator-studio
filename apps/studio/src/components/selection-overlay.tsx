import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getComponent } from '@chart-studio/components';
import { dragEffect, elementRegion, handleAt, type Box, type Point, type Region } from '@chart-studio/editor';
import { findClip, useStore } from '@chart-studio/editor';
import type { Clip, ElementHandle } from '@chart-studio/core';

/**
 * Editor-only selection overlay drawn over the preview Player.
 *
 * The overlay draws what the selected element **declares**: its own control
 * points, and its rectangle only when it has one. A line is picked and
 * dragged by its ends, with no rectangle around it; a text's rectangle is
 * derived from the text itself; the elements that are boxes keep their box.
 *
 * The overlay is metadata: it never enters the composition, so it cannot
 * change a rendered pixel or the exported video.
 */

/** The smallest box a handle may drag out, when the component has no minimum. */
const MIN_SIZE = 8;

export const SelectionOverlay: React.FC<{ measured?: Map<string, Box> }> = ({ measured }) => {
  const project = useStore((s) => s.project);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const drawingPath = useStore((s) => s.drawingPath);
  const updateClipProps = useStore((s) => s.updateClipProps);
  const commit = useStore((s) => s.commit);

  const layerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  /**
   * The gesture in progress.
   *
   * The element's geometry is captured **when the drag starts**, not read
   * live: the first move already moves the element, so a live geometry would
   * apply the same delta again on the next move — and the element would run
   * away from the pointer.
   */
  const drag = useRef<{
    startX: number;
    startY: number;
    handle: ElementHandle;
    clip: Clip;
    region: Region;
  } | null>(null);

  // The Player letterboxes the composition inside the stage; the overlay has
  // to use the same "meet" fit to sit exactly on the rendered pixels.
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * Every selected element, with the geometry it declares.
   *
   * A multi-selection shows each element's own control points: a handle
   * belongs to the element it was drawn for.
   */
  const selected = useMemo(
    () =>
      selectedClipIds
        .map((id) => findClip(project, id))
        .filter((clip): clip is NonNullable<typeof clip> => !!clip)
        .map((clip) => {
          const definition = getComponent(clip.element);
          const edit = definition?.edit;
          const region = elementRegion(clip, project, measured?.get(clip.id) ?? null);
          return { clip, edit, region };
        })
        .filter((entry) => entry.edit && entry.region),
    [project, selectedClipIds, measured],
  );

  const scale =
    size.width > 0 && size.height > 0
      ? Math.min(size.width / project.width, size.height / project.height)
      : 0;
  const offsetX = (size.width - project.width * scale) / 2;
  const offsetY = (size.height - project.height * scale) / 2;

  /** A client point, in composition pixels. */
  const compositionPoint = (clientX: number, clientY: number): Point | null => {
    const el = layerRef.current;
    if (!el || scale <= 0) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  };

  /** A composition point, on the stage. */
  const stagePoint = (point: Point): { left: number; top: number } => ({
    left: offsetX + point.x * scale,
    top: offsetY + point.y * scale,
  });

  const onHandlePointerDown = (
    e: React.PointerEvent,
    handle: ElementHandle,
    clip: Clip,
    region: Region,
  ) => {
    // Keep the stage's move-drag from starting under the handle.
    e.stopPropagation();
    e.preventDefault();
    commit();
    drag.current = { startX: e.clientX, startY: e.clientY, handle, clip, region };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const pointer = compositionPoint(e.clientX, e.clientY);
    const start = compositionPoint(current.startX, current.startY);
    if (!pointer || !start) return;
    // The handle acts on the element it belongs to, even in a multi-selection,
    // and on the geometry it had when the drag started — reading it live
    // would apply the same delta twice and the element would run away.
    const patch = dragEffect(current.clip, current.handle, current.region, pointer, start);
    if (patch) updateClipProps(current.clip.id, patch);
  };

  const onHandlePointerUp = () => {
    drag.current = null;
  };

  const show = !drawingPath && selected.length > 0 && scale > 0;

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-10">
      {show
        ? selected.map(({ clip, edit, region }) => {
            if (!edit || !region) return null;
            /**
             * The rectangle, when the element has one.
             *
             * A line's region is the bounding box of its two ends, but it must
             * not be drawn: the line is picked and dragged by its ends, and a
             * rectangle around it is exactly what this design removes.
             */
            const box =
              region.pick === 'box' && region.box
                ? {
                    left: offsetX + region.box.left * scale,
                    top: offsetY + region.box.top * scale,
                    width: region.box.width * scale,
                    height: region.box.height * scale,
                  }
                : null;

            /** The handles the element declares, placed where they belong. */
            const handles = edit.handles
              .map((handle) => {
                const point = handleAt(region, handle, clip);
                if (!point) return null;
                const placed = stagePoint(point);
                return { handle, left: placed.left, top: placed.top };
              })
              .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

            /**
             * The readout: a text's size is its type, so the font size is
             * what it says.
             */
            const font = edit.handles.find((handle) => handle.effect === 'font');
            const readout = (() => {
              if (font) {
                const value = (clip.props as Record<string, unknown>)[font.props?.[0] ?? 'fontSize'];
                return typeof value === 'number' ? `${Math.round(value)} pt` : null;
              }
              if (!region.box || region.pick !== 'box') return null;
              return `${Math.round(region.box.width)} × ${Math.round(region.box.height)}`;
            })();

            return (
              <div key={clip.id}>
                {box ? (
                  <div
                    className="absolute rounded-sm border-2 border-dashed border-primary"
                    style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                  />
                ) : null}
                {handles.map(({ handle, left, top }) => (
                  <div
                    key={`${clip.id}-${handle.id}`}
                    className="pointer-events-auto absolute size-3 rounded-sm border border-primary-foreground bg-primary"
                    style={{ left, top, transform: 'translate(-50%, -50%)' }}
                    onPointerDown={(e) => onHandlePointerDown(e, handle, clip, region)}
                    onPointerMove={onHandlePointerMove}
                    onPointerUp={onHandlePointerUp}
                    onPointerCancel={onHandlePointerUp}
                  />
                ))}
                {readout && box ? (
                  <div
                    className="absolute bg-background px-1 font-mono text-[10px] leading-none text-muted-foreground"
                    style={{ left: box.left, top: Math.max(2, box.top - 16) }}
                  >
                    {readout}
                  </div>
                ) : null}
              </div>
            );
          })
        : null}
    </div>
  );
};
