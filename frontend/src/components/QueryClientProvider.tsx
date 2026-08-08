'use client';

import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider as TQProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      gcTime: 5 * 60 * 1000,
    },
  },
});

export function QueryClientProvider({ children }: { children: ReactNode }) {
  return <TQProvider client={queryClient}>{children}</TQProvider>;
}
