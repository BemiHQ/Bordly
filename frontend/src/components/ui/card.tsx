import type * as React from 'react';

import { cn } from '@/utils/strings';

export const Card = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="card"
      className={cn('bg-card text-card-foreground flex flex-col gap-5 rounded-xl border py-5 shadow-sm', className)}
      {...props}
    />
  );
};

export const CardHeader = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-5',
        className,
      )}
      {...props}
    />
  );
};

export const CardTitle = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return <div data-slot="card-title" className={cn('leading-none font-semibold', className)} {...props} />;
};

export const CardDescription = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return <div data-slot="card-description" className={cn('text-muted-foreground text-sm', className)} {...props} />;
};

export const CardAction = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
};

export const CardContent = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return <div data-slot="card-content" className={cn('px-4', className)} {...props} />;
};

export const CardFooter = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div data-slot="card-footer" className={cn('flex items-center px-5 [.border-t]:pt-5', className)} {...props} />
  );
};
