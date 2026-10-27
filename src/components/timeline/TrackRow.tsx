import React from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useStore } from '../../store';
import type { ElementType, Track } from '../../types';
import { ClipChip } from './ClipChip';
import { LABEL_COLUMN_WIDTH, TRACK_HEIGHT, type TrackAccent } from './shared';
import { ELEMENT_MIME, PRESET_MIME } from '../Library';

const isAdditive = (e: React.PointerEvent | React.MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey;

/**
 * One track row: the frozen label cell on the left, the clip lane on the right.
 * The label cell is sticky on the left, so the column stays put while the
 * lanes scroll horizontally.
 */
export const TrackRow: React.FC<{
  track: Track;
  index: number;
  total: number;
  accent: TrackAccent;
}> = ({ track, index, total, accent }) => {
  const ppf = useStore((s) => s.pixelsPerFrame);
  const fps = useStore((s) => s.project.fps);
  const { addClip, moveClipToTrack } = useStore.getState();
  // one gridline per ruler mark, so the lane grid lines up with the ruler
  const period = fps * (ppf < 2 ? 2 : 1) * ppf;

  return (
    <div className="flex">
      {/* label cell */}
      <div
        className="sticky left-0 z-[10] flex shrink-0 items-center gap-1.5 border-b border-r border-border bg-card px-2"
        style={{ width: LABEL_COLUMN_WIDTH, height: TRACK_HEIGHT }}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-[2px] ${accent.dot}`} />
        <input
          className="min-w-0 flex-1 truncate rounded-[3px] border border-transparent bg-transparent px-1 text-[11px] leading-none text-foreground outline-none hover:border-border focus:border-border focus:bg-muted"
          value={track.name}
          title="Rename track"
          onFocus={() => useStore.getState().commit()}
          onChange={(e) => useStore.getState().renameTrack(track.id, e.target.value)}
        />
        <span className="flex shrink-0 items-center">
          <button
            className="rounded-[3px] p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
            title="Move layer up"
            disabled={index === 0}
            onClick={() => useStore.getState().moveTrack(track.id, -1)}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            className="rounded-[3px] p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
            title="Move layer down"
            disabled={index === total - 1}
            onClick={() => useStore.getState().moveTrack(track.id, 1)}
          >
            <ChevronDown className="size-3" />
          </button>
          <button
            className="rounded-[3px] p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete track"
            onClick={() => useStore.getState().removeTrack(track.id)}
          >
            <X className="size-3" />
          </button>
        </span>
      </div>

      {/* clip lane */}
      <div
        className="relative flex-1 border-b border-border bg-card"
        style={{
          height: TRACK_HEIGHT,
          backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${
            period - 1
          }px, color-mix(in oklab, var(--border) 45%, transparent) ${period}px)`,
        }}
        onDragOver={(e) => {
          if (
            e.dataTransfer.types.includes(ELEMENT_MIME) ||
            e.dataTransfer.types.includes(PRESET_MIME)
          ) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={(e) => {
          const el = e.dataTransfer.getData(ELEMENT_MIME);
          const preset = e.dataTransfer.getData(PRESET_MIME);
          if (!el && !preset) return;
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const frame = Math.max(0, Math.round((e.clientX - rect.left) / ppf));
          if (preset) useStore.getState().addPreset(preset, frame);
          else addClip(el as ElementType, track.id, frame);
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            const sel = useStore.getState().selectedClipIds;
            if (sel.length === 1 && e.shiftKey) {
              useStore.getState().commit();
              moveClipToTrack(sel[0], track.id);
            } else if (!isAdditive(e)) useStore.getState().selectClip(null);
          }
        }}
      >
        {track.clips.map((c) => (
          <ClipChip key={c.id} clip={c} trackId={track.id} accent={accent} />
        ))}
      </div>
    </div>
  );
};
