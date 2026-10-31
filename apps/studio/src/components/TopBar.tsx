import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  CircleHelp,
  Clapperboard,
  Download,
  FolderOpen,
  Loader2,
  Plus,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import { migrateProject } from '@chart-studio/components';
import { useStore } from '@chart-studio/editor';
import type { WorkspaceUiState } from '@chart-studio/editor';
import type { Project } from '@chart-studio/core';
import { Button } from '@chart-studio/ui';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@chart-studio/ui';
import { cn } from '@chart-studio/ui';
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
  className?: string;
  disabled?: boolean;
}> = ({ value, title, min = 16, max = 7680, list, onCommit, className, disabled }) => {
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
      disabled={disabled}
      min={min}
      max={max}
      value={text}
      title={title}
      list={list}
      aria-label={title}
      className={cn('w-[72px] shrink-0 border-0! bg-transparent! p-0! text-right font-mono text-xs leading-none text-foreground outline-none disabled:text-muted-foreground', className)}
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
    <span className="text-[10px] tracking-wide text-muted-foreground">{label}</span>
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
  const durationMode = useStore((s) => s.project.durationMode ?? 'fixed');
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

  const newProject = () => {
    if (window.confirm('Start a new project? (Current work stays in undo history)')) {
      fileHandleRef.current = null;
      replaceProject(blankProject());
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

  const formatControls = (
    <div className="flex shrink-0 items-center gap-2">
      <Select value={sizeKey} onValueChange={(value) => {
        const preset = SIZE_PRESETS[value];
        if (preset) resizeProject(preset[0], preset[1]);
      }}>
        <SelectTrigger size="sm" className="h-7 w-[158px] shrink-0 text-xs" aria-label="Composition preset" title="Changing size rescales all content to fit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent><SelectGroup>
          {[...Object.keys(SIZE_PRESETS), 'Custom'].map((key) => <SelectItem key={key} value={key}>{key}</SelectItem>)}
        </SelectGroup></SelectContent>
      </Select>
      <ValueChip label="Width">
        <SizeInput value={project.width} title="Width" onCommit={(width) => resizeProject(width, project.height)} />
      </ValueChip>
      <span className="text-xs text-muted-foreground" aria-hidden="true">×</span>
      <ValueChip label="Height">
        <SizeInput value={project.height} title="Height" onCommit={(height) => resizeProject(project.width, height)} />
      </ValueChip>
      <ValueChip label="FPS">
        <SizeInput value={project.fps} title="FPS" className="w-[54px]" min={1} max={240} list="fps-presets" onCommit={(fps) => {
          const seconds = project.durationInFrames / project.fps;
          setProject({ fps, durationInFrames: Math.round(seconds * fps) });
        }} />
      </ValueChip>
      <datalist id="fps-presets">{FPS_PRESETS.map((fps) => <option key={fps} value={fps} />)}</datalist>
      <span className="h-5 w-px bg-border" aria-hidden="true" />
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">Duration</span>
        <Select value={durationMode} onValueChange={(value: 'fixed' | 'derived') => useStore.getState().setDurationMode(value)}>
          <SelectTrigger size="sm" className="h-7 w-[116px] text-xs" aria-label="Duration mode"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="derived">From content</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1" title={durationMode === 'derived' ? 'Duration follows the content' : 'Set the composition length in seconds'}>
          <SizeInput value={Math.round(project.durationInFrames / project.fps)} title="Duration in seconds" className="w-[54px]" min={1} max={3600} disabled={durationMode === 'derived'} onCommit={(seconds) => useStore.getState().setFixedDuration(seconds)} />
          <span className="text-xs text-muted-foreground">s</span>
        </div>
        <input type="range" min={1} max={3600} aria-label="Duration slider" aria-valuetext={`${Math.round(project.durationInFrames / project.fps)} seconds`} title="Drag to adjust the duration in seconds" disabled={durationMode === 'derived'} value={Math.round(project.durationInFrames / project.fps)} onChange={(event) => useStore.getState().setFixedDuration(Math.max(1, Number(event.target.value)))} className="h-1 w-20 accent-foreground disabled:opacity-40" />
      </div>
    </div>
  );

  return (
    <header className="shrink-0 border-b border-border bg-card/90 backdrop-blur-md">
      <div aria-label="Project toolbar" className="flex min-h-10 items-center gap-2 border-b border-border/60 px-3 py-1">
        {/* Brand */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <Clapperboard className="size-4" aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold text-foreground">ChartStudio</span>

        </div>

        {/* Project name — the field only shows itself on hover */}
        <div className="group flex min-w-0 items-center gap-1">
          <input
            aria-label="Project name"
            value={project.name}
            onChange={(e) => setProject({ name: e.target.value })}
            className="h-7 w-full min-w-16 max-w-[200px] rounded-md border border-transparent bg-transparent px-2 text-xs font-medium text-foreground outline-none transition-colors group-hover:border-border group-hover:bg-background focus-visible:border-ring"
          />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            title="New project"
            onClick={newProject}
          >
            <Plus data-icon="inline-start" />
            New
          </Button>
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
            <Button variant="ghost" size="sm" className="text-xs" onClick={saveAs} title="Save to a new file">
              Save As…
            </Button>
          ) : null}
        </div>
        <div className="flex-1" />
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Help & docs"
            onClick={() => setShowHelp(true)}
            title="Help & docs"
          >
            <CircleHelp data-icon="inline-start" />
          </Button>
          <ThemeToggle />
        </div>
        {/* Saved status */}
        {storage ? (
          <div
            className={cn(
              'flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-background/60 py-0.5 pl-2 pr-1.5',
              '[&_[data-slot=badge]]:shrink [&_button]:whitespace-normal [&_button]:text-left [&_[data-slot=badge]]:h-auto [&_[data-slot=badge]]:border-0 [&_[data-slot=badge]]:bg-transparent [&_[data-slot=badge]]:px-0 [&_[data-slot=badge]]:text-xs [&_[data-slot=badge]]:font-medium [&_[data-slot=badge]]:text-foreground',
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

      </div>
      <div aria-label="Editing toolbar" className="flex min-h-10 items-center gap-2 px-3 py-1">
        <div className="flex shrink-0 items-center gap-0.5 border-r border-border pr-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-7 px-0"
            disabled={!canUndo}
            onClick={undo}
            aria-label="Undo"
            title="Undo (Ctrl/⌘Z)"
          >
            <Undo2 data-icon="inline-start" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-7 px-0"
            disabled={!canRedo}
            onClick={redo}
            aria-label="Redo"
            title="Redo (Ctrl/⌘⇧Z)"
          >
            <Redo2 data-icon="inline-start" />
          </Button>
        </div>
        {formatControls}
        <div className="flex-1" />
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
        <Button
          variant="default"
          className="h-[30px] shrink-0 gap-1.5 px-3 text-xs font-semibold"
          onClick={() => setShowExport(true)}
          title="Export the project as an MP4"
        >
          <Download data-icon="inline-start" />
          Export MP4
        </Button>

      </div>
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
