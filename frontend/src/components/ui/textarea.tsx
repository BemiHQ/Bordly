import type * as React from 'react';

import { cn } from '@/utils/strings';

export const Textarea = ({ className, ...props }: React.ComponentProps<'textarea'>) => {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content w-full px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground',
        'rounded-md border border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
        'bg-transparent dark:bg-input/30 shadow-xs transition-[color,box-shadow]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
};
