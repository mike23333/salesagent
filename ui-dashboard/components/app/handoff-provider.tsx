'use client';

import { HandoffAlert } from './handoff-alert';

export function HandoffProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <HandoffAlert />
    </>
  );
}
