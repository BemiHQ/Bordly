import type * as React from 'react';
import { cn } from '@/utils/strings';

export const H1 = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h1
    className={cn('scroll-m-20 text-primary text-center text-2xl font-semibold tracking-tight text-balance', className)}
  >
    {children}
  </h1>
);
