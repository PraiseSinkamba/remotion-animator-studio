import React, { useRef } from 'react';
import { getComponent } from '../registry';
import { seekTo } from '../playerRef';
import { useStore } from '../store';
import type { Clip, Track } from '../types';
import { EFFECT_MIME, ELEMENT_MIME, PRESET_MIME } from './Library';

const TRACK_HEIGHT = 44;

const framesToLabel = (frames: number, fps: number) => {
  const s = frames / fps;
  return s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`;
};

const isAdditive = (e: React.PointerEvent | React.MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey;

const ClipView: React.FC<{ clip: Clip; trackId: string }> = ({ clip, trackId }) => {
  const ppf = useStore((s) => s.pixelsPerFrame);
  const selected = useStore((s) => s.selectedClipIds.includes(clip.id));
  const totalFrames = useStore((s) => s.project.durationInFrames);
  const { selectClip, updateClip, shiftClips, addEffect, commit } = useStore.getState();

  const gesture = useRef<{
    mode: 'move' | 'resize-l' | 'resize-r';
    startX: number;
    startY: number;
    lastY: number;
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
      lastY: e.clientY,
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
      g.lastY = e.clientY;
    } else if (g.mode === 'resize-r') {
      const dur = Math.max(2, Math.min(g.origDur + df, totalFrames - g.origFrom));
      updateClip(clip.id, { durationInFrames: dur });
    } else {
      const from = Math.max(0, Math.min(g.origFrom + df, g.origFrom + g.origDur - 2));
      updateClip(clip.id, { from, durationInFrames: g.origDur + (g.origFrom - from) });
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    // vertical drags move the clip to another track on release (single clip only)
    if (g && g.mode === 'move' && g.group.length === 1) {
      const rows = Math.round((g.lastY - g.startY) / TRACK_HEIGHT);
      if (rows !== 0) {
        const s = useStore.getState();
        const idx = s.project.tracks.findIndex((t) => t.id === trackId);
        const target = Math.max(0, Math.min(s.project.tracks.length - 1, idx + rows));
        if (target !== idx) s.moveClipToTrack(clip.id, s.project.tracks[target].id);
      }
    }
  };

  return (
    <div
      className={`clip ${selected ? 'clip-selected' : ''} clip-${clip.element}`}
      style={{ left: clip.from * ppf, width: Math.max(6, clip.durationInFrames * ppf) }}
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
          addEffect(clip.id, fx as any);
          selectClip(clip.id);
        }
      }}
    >
      <div className="clip-handle clip-handle-l" onPointerDown={onPointerDown('resize-l')} />
      <span className="clip-label">
        {clip.groupId ? '⛓ ' : ''}
        {getComponent(clip.element)?.icon ?? '❓'} {clip.name}
        {clip.effects.length > 0 ? <span className="clip-fx-badge">{clip.effects.length}fx</span> : null}
      </span>
      <div className="clip-handle clip-handle-r" onPointerDown={onPointerDown('resize-r')} />
    </div>
  );
};

const TrackRow: React.FC<{ track: Track }> = ({ track }) => {
  const ppf = useStore((s) => s.pixelsPerFrame);
  const { addClip, moveClipToTrack } = useStore.getState();

  return (
    <div
      className="track-lane"
      style={{ height: TRACK_HEIGHT }}
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
        else addClip(el as any, track.id, frame);
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
        <ClipView key={c.id} clip={c} trackId={track.id} />
      ))}
    </div>
  );
};

export const Timeline: React.FC = () => {
  const project = useStore((s) => s.project);
  const currentFrame = useStore((s) => s.currentFrame);
  const selectedCount = useStore((s) => s.selectedClipIds.length);
  const ppf = useStore((s) => s.pixelsPerFrame);
  const setPixelsPerFrame = useStore((s) => s.setPixelsPerFrame);
  const { addTrack, removeTrack } = useStore.getState();

  const scrubRef = useRef<HTMLDivElement>(null);
  const headersRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const width = project.durationInFrames * ppf;

  // while playing, page the timeline forward when the playhead leaves the visible area
  const playing = useStore((s) => s.playing);
  React.useEffect(() => {
    if (!playing || !scrollRef.current) return;
    const el = scrollRef.current;
    const x = currentFrame * ppf;
    if (x > el.scrollLeft + el.clientWidth - 30 || x < el.scrollLeft) {
      el.scrollLeft = Math.max(0, x - el.clientWidth * 0.12);
    }
  }, [currentFrame, ppf, playing]);

  const seekFromEvent = (e: React.PointerEvent) => {
    if (!scrubRef.current) return;
    const rect = scrubRef.current.getBoundingClientRect();
    const frame = Math.max(
      0,
      Math.min(project.durationInFrames - 1, Math.round((e.clientX - rect.left) / ppf)),
    );
    seekTo(frame);
    useStore.getState().setCurrentFrame(frame);
  };

  // Second markers for the ruler
  const marks: number[] = [];
  const secStep = ppf < 2 ? 2 : 1;
  for (let f = 0; f <= project.durationInFrames; f += project.fps * secStep) marks.push(f);

  return (
    <div className="timeline">
      <div className="timeline-toolbar">
        <button className="btn btn-small" onClick={addTrack}>
          + Track
        </button>
        <span className="timeline-time">
          {framesToLabel(currentFrame, project.fps)} / {framesToLabel(project.durationInFrames, project.fps)}
          <span className="dim"> · frame {currentFrame}</span>
          {selectedCount > 1 ? <span className="dim"> · {selectedCount} clips selected</span> : null}
        </span>
        <div className="timeline-zoom">
          <span className="dim">Zoom</span>
          <input
            type="range"
            min={0.5}
            max={16}
            step={0.5}
            value={ppf}
            onChange={(e) => setPixelsPerFrame(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="timeline-body">
        <div className="track-headers" ref={headersRef}>
          <div className="ruler-spacer" />
          {project.tracks.map((t, i) => (
            <div key={t.id} className="track-header" style={{ height: TRACK_HEIGHT }}>
              <input
                className="track-name-input"
                value={t.name}
                title="Rename track"
                onFocus={() => useStore.getState().commit()}
                onChange={(e) => useStore.getState().renameTrack(t.id, e.target.value)}
              />
              <span className="track-btns">
                <button
                  className="track-btn"
                  title="Move layer up"
                  disabled={i === 0}
                  onClick={() => useStore.getState().moveTrack(t.id, -1)}
                >
                  ▲
                </button>
                <button
                  className="track-btn"
                  title="Move layer down"
                  disabled={i === project.tracks.length - 1}
                  onClick={() => useStore.getState().moveTrack(t.id, 1)}
                >
                  ▼
                </button>
                <button className="track-delete" title="Delete track" onClick={() => removeTrack(t.id)}>
                  ×
                </button>
              </span>
            </div>
          ))}
        </div>

        <div
          className="timeline-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            // keep the header column aligned with vertical scrolling
            if (headersRef.current) headersRef.current.scrollTop = (e.target as HTMLElement).scrollTop;
          }}
        >
          <div className="timeline-content" style={{ width }} ref={scrubRef}>
            <div
              className="ruler"
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                seekFromEvent(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) seekFromEvent(e);
              }}
            >
              {marks.map((f) => (
                <div key={f} className="ruler-mark" style={{ left: f * ppf }}>
                  <span>{framesToLabel(f, project.fps)}</span>
                </div>
              ))}
            </div>

            {project.tracks.map((t) => (
              <TrackRow key={t.id} track={t} />
            ))}

            <div className="playhead" style={{ left: currentFrame * ppf }} />
          </div>
        </div>
      </div>
      <div className="timeline-hint dim">
        Tip: ⌘/Ctrl-click to multi-select · ⌘C/⌘V copy-paste · ⌘D duplicate · drag edges to trim · drag
        effects onto clips · Space to play · Delete removes selection
      </div>
    </div>
  );
};
