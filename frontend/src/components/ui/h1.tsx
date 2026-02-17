import type * as React from 'react';

export const H1 = ({ children }: { children: React.ReactNode }) => (
  <h1 className="scroll-m-20 text-primary text-center text-2xl font-semibold tracking-tight text-balance">
    {children}
  </h1>
);
