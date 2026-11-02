import type { ComponentBounds, ComponentGeometry } from '@chart-studio/core';

type ContentSize = { width: number; height: number };

/** Shared authored text estimate; DOM measurements supply untransformed local size. */
export const contentGeometry = (
  props: Record<string, unknown>,
  text: string,
  measured?: ContentSize,
): ComponentGeometry => {
  const anchor = { x: Number(props.x), y: Number(props.y) };
  const fontSize = Number(props.fontSize);
  const width = measured?.width ?? Math.min(
    Number(props.maxWidth) || Infinity,
    Math.max(1, text.length) * fontSize * 0.6,
  );
  const height = measured?.height ?? fontSize * 1.25;
  return {
    anchor,
    origin: anchor,
    box: { left: anchor.x - width / 2, top: anchor.y - height / 2, width, height },
  };
};

export const geometryBounds = (geometry: ComponentGeometry): ComponentBounds => {
  const box = geometry.box;
  return box ? {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    width: box.width,
    height: box.height,
  } : { ...geometry.anchor, width: 0, height: 0 };
};
