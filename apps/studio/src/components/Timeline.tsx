import React, { useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { seekTo } from '../playerRef';
import { useStore } from '../store';
import { TrackRow } from './timeline/TrackRow';
import { TimelineRuler } from './timeline/TimelineRuler';
import { accentForTrack, framesToLabel, LABEL_COLUMN_WIDTH, RULER_HEIGHT } from './timeline/shared';

export const Timeline: React.FC = () => {
  const project = useStore((s) => s.project);
  const currentFrame = useStore((s) => s.currentFrame);
  const selectedCount = useStore((s) => s.selectedClipIds.length);
  const ppf = useStore((s) => s.pixelsPerFrame);
  const setPixelsPerFrame = useStore((s) => s.setPixelsPerFrame);
  const { addTrack } = useStore.getState();

  const scrollRef = useRef<HTMLDivElement>(null);
  const laneWidth = project.durationInFrames * ppf;
  const contentWidth = LABEL_COLUMN_WIDTH + laneWidth;

  // while playing, page the timeline forward when the playhead leaves the visible area
  const playing = useStore((s) => s.playing);
  React.useEffect(() => {
    if (!playing || !scrollRef.current) return;
    const el = scrollRef.current;
    const x = LABEL_COLUMN_WIDTH + currentFrame * ppf;
    if (x > el.scrollLeft + el.clientWidth - 30 || x < el.scrollLeft) {
      el.scrollLeft = Math.max(0, x - el.clientWidth * 0.12);
    }
  }, [currentFrame, ppf, playing]);

  const seekToFrame = (frame: number) => {
    const f = Math.max(0, Math.min(project.durationInFrames - 1, frame));
    seekTo(f);
    useStore.getState().setCurrentFrame(f);
  };

  // second markers for the ruler
  const marks: number[] = [];
  const secStep = ppf < 2 ? 2 : 1;
  for (let f = 0; f <= project.durationInFrames; f += project.fps * secStep) marks.push(f);

  return (
    <div className="flex h-full w-full flex-col border-t border-border bg-card">
      {/* toolbar */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <Button variant="ghost" size="xs" onClick={addTrack}>
          <Plus data-icon="inline-start" />
          Track
        </Button>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {framesToLabel(currentFrame, project.fps)} / {framesToLabel(project.durationInFrames, project.fps)}
          <span className="text-muted-foreground/70"> · f{currentFrame}</span>
        </span>
        {selectedCount > 1 ? (
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {selectedCount} selected
          </Badge>
        ) : null}
        <Separator orientation="vertical" className="h-4" />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Zoom</span>
          <input
            type="range"
            className="h-1 w-24 cursor-pointer"
            min={0.5}
            max={16}
            step={0.5}
            value={ppf}
            onChange={(e) => setPixelsPerFrame(Number(e.target.value))}
          />
        </div>
      </div>

      {/* tracks */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div className="relative min-h-full min-w-full" style={{ width: contentWidth }}>
          {/* ruler row: frozen corner cell plus the scrolling ruler */}
          <div className="sticky top-0 z-[20] flex bg-card">
            <div
              className="sticky left-0 z-[21] flex shrink-0 items-center border-b border-r border-border bg-card px-2 text-[10px] uppercase tracking-wide text-muted-foreground"
              style={{ width: LABEL_COLUMN_WIDTH, height: RULER_HEIGHT }}
            >
              Track
            </div>
            <div className="min-w-0 flex-1">
              <TimelineRuler
                marks={marks}
                fps={project.fps}
                ppf={ppf}
                currentFrame={currentFrame}
                onSeek={seekToFrame}
              />
            </div>
          </div>

          {project.tracks.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              index={i}
              total={project.tracks.length}
              accent={accentForTrack(i)}
            />
          ))}

          {/* playhead: the line spans the whole scroll area; the marker rides the sticky ruler */}
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-[5] w-px bg-primary"
            style={{ left: LABEL_COLUMN_WIDTH + currentFrame * ppf }}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-2 py-1 text-[10px] text-muted-foreground">
        Tip: ⌘/Ctrl-click to multi-select · ⌘C/⌘V copy-paste · ⌘D duplicate · drag edges to trim · drag effects
        onto clips · Space to play · Delete removes selection
      </div>
    </div>
  );
};
