import React from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * The sticky inspector header: the component's icon, the clip's name and a
 * mono chip naming the component type.
 */
export const InspectorHeader: React.FC<{
  icon?: string;
  name: string;
  type?: string;
}> = ({ icon, name, type }) => (
  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-3 py-2">
    {icon ? (
      <span aria-hidden className="text-base leading-none">
        {icon}
      </span>
    ) : null}
    <span className="truncate text-sm font-medium text-foreground">{name}</span>
    {type ? (
      <Badge
        variant="outline"
        className="ml-auto h-4 max-w-[50%] shrink-0 truncate rounded px-1 py-0 font-mono text-[9px] font-normal text-muted-foreground"
      >
        {type}
      </Badge>
    ) : null}
  </div>
);
