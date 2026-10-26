import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { EFFECTS } from '../effects';
import { CATEGORY_LABELS, CATEGORY_ORDER, listComponentsByCategory } from '../registry';
import { PRESETS } from '../presets';
import { useStore } from '../store';
import type { EffectType } from '../types';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export const ELEMENT_MIME = 'application/x-animator-element';
export const EFFECT_MIME = 'application/x-animator-effect';
export const PRESET_MIME = 'application/x-animator-preset';

export const Library: React.FC = () => {
  const addClip = useStore((s) => s.addClip);
  const addEffect = useStore((s) => s.addEffect);
  const addPreset = useStore((s) => s.addPreset);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const project = useStore((s) => s.project);
  const currentFrame = useStore((s) => s.currentFrame);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = (label: string, description: string) =>
    q === '' || label.toLowerCase().includes(q) || description.toLowerCase().includes(q);

  const presetEntries = Object.entries(PRESETS).filter(([, p]) => matches(p.label, p.description));
  const componentGroups = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    components: listComponentsByCategory(category).filter((d) => matches(d.label, d.description)),
  })).filter((group) => group.components.length > 0);
  const componentCount = componentGroups.reduce((total, group) => total + group.components.length, 0);
  const effectKeys = (Object.keys(EFFECTS) as EffectType[]).filter((k) =>
    matches(EFFECTS[k].label, EFFECTS[k].description),
  );

  const effectGroups: Array<{ title: string; keys: EffectType[] }> = [
    { title: 'Text', keys: effectKeys.filter((k) => EFFECTS[k].textOnly) },
    { title: 'Enter', keys: effectKeys.filter((k) => !EFFECTS[k].textOnly && EFFECTS[k].category === 'in') },
    { title: 'Exit', keys: effectKeys.filter((k) => !EFFECTS[k].textOnly && EFFECTS[k].category === 'out') },
    { title: 'Loops & Motion', keys: effectKeys.filter((k) => !EFFECTS[k].textOnly && EFFECTS[k].category === 'loop') },
    { title: 'Style & Color', keys: effectKeys.filter((k) => !EFFECTS[k].textOnly && EFFECTS[k].category === 'style') },
  ].filter((g) => g.keys.length > 0);

  return (
    <aside className="library flex min-h-0 w-full flex-col overflow-hidden bg-card">
      <div className="library-search-wrap">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-8"
            type="search"
            placeholder="Search presets, elements, effects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="w-full">
          {presetEntries.length + componentCount + effectKeys.length === 0 ? (
            <div className="library-hint">Nothing matches “{query}”.</div>
          ) : null}

          {presetEntries.length > 0 ? (
            <>
              <div className="panel-title">Presets</div>
              <div className="library-hint">
                Ready-made animations — double-click to insert at the playhead
              </div>
              <div className="library-list">
                {presetEntries.map(([key, preset]) => (
                  <Card
                    key={key}
                    size="sm"
                    draggable
                    title={preset.description}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(PRESET_MIME, key);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDoubleClick={() => addPreset(key, currentFrame)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <CardHeader className="gap-1">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <span className="library-icon">{preset.icon}</span>
                        {preset.label}
                      </CardTitle>
                      <CardDescription>{preset.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </>
          ) : null}

          {componentGroups.map((group, groupIndex) => (
            <React.Fragment key={group.category}>
              <div className="panel-title" style={{ marginTop: 18 }}>
                <Badge variant="secondary">{group.label}</Badge>
              </div>
              {groupIndex === 0 ? (
                <div className="library-hint">
                  Drag onto a timeline track, or double-click to add
                </div>
              ) : null}
              <div className="library-grid">
                {group.components.map((definition) => (
                  <div
                    key={definition.type}
                    className="library-item"
                    draggable
                    title={definition.description}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(ELEMENT_MIME, definition.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDoubleClick={() => {
                      const track = project.tracks[0];
                      if (track) addClip(definition.type, track.id, currentFrame);
                    }}
                  >
                    <span className="library-icon">{definition.icon}</span>
                    <span>{definition.label}</span>
                    <Badge variant="outline" className="max-w-full truncate">
                      {definition.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </React.Fragment>
          ))}

          {effectKeys.length > 0 ? (
            <>
              <div className="panel-title" style={{ marginTop: 18 }}>
                Effects
              </div>
              <div className="library-hint">
                Drag onto a clip, or double-click to apply to selection
              </div>
            </>
          ) : null}
          {effectGroups.map((group) => (
            <React.Fragment key={group.title}>
              <div className="effect-cat">{group.title}</div>
              <div className="library-list">
                {group.keys.map((key) => (
                  <div
                    key={key}
                    className="library-item effect-item"
                    draggable
                    title={EFFECTS[key].description}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(EFFECT_MIME, key);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDoubleClick={() => {
                      for (const id of selectedClipIds) addEffect(id, key);
                    }}
                  >
                    <span className="library-icon">{EFFECTS[key].icon}</span>
                    <span>{EFFECTS[key].label}</span>
                  </div>
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
};
