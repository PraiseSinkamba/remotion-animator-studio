import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Download,
  FolderOpen,
  Loader2,
  Plus,
  Redo2,
  Save,
  SkipBack,
  Undo2,
} from 'lucide-react';
import { seekTo } from '../playerRef';
import { migrateProject } from '../project/migrate';
import { useStore } from '../store';
import type { WorkspaceUiState } from '../storage/useWorkspace';
import type { Project } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { HelpModal } from './HelpModal';
import { RenderDialog } from './RenderDialog';
import { StorageIndicator } from './StorageIndicator';
import { ThemeToggle } from './theme-toggle';

const SIZE_PRESETS: Record<string, [number, number]> = {
  'HD 1920×1080': [1920, 1080],
  '4K UHD 3840×2160': [3840, 2160],
  '4K DCI 4096×2160': [4096, 2160],
  'Vertical 1080×1920': [1080, 1920],
  'Vertical 4K 2160×3840': [2160, 3840],
  'Square 1080×1080': [1080, 1080],
  'Portrait 4:5 1080×1350': [1080, 1350],
  'Ultrawide 2560×1080': [2560, 1080],
};

const FPS_PRESETS = [24, 25, 30, 50, 60];

const PROJECT_FILE_TYPES = [
  { description: 'Animator project', accept: { 'application/json': ['.json'] as const } },
];

/** Number input that applies on blur/Enter (so typing "3840" doesn't rescale at "3") */
const SizeInput: React.FC<{
  value: number;
  title: string;
  min?: number;
  max?: number;
  list?: string;
  onCommit: (v: number) => void;
}> = ({ value, title, min = 16, max = 7680, list, onCommit }) => {
  const [text, setText] = useState(String(value));
  React.useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Math.max(min, Math.min(max, Number(text) || value));
    setText(String(v));
    if (v !== value) onCommit(v);
  };
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={text}
      title={title}
      list={list}
      aria-label={title}
      className="w-[52px] bg-transparent text-right font-mono text-[11px] leading-none text-foreground outline-none"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
};

/** One editable figure in the format group: a micro label and a mono value. */
const ValueChip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    {children}
  </span>
);

const blankProject = (): Project => ({
  name: 'Untitled',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#0d0d14',
  tracks: [
    { id: `t-${Date.now()}-1`, name: 'Track 1', clips: [] },
    { id: `t-${Date.now()}-2`, name: 'Track 2', clips: [] },
  ],
});

export interface TopBarProps {
  /** The health of the workspace storage, shown as a chip. */
  storage?: WorkspaceUiState;
  /** Commits the document to the workspace right away. */
  onSave?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ storage, onSave }) => {
  const project = useStore((s) => s.project);
  const canUndo = useStore((s) => s.history.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const { setProject, resizeProject, replaceProject, undo, redo } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  // File System Access API handle of the opened/saved file — lets Save overwrite in place
  const fileHandleRef = useRef<any>(null);
  const [showExport, setShowExport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [stillBusy, setStillBusy] = useState(false);
  const fsAccess = 'showSaveFilePicker' in window;

  const currentJson = () => JSON.stringify(useStore.getState().project, null, 2);

  const downloadJson = () => {
    const blob = new Blob([currentJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/[^a-z0-9-_ ]/gi, '') || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const flashSaved = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  const writeToHandle = async (handle: any) => {
    const writable = await handle.createWritable();
    await writable.write(currentJson());
    await writable.close();
    flashSaved();
  };

  const saveAs = async () => {
    if (!fsAccess) {
      downloadJson();
      return;
    }
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${project.name.replace(/[^a-z0-9-_ ]/gi, '') || 'project'}.json`,
        types: PROJECT_FILE_TYPES,
      });
      fileHandleRef.current = handle;
      await writeToHandle(handle);
    } catch {
      /* user cancelled the picker */
    }
  };

  const save = async () => {
    if (fileHandleRef.current) {
      try {
        await writeToHandle(fileHandleRef.current);
        return;
      } catch {
        /* stale handle (file moved?) — fall back to Save As */
      }
    }
    await saveAs();
  };

  const loadJson = (file: File) => {
    file.text().then((text) => {
      try {
        replaceProject(migrateProject(JSON.parse(text)));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'That file does not look like a saved project.');
      }
    });
  };

  const open = async () => {
    if (!fsAccess) {
      fileRef.current?.click();
      return;
    }
    try {
      const [handle] = await (window as any).showOpenFilePicker({ types: PROJECT_FILE_TYPES });
      fileHandleRef.current = handle;
      loadJson(await handle.getFile());
    } catch {
      /* user cancelled the picker */
    }
  };

  const exportStill = async () => {
    const s = useStore.getState();
    setStillBusy(true);
    try {
      const res = await fetch('/api/still', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: s.project, frame: s.currentFrame, scale: 1 }),
      });
      if (!res.ok) throw new Error(`server ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${s.project.name.replace(/[^a-z0-9-_ ]/gi, '') || 'frame'}-f${s.currentFrame}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      alert('Could not render the still — is the render server running? (npm run dev starts it)');
    } finally {
      setStillBusy(false);
    }
  };

  const sizeKey =
    Object.keys(SIZE_PRESETS).find(
      (k) => SIZE_PRESETS[k][0] === project.width && SIZE_PRESETS[k][1] === project.height,
    ) ?? 'Custom';

  /** The colour of the dot in the saved-status chip. */
  const storageTone = !storage
    ? ''
    : storage.error || storage.status.problem || !storage.status.durable
      ? 'bg-destructive'
      : storage.saving
        ? 'bg-muted-foreground'
        : 'bg-primary';

  return (
    <header className="flex h-13 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-card/90 px-3 py-1.5 backdrop-blur-md">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
          <Clapperboard className="size-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold text-foreground">ChartStudio</span>
        <Badge
          variant="secondary"
          className="h-4 px-1.5 text-[10px] font-medium text-muted-foreground"
        >
          v0.1.0
        </Badge>
      </div>

      {/* Project name — the field only shows itself on hover */}
      <div className="group flex shrink-0 items-center gap-1">
        <input
          aria-label="Project name"
          value={project.name}
          onChange={(e) => setProject({ name: e.target.value })}
          className="h-7 w-[170px] rounded-md border border-transparent bg-transparent px-2 text-xs font-medium text-foreground outline-none transition-colors group-hover:border-border group-hover:bg-background focus-visible:border-ring"
        />
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* File and render actions */}
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          title="New project"
          onClick={() => {
            if (window.confirm('Start a new project? (Current work stays in undo history)')) {
              fileHandleRef.current = null;
              replaceProject(blankProject());
            }
          }}
        >
          <Plus data-icon="inline-start" />
          New
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={save}
          title={fsAccess ? 'Overwrites the opened file' : 'Downloads a JSON file'}
        >
          {savedFlash ? (
            <>
              <Check data-icon="inline-start" />
              Saved
            </>
          ) : (
            <>
              <Save data-icon="inline-start" />
              Save
            </>
          )}
        </Button>
        {fsAccess ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={saveAs}
            title="Save to a new file"
          >
            Save As…
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={open}
          title="Open a saved project"
        >
          <FolderOpen data-icon="inline-start" />
          Open
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setShowHelp(true)}
          title="Help & docs"
        >
          <CircleHelp data-icon="inline-start" />
          Help
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={exportStill}
          disabled={stillBusy}
          title="Render the current frame as a PNG"
        >
          {stillBusy ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              Rendering…
            </>
          ) : (
            <>
              <Camera data-icon="inline-start" />
              Still
            </>
          )}
        </Button>
      </div>

      {/* Format group — preset, size, duration, fps. It shrinks first so the
          save, theme and export actions on the right stay reachable. */}
      <div className="flex min-w-0 shrink items-center gap-1 overflow-hidden rounded-lg border border-border bg-background/80 px-1.5 py-1">
        <Select
          value={sizeKey}
          onValueChange={(v) => {
            const preset = SIZE_PRESETS[v];
            if (preset) resizeProject(preset[0], preset[1]);
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-6 w-[124px] shrink-0 border-0 bg-muted text-xs font-medium"
            title="Changing size rescales all content to fit"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {[...Object.keys(SIZE_PRESETS), 'Custom'].map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <span className="h-4 w-px bg-border" aria-hidden="true" />
        <ValueChip label="W">
          <SizeInput
            value={project.width}
            title="Width"
            onCommit={(v) => resizeProject(v, project.height)}
          />
        </ValueChip>
        <span className="text-[11px] text-muted-foreground" aria-hidden="true">
          ×
        </span>
        <ValueChip label="H">
          <SizeInput
            value={project.height}
            title="Height"
            onCommit={(v) => resizeProject(project.width, v)}
          />
        </ValueChip>

        <div className="hidden shrink-0 items-center gap-1 xl:flex">
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <ValueChip label="s">
            <input
              type="number"
              min={1}
              max={3600}
              aria-label="Duration in seconds"
              title="Duration in seconds"
              value={Math.round(project.durationInFrames / project.fps)}
              onChange={(e) =>
                setProject({ durationInFrames: Math.max(1, Number(e.target.value)) * project.fps })
              }
              className="w-[34px] bg-transparent text-right font-mono text-[11px] leading-none text-foreground outline-none"
            />
          </ValueChip>

          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <ValueChip label="FPS">
            <SizeInput
              value={project.fps}
              title="FPS"
              min={1}
              max={240}
              list="fps-presets"
              onCommit={(fps) => {
                const seconds = project.durationInFrames / project.fps;
                setProject({ fps, durationInFrames: Math.round(seconds * fps) });
              }}
            />
          </ValueChip>
        </div>
        <datalist id="fps-presets">
          {FPS_PRESETS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </div>

      {/* Jump to start, undo, redo */}
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-7 px-0"
          onClick={() => seekTo(0)}
          title="Back to start"
        >
          <SkipBack data-icon="inline-start" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-7 px-0"
          disabled={!canUndo}
          onClick={undo}
          title="Undo (⌘Z)"
        >
          <Undo2 data-icon="inline-start" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-7 px-0"
          disabled={!canRedo}
          onClick={redo}
          title="Redo (⇧⌘Z)"
        >
          <Redo2 data-icon="inline-start" />
        </Button>
      </div>

      <div className="flex-1" />

      {/* Saved status */}
      {storage ? (
        <div
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/60 py-0.5 pl-2 pr-1.5',
            '[&_[data-slot=badge]]:h-auto [&_[data-slot=badge]]:border-0 [&_[data-slot=badge]]:bg-transparent [&_[data-slot=badge]]:px-0 [&_[data-slot=badge]]:text-xs [&_[data-slot=badge]]:font-medium [&_[data-slot=badge]]:text-foreground',
          )}
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', storageTone)} aria-hidden="true" />
          <StorageIndicator
            status={storage.status}
            saving={storage.saving}
            error={storage.error}
            onSave={onSave}
          />
        </div>
      ) : null}

      <ThemeToggle />

      <Button
        variant="default"
        className="h-[30px] gap-1.5 px-3 text-xs font-semibold"
        onClick={() => setShowExport(true)}
        title="Export the project as an MP4"
      >
        <Download data-icon="inline-start" />
        Export MP4
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadJson(f);
          e.target.value = '';
        }}
      />

      {showExport ? <RenderDialog onClose={() => setShowExport(false)} /> : null}
      {showHelp ? <HelpModal onClose={() => setShowHelp(false)} /> : null}
    </header>
  );
};
