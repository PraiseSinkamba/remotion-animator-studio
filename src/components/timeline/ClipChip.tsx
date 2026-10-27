import React, { useRef } from 'react';
import { getComponent } from '../../registry';
import { useStore } from '../../store';
import type { Clip, EffectType } from '../../types';
import { EFFECT_MIME } from '../Library';
import { framesToLabel, LANE_HEIGHT, type TrackAccent } from './shared';

const isAdditive = (e: React.PointerEvent | React.MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey;

export const ClipChip: React.FC<{
  clip: Clip;
  trackId: string;
  accent: TrackAccent;
  /** row of overlapping clips this chip sits in, counted from the track top */
  lane: number;
}> = ({ clip, trackId, accent, lane }) => {
  const ppf = useStore((s) => s.pixelsPerFrame);
  const selected = useStore((s) => s.selectedClipIds.includes(clip.id));
  const totalFrames = useStore((s) => s.project.durationInFrames);
  const fps = useStore((s) => s.project.fps);
  const { selectClip, updateClip, shiftClips, addEffect, commit } = useStore.getState();

  const gesture = useRef<{
    mode: 'move' | 'resize-l' | 'resize-r';
    startX: number;
    startY: number;
    origFrom: number;
    origDur: number;
    /** all selected clips' original positions, for group moves */
    group: Array<{ clipId: string; from: number; dur: number }>;
  } | null>(null);

  const onPointerDown = (mode: 'move' | 'resize-l' | 'resize-r') => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (isAdditive(e)) {
      selectClip(clip.id, true);
      return; // toggling membership — no drag
    }
    const s = useStore.getState();
    if (!s.selectedClipIds.includes(clip.id)) selectClip(clip.id);
    commit();
    const ids = useStore.getState().selectedClipIds;
    const group =
      mode === 'move'
        ? ids
            .map((id) => {
              for (const t of useStore.getState().project.tracks) {
                const c = t.clips.find((c) => c.id === id);
                if (c) return { clipId: id, from: c.from, dur: c.durationInFrames };
              }
              return null;
            })
            .filter((x): x is { clipId: string; from: number; dur: number } => x !== null)
        : [];
    gesture.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origFrom: clip.from,
      origDur: clip.durationInFrames,
      group,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    let df = Math.round((e.clientX - g.startX) / ppf);
    if (g.mode === 'move') {
      // clamp so every clip in the group stays inside the composition
      for (const m of g.group) {
        df = Math.max(df, -m.from);
        df = Math.min(df, totalFrames - m.dur - m.from);
      }
      shiftClips(g.group.map((m) => ({ clipId: m.clipId, from: m.from + df })));
    } else if (g.mode === 'resize-r') {
      const dur = Math.max(2, Math.min(g.origDur + df, totalFrames - g.origFrom));
      updateClip(clip.id, { durationInFrames: dur });
    } else {
      const from = Math.max(0, Math.min(g.origFrom + df, g.origFrom + g.origDur - 2));
      updateClip(clip.id, { from, durationInFrames: g.origDur + (g.origFrom - from) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    // vertical drags move the clip to the track the pointer was released over
    // (single clip only). Half a lane of travel is the threshold, so a small
    // jitter while dragging sideways never changes track.
    if (
      g &&
      g.mode === 'move' &&
      g.group.length === 1 &&
      Math.abs(e.clientY - g.startY) >= LANE_HEIGHT / 2
    ) {
      const lanes = Array.from(document.querySelectorAll<HTMLElement>('[data-track-lane]'));
      let target: string | undefined;
      let nearest = Infinity;
      for (const lane of lanes) {
        const rect = lane.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY < rect.bottom) {
          target = lane.dataset.trackLane;
          break;
        }
        // released outside every track — keep the nearest one
        const distance = e.clientY < rect.top ? rect.top - e.clientY : e.clientY - rect.bottom;
        if (distance < nearest) {
          nearest = distance;
          target = lane.dataset.trackLane;
        }
      }
      if (target && target !== trackId) {
        useStore.getState().moveClipToTrack(clip.id, target);
      }
    }
  };

  return (
    <div
      className={[
        'group absolute z-[1] flex cursor-grab touch-none items-center overflow-hidden rounded-[4px] border',
        accent.border,
        accent.fill,
        selected ? 'z-[3] ring-2 ring-ring' : '',
      ].join(' ')}
      style={{
        left: clip.from * ppf,
        width: Math.max(6, clip.durationInFrames * ppf),
        top: lane * LANE_HEIGHT + 3,
        height: LANE_HEIGHT - 6,
      }}
      onPointerDown={onPointerDown('move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(EFFECT_MIME)) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        const fx = e.dataTransfer.getData(EFFECT_MIME);
        if (fx) {
          e.preventDefault();
          e.stopPropagation();
          addEffect(clip.id, fx as EffectType);
          selectClip(clip.id);
        }
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-foreground/15"
        onPointerDown={onPointerDown('resize-l')}
      />
      <span className="flex min-w-0 flex-1 items-center gap-1 truncate px-1.5 text-[10px] leading-none text-foreground">
        <span className="truncate">
          {clip.groupId ? '⛓ ' : ''}
          {getComponent(clip.element)?.icon ?? '❓'} {clip.name}
        </span>
        {clip.effects.length > 0 ? (
          <span className="shrink-0 rounded-[3px] bg-primary/80 px-1 text-[9px] font-semibold text-primary-foreground">
            {clip.effects.length}fx
          </span>
        ) : null}
      </span>
      <span className="shrink-0 pr-1.5 font-mono text-[9px] tabular-nums text-muted-foreground">
        {framesToLabel(clip.durationInFrames, fps)}
      </span>
      <div
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-foreground/15"
        onPointerDown={onPointerDown('resize-r')}
      />
    </div>
  );
};
