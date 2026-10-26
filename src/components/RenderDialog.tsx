import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clapperboard, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStore } from '../store';

type Phase = 'idle' | 'starting' | 'bundling' | 'rendering' | 'done' | 'error' | 'no-server';

const CODE = 'rounded border border-border bg-secondary px-1 py-0.5 font-mono text-xs';

export const RenderDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const project = useStore((s) => s.project);
  const [scale, setScale] = useState(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);

  const outW = Math.round(project.width * scale);
  const outH = Math.round(project.height * scale);
  const seconds = (project.durationInFrames / project.fps).toFixed(1);

  const stopPolling = () => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => stopPolling, []);

  const start = async () => {
    setPhase('starting');
    setError('');
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, options: { scale } }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const { id } = await res.json();
      setJobId(id);
      setPhase('bundling');
      pollRef.current = window.setInterval(async () => {
        try {
          const r = await fetch(`/api/job/${id}`);
          const job = await r.json();
          setProgress(job.progress ?? 0);
          if (job.status === 'rendering') setPhase('rendering');
          if (job.status === 'done') {
            setPhase('done');
            stopPolling();
          }
          if (job.status === 'error') {
            setPhase('error');
            setError(job.error ?? 'Unknown render error');
            stopPolling();
          }
        } catch {
          /* transient poll failure — keep trying */
        }
      }, 800);
    } catch {
      setPhase('no-server');
    }
  };

  const canStart = phase === 'idle' || phase === 'no-server' || phase === 'error';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription>
            Render “{project.name}” to an H.264 MP4 with the local render server.
          </DialogDescription>
        </DialogHeader>

        {canStart ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="render-scale" className="text-xs text-muted-foreground">
                Resolution scale
              </Label>
              <Select value={String(scale)} onValueChange={(v) => setScale(Number(v))}>
                <SelectTrigger id="render-scale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="0.5">
                      0.5× — {Math.round(project.width / 2)}×{Math.round(project.height / 2)} (draft)
                    </SelectItem>
                    <SelectItem value="1">
                      1× — {project.width}×{project.height}
                    </SelectItem>
                    <SelectItem value="2">
                      2× — {project.width * 2}×{project.height * 2}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Output: <strong className="text-foreground">{outW}×{outH}</strong> @ {project.fps}fps · {seconds}s ·
              H.264 MP4
              <br />
              For native 4K60, set Size to a 4K preset and FPS to 60 in the top bar.
            </p>
            {phase === 'no-server' ? (
              <p className="text-xs leading-relaxed text-destructive">
                Could not reach the render server. Start the app with <code className={CODE}>npm run dev</code> (it
                launches both the editor and the render server), or render from a terminal:{' '}
                <code className={CODE}>npm run render</code> after saving your project.json.
              </p>
            ) : null}
            {phase === 'error' ? <p className="text-xs leading-relaxed text-destructive">Render failed: {error}</p> : null}
          </div>
        ) : null}

        {phase === 'starting' || phase === 'bundling' ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Preparing the renderer… (first render bundles the composition, ~20s)
          </p>
        ) : null}

        {phase === 'rendering' ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Rendering {outW}×{outH} @ {project.fps}fps…
            </p>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{Math.round(progress * 100)}%</p>
          </div>
        ) : null}

        {phase === 'done' && jobId ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              Render complete!
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Also saved to the <code className={CODE}>out/</code> folder of the project.
            </p>
          </div>
        ) : null}

        {canStart ? (
          <DialogFooter>
            <Button size="sm" onClick={start}>
              <Clapperboard data-icon="inline-start" />
              Start render
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        ) : null}

        {phase === 'done' && jobId ? (
          <DialogFooter>
            <Button asChild size="sm">
              <a href={`/api/download/${jobId}`} className="no-underline">
                <Download data-icon="inline-start" />
                Download MP4
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
