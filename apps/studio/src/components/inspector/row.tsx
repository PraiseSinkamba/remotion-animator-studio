import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * A label on the left and its control on the right. `stacked` puts the control
 * under the label — for controls that need the full width, like a text area.
 */
export const Row: React.FC<{
  label: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  stacked?: boolean;
  className?: string;
}> = ({ label, htmlFor, children, stacked, className }) => (
  <div
    className={cn(
      'flex gap-3',
      stacked ? 'flex-col items-stretch gap-1' : 'items-center justify-between',
      className
    )}
  >
    <Label
      htmlFor={htmlFor}
      className={cn(
        'text-[11px] font-normal leading-tight text-muted-foreground',
        stacked ? 'shrink-0' : 'min-w-0 max-w-[52%] shrink-0'
      )}
    >
      <span className="min-w-0 truncate" title={typeof label === 'string' ? label : undefined}>
        {label}
      </span>
    </Label>
    <div className={cn('flex min-w-0 items-center gap-2', stacked ? 'w-full' : 'flex-1 justify-end')}>
      {children}
    </div>
  </div>
);
