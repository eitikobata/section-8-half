'use client';

import React from 'react';

interface AlertFlashProps {
  // Changing this key remounts the component, which restarts the CSS
  // animation — that's the trigger mechanism, no JS timers needed.
  flashKey: number;
}

export function AlertFlash({ flashKey }: AlertFlashProps) {
  if (flashKey === 0) return null;

  return (
    <div
      key={flashKey}
      className="alert-flash-overlay fixed inset-0 z-40 pointer-events-none"
      style={{ backgroundColor: '#ff006e' }}
    />
  );
}
