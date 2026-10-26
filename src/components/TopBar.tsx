import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  CircleHelp,
  Clapperboard,
  Download,
  FolderOpen,
  Loader2,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  SkipBack,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playerRef, seekTo, togglePlay } from '../playerRef';
import { migrateProject } from '../project/migrate';
import { useStore } from '../store';
import type { WorkspaceUiState } from '../storage/useWorkspace';
import type { Project } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpModal } from './HelpModal';
import { RenderDialog } from './RenderDialog';
import { StorageIndicator } from './StorageIndicator';

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
    <Input
      type="number"
      min={min}
      max={max}
      value={text}
      title={title}
      list={list}
      className="w-[62px]"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
};

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
  const playing = useStore((s) => s.playing);
  const muted = useStore((s) => s.muted);
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

  return (
    <header className="topbar">
      <div className="brand">
        <Clapperboard className="mr-1 inline size-4 align-text-bottom" aria-hidden="true" />
        <strong>Remotion Animator</strong>
      </div>

      <Input
        className="w-[170px]"
        value={project.name}
        onChange={(e) => setProject({ name: e.target.value })}
      />

      <div className="topbar-group">
        <Button variant="ghost" size="icon" onClick={() => seekTo(0)} title="Back to start">
          <SkipBack data-icon="inline-start" />
        </Button>
        <Button variant="outline" size="sm" className="min-w-[84px]" onClick={togglePlay}>
          {playing ? (
            <>
              <Pause data-icon="inline-start" />
              Pause
            </>
          ) : (
            <>
              <Play data-icon="inline-start" />
              Play
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title={muted ? 'Unmute preview' : 'Mute preview'}
          onClick={() => {
            const m = !muted;
            useStore.getState().setMuted(m);
            if (m) playerRef.current?.mute();
            else playerRef.current?.unmute();
          }}
        >
          {muted ? <VolumeX data-icon="inline-start" /> : <Volume2 data-icon="inline-start" />}
        </Button>
      </div>

      <div className="topbar-group">
        <label className="dim">Size</label>
        <Select
          value={sizeKey}
          onValueChange={(v) => {
            const preset = SIZE_PRESETS[v];
            if (preset) resizeProject(preset[0], preset[1]);
          }}
        >
          <SelectTrigger size="sm" className="w-[210px]" title="Changing size rescales all content to fit">
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
        <SizeInput value={project.width} title="Width" onCommit={(v) => resizeProject(v, project.height)} />
        <span className="dim">×</span>
        <SizeInput value={project.height} title="Height" onCommit={(v) => resizeProject(project.width, v)} />
        <label className="dim">Sec</label>
        <Input
          type="number"
          min={1}
          max={3600}
          value={Math.round(project.durationInFrames / project.fps)}
          onChange={(e) =>
            setProject({ durationInFrames: Math.max(1, Number(e.target.value)) * project.fps })
          }
          className="w-[52px]"
        />
        <label className="dim">FPS</label>
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
        <datalist id="fps-presets">
          {FPS_PRESETS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </div>

      <div className="topbar-group">
        <Button variant="ghost" size="icon" disabled={!canUndo} onClick={undo} title="Undo (⌘Z)">
          <Undo2 data-icon="inline-start" />
        </Button>
        <Button variant="ghost" size="icon" disabled={!canRedo} onClick={redo} title="Redo (⇧⌘Z)">
          <Redo2 data-icon="inline-start" />
        </Button>
      </div>

      <div className="topbar-spacer" />

      {storage ? (
        <div className="topbar-group">
          <StorageIndicator
            status={storage.status}
            saving={storage.saving}
            error={storage.error}
            onSave={onSave}
          />
        </div>
      ) : null}

      <div className="topbar-group">
        <Button
          variant="outline"
          size="sm"
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
          variant="outline"
          size="sm"
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
          <Button variant="outline" size="sm" onClick={saveAs} title="Save to a new file">
            Save As…
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={open}>
          <FolderOpen data-icon="inline-start" />
          Open
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowHelp(true)} title="Help & docs">
          <CircleHelp data-icon="inline-start" />
          Help
        </Button>
        <Button
          variant="outline"
          size="sm"
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
        <Button size="sm" onClick={() => setShowExport(true)}>
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
      </div>

      {showExport ? <RenderDialog onClose={() => setShowExport(false)} /> : null}
      {showHelp ? <HelpModal onClose={() => setShowHelp(false)} /> : null}
    </header>
  );
};
