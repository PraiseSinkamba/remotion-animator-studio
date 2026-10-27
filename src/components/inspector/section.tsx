import React from 'react';
import { cn } from '@/lib/utils';

/**
 * A titled block of inspector rows: an uppercase 10px micro-label with a
 * hairline rule under it, then the content.
 */
export const Section: React.FC<{
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ title, children, className }) => (
  <section className={cn('px-3 py-3', className)}>
    <h3 className="mb-2 border-b border-border pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {title}
    </h3>
    <div className="space-y-1.5">{children}</div>
  </section>
);
