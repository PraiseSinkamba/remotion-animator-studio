import React from 'react';

/**
 * A sticky group header: a coloured dot, an uppercase 10px label and a count
 * chip. `dot` must be a semantic utility class (never a raw colour).
 */
export const GroupHeader: React.FC<{ label: string; count: number; dot: string; sticky?: boolean }> = ({
  label,
  count,
  dot,
  sticky = true,
}) => (
  <div
    className={`-mx-2 flex items-center justify-between gap-2 px-2 py-1.5 ${
      sticky ? 'sticky top-0 z-10 bg-card/95 backdrop-blur' : ''
    }`}
  >
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </span>
    <span className="shrink-0 rounded-full border border-border px-1.5 py-px font-mono text-[9px] text-muted-foreground">
      {count}
    </span>
  </div>
);
