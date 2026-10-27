import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EFFECTS } from '../effects';
import { listComponents } from '../registry';
import { PRESETS } from '../presets';
import { useStore } from '../store';
import type { EffectType } from '../types';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GROUP_DOT, TABS, type TabDef } from './library/catalog';
import { EffectsSection } from './library/effects-section';
import { GroupHeader } from './library/group-header';
import { LibraryCard, LibraryRow, type LibraryItem } from './library/library-card';
import { ELEMENT_MIME, EFFECT_MIME, PRESET_MIME } from './library/mime';
import { ViewToggle, readLibraryView, writeLibraryView, type LibraryView } from './library/view-toggle';

export { ELEMENT_MIME, EFFECT_MIME, PRESET_MIME };

const TabBody: React.FC<{ tab: TabDef; view: LibraryView; query: string }> = ({
  tab,
  view,
  query,
}) => {
  const addClip = useStore((s) => s.addClip);
  const addEffect = useStore((s) => s.addEffect);
  const addPreset = useStore((s) => s.addPreset);
  const project = useStore((s) => s.project);
  const currentFrame = useStore((s) => s.currentFrame);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const definitions = useMemo(() => listComponents(), []);
  const q = query.trim().toLowerCase();
  const matches = (label: string, description: string) =>
    q === '' || label.toLowerCase().includes(q) || description.toLowerCase().includes(q);

  /** Presets carry no duration of their own — derive it from the clips they build. */
  const presetDurations = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, preset] of Object.entries(PRESETS)) {
      const frames = preset
        .build(project.width, project.height)
        .reduce((max, spec) => Math.max(max, spec.offset + spec.duration), 0);
      out[key] = `${(frames / project.fps).toFixed(1)}s`;
    }
    return out;
  }, [project.width, project.height, project.fps]);

  const items: LibraryItem[] =
    tab.id === 'presets'
      ? Object.entries(PRESETS)
          .filter(([, preset]) => matches(preset.label, preset.description))
          .map(([key, preset]) => ({
            id: key,
            label: preset.label,
            icon: preset.icon,
            description: preset.description,
            chip: key,
            duration: presetDurations[key],
            onAdd: () => addPreset(key, currentFrame),
            onDragStart: (e: React.DragEvent) => {
              e.dataTransfer.setData(PRESET_MIME, key);
              e.dataTransfer.effectAllowed = 'copy';
            },
          }))
      : definitions
          .filter((d) => tab.types.includes(d.type) && matches(d.label, d.description))
          .map((d) => ({
            id: d.type,
            label: d.label,
            icon: d.icon,
            description: d.description,
            chip: d.type,
            onAdd: () => {
              const track = project.tracks[0];
              if (track) addClip(d.type, track.id, currentFrame);
            },
            addButton: true,
            onDragStart: (e: React.DragEvent) => {
              e.dataTransfer.setData(ELEMENT_MIME, d.type);
              e.dataTransfer.effectAllowed = 'copy';
            },
          }));

  const effectItems = (Object.keys(EFFECTS) as EffectType[])
    .filter((key) => {
      const effect = EFFECTS[key];
      return (
        q === '' ||
        effect.label.toLowerCase().includes(q) ||
        effect.description.toLowerCase().includes(q)
      );
    })
    .map((key) => ({
      key,
      item: {
        id: key,
        label: EFFECTS[key].label,
        icon: EFFECTS[key].icon,
        description: EFFECTS[key].description,
        chip: key,
        compact: true,
        onAdd: () => {
          for (const id of selectedClipIds) addEffect(id, key);
        },
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.setData(EFFECT_MIME, key);
          e.dataTransfer.effectAllowed = 'copy';
        },
      } as LibraryItem,
    }));

  const total = items.length;

  return (
    <div className="h-full overflow-y-auto px-2 pb-2">
      <p className="py-1.5 text-[10px] text-muted-foreground">
        {tab.id === 'presets'
          ? 'Double-click to insert at the playhead'
          : 'Drag onto a timeline track, or double-click to add'}
      </p>
      {total === 0 ? (
        effectItems.length === 0 ? (
          <p className="py-2 text-[11px] text-muted-foreground">Nothing matches “{query}”.</p>
        ) : null
      ) : (
        <>
          <GroupHeader label={tab.label} count={total} dot={GROUP_DOT} />
          <div className={view === 'grid' ? 'grid grid-cols-2 gap-1.5' : 'flex flex-col gap-1'}>
            {items.map((item) =>
              view === 'grid' ? (
                <LibraryCard key={item.id} item={item} />
              ) : (
                <LibraryRow key={item.id} item={item} />
              ),
            )}
          </div>
        </>
      )}
      <EffectsSection items={effectItems} />
    </div>
  );
};

export const Library: React.FC = () => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState(TABS[0].id);
  const [view, setView] = useState<LibraryView>(readLibraryView);
  const definitions = useMemo(() => listComponents(), []);

  /** A tab with no source entries is not offered. */
  const visibleTabs = TABS.filter(
    (t) =>
      t.id === 'presets'
        ? Object.keys(PRESETS).length > 0
        : definitions.some((d) => t.types.includes(d.type)),
  );

  return (
    <aside className="flex min-h-0 w-full flex-col overflow-hidden bg-card">
      <div className="flex items-center gap-1.5 border-b border-border p-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="h-7 pl-7 text-xs"
            type="search"
            placeholder="Search presets, elements, effects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ViewToggle
          view={view}
          onChange={(next) => {
            setView(next);
            writeLibraryView(next);
          }}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className="group-data-[orientation=horizontal]/tabs:h-auto flex w-full flex-wrap items-center justify-start gap-1 rounded-none border-b border-border bg-transparent p-1.5">
          {visibleTabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="h-6 flex-none rounded-full border border-border bg-muted px-2.5 text-[11px] font-medium text-muted-foreground data-[state=active]:border-primary/50 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-0 min-h-0 flex-1 overflow-hidden">
            <TabBody tab={t} view={view} query={query} />
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  );
};
