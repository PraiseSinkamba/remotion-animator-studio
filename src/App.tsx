import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Inspector } from './components/Inspector';
import { Library } from './components/Library';
import { PreviewPanel } from './components/PreviewPanel';
import { Timeline } from './components/Timeline';
import { TopBar } from './components/TopBar';
import { ToolRail } from './components/ToolRail';
import { togglePlay } from './playerRef';
import { useStore } from './store';
import { useWorkspace } from './storage/useWorkspace';

const LAYOUT_KEY = 'remotion-animator-layout';

interface Layout {
  libW: number;
  inspW: number;
  tlH: number;
}

const DEFAULT_LAYOUT: Layout = { libW: 200, inspW: 290, tlH: 250 };

const loadLayout = (): Layout => {
  try {
    return { ...DEFAULT_LAYOUT, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') };
  } catch {
    return DEFAULT_LAYOUT;
  }
};

/** A draggable divider between panes. */
const Divider: React.FC<{ vertical?: boolean; onDrag: (delta: number) => void }> = ({ vertical, onDrag }) => {
  const last = useRef(0);
  return (
    <div
      className={vertical ? 'divider divider-v' : 'divider divider-h'}
      onPointerDown={(e) => {
        last.current = vertical ? e.clientY : e.clientX;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        const pos = vertical ? e.clientY : e.clientX;
        onDrag(pos - last.current);
        last.current = pos;
      }}
    />
  );
};

export const App: React.FC = () => {
  const [layout, setLayout] = useState<Layout>(loadLayout);

  const patchLayout = useCallback((patch: Partial<Layout>) => {
    setLayout((l) => {
      const next = { ...l, ...patch };
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // The workspace keeps the project; the editor only holds the document.
  const workspace = useWorkspace();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      if (typing) return;
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Enter' && s.drawingPath) {
        e.preventDefault();
        s.finishDrawingPath();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedClipIds.length > 0) s.removeClips(s.selectedClipIds);
      } else if (e.key === 'Escape') {
        if (s.drawingPath) s.cancelDrawingPath();
        else s.selectClip(null);
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        s.copySelection();
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        s.paste(s.currentFrame);
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelection();
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) s.ungroupSelection();
        else s.groupSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <TopBar storage={workspace.state} onSave={() => void workspace.saveNow()} />
      <div className="main">
        <ToolRail />
        <div style={{ width: layout.libW, flexShrink: 0, display: 'flex', minWidth: 0 }}>
          <Library />
        </div>
        <Divider onDrag={(d) => patchLayout({ libW: Math.max(140, Math.min(420, layout.libW + d)) })} />
        <PreviewPanel />
        <Divider onDrag={(d) => patchLayout({ inspW: Math.max(200, Math.min(520, layout.inspW - d)) })} />
        <div style={{ width: layout.inspW, flexShrink: 0, display: 'flex', minWidth: 0 }}>
          <Inspector />
        </div>
      </div>
      <Divider vertical onDrag={(d) => patchLayout({ tlH: Math.max(140, Math.min(560, layout.tlH - d)) })} />
      <div style={{ height: layout.tlH, flexShrink: 0, display: 'flex', minHeight: 0 }}>
        <Timeline />
      </div>
    </div>
  );
};
