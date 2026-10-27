import React from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface LibraryItem {
  /** Preset key or element type — also the drag payload. */
  id: string;
  label: string;
  /** Emoji or glyph shown in the icon tile. */
  icon: string;
  description: string;
  /** Type chip text. */
  chip: string;
  /** Footer: a duration chip (presets) or an Add button (components). */
  duration?: string;
  /** Double-click action. */
  onAdd?: () => void;
  /** Whether the footer shows an explicit Add button (components only). */
  addButton?: boolean;
  /** Compact row: icon and label only (the effect catalogue). */
  compact?: boolean;
  onDragStart: (e: React.DragEvent) => void;
}

const IconTile: React.FC<{ icon: string; className?: string }> = ({ icon, className }) => (
  <span
    className={`flex shrink-0 items-center justify-center rounded-md border border-border bg-muted text-sm ${className ?? ''}`}
  >
    {icon}
  </span>
);

/** Grid card: icon tile, type chip, name, one-line description and a footer. */
export const LibraryCard: React.FC<{ item: LibraryItem }> = ({ item }) => (
  <Card
    size="sm"
    draggable
    title={item.description}
    onDragStart={item.onDragStart}
    onDoubleClick={item.onAdd}
    className="group cursor-grab justify-between gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 ring-0 transition-colors hover:border-primary/60 active:cursor-grabbing"
  >
    <div className="flex items-start justify-between gap-1.5">
      <IconTile icon={item.icon} className="size-7" />
      <Badge
        variant="outline"
        className="h-4 max-w-[60%] truncate rounded px-1 py-0 font-mono text-[9px] font-normal text-muted-foreground"
      >
        {item.chip}
      </Badge>
    </div>
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-foreground">{item.label}</p>
      <p className="truncate text-[10px] text-muted-foreground">{item.description}</p>
    </div>
    <div className="flex items-center justify-between gap-1 border-t border-border pt-1">
      {item.duration ? (
        <span className="font-mono text-[9px] text-muted-foreground">{item.duration}</span>
      ) : null}
      {item.addButton ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-5 gap-0.5 px-1 text-[10px] text-primary"
          onClick={(e) => {
            e.stopPropagation();
            item.onAdd?.();
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <Plus data-icon="inline-start" />
          Add
        </Button>
      ) : null}
    </div>
  </Card>
);

/** List row: the same information on one compact line. */
export const LibraryRow: React.FC<{ item: LibraryItem }> = ({ item }) => (
  <div
    draggable
    title={item.description}
    onDragStart={item.onDragStart}
    onDoubleClick={item.onAdd}
    className="group flex cursor-grab items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 transition-colors hover:border-primary/60 active:cursor-grabbing"
  >
    <IconTile icon={item.icon} className="size-6 text-xs" />
    <span className="min-w-0 shrink truncate text-xs font-medium text-foreground">{item.label}</span>
    {item.compact ? null : (
      <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
        {item.description}
      </span>
    )}
    {item.duration ? (
      <span className="shrink-0 font-mono text-[9px] text-muted-foreground">{item.duration}</span>
    ) : null}
    {item.compact ? null : (
      <Badge
        variant="outline"
        className="h-4 max-w-[40%] shrink-0 truncate rounded px-1 py-0 font-mono text-[9px] font-normal text-muted-foreground"
      >
        {item.chip}
      </Badge>
    )}
    {item.addButton ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Add ${item.label}`}
        title={`Add ${item.label}`}
        className="shrink-0 text-primary"
        onClick={(e) => {
          e.stopPropagation();
          item.onAdd?.();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Plus data-icon="inline-start" />
      </Button>
    ) : null}
  </div>
);
