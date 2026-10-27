import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'chart-studio-library-view';

export type LibraryView = 'grid' | 'list';

export const readLibraryView = (): LibraryView => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

export const writeLibraryView = (view: LibraryView): void => {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    /* private mode — the choice simply does not persist */
  }
};

/** Two 24px icon buttons in a bordered group. */
export const ViewToggle: React.FC<{ view: LibraryView; onChange: (view: LibraryView) => void }> = ({
  view,
  onChange,
}) => (
  <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5">
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      aria-label="Grid view"
      title="Grid view"
      className={view === 'grid' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}
      onClick={() => onChange('grid')}
    >
      <LayoutGrid data-icon="inline-start" />
    </Button>
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      aria-label="List view"
      title="List view"
      className={view === 'list' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}
      onClick={() => onChange('list')}
    >
      <List data-icon="inline-start" />
    </Button>
  </div>
);
