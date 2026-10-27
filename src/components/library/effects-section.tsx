import React from 'react';
import { EFFECTS } from '../../effects';
import type { EffectType } from '../../types';
import { GROUP_DOT } from './catalog';
import { GroupHeader } from './group-header';
import { LibraryRow, type LibraryItem } from './library-card';

const EFFECT_GROUPS: Array<{ title: string; match: (def: (typeof EFFECTS)[EffectType]) => boolean }> = [
  { title: 'Text', match: (d) => !!d.textOnly },
  { title: 'Enter', match: (d) => !d.textOnly && d.category === 'in' },
  { title: 'Exit', match: (d) => !d.textOnly && d.category === 'out' },
  { title: 'Loops & Motion', match: (d) => !d.textOnly && d.category === 'loop' },
  { title: 'Style & Color', match: (d) => !d.textOnly && d.category === 'style' },
];

/**
 * The effect catalogue — one compact row per effect, grouped by category.
 * It sits below the tab's own content in the same scroll area, so it stays
 * reachable for drag-onto-clip and double-click-to-apply.
 */
export const EffectsSection: React.FC<{ items: Array<{ key: EffectType; item: LibraryItem }> }> = ({
  items,
}) => {
  const groups = EFFECT_GROUPS.map((g) => ({
    title: g.title,
    entries: items.filter((e) => g.match(EFFECTS[e.key])),
  })).filter((g) => g.entries.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="mt-2 border-t border-border pt-1">
      <GroupHeader label="Effects" count={items.length} dot={GROUP_DOT} sticky={false} />
      <p className="pb-1.5 text-[10px] text-muted-foreground">
        Drag onto a clip, or double-click to apply to selection
      </p>
      {groups.map((group) => (
        <div key={group.title}>
          <GroupHeader label={group.title} count={group.entries.length} dot={GROUP_DOT} sticky={false} />
          <div className="flex flex-col gap-1 pb-2">
            {group.entries.map(({ item }) => (
              <LibraryRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
