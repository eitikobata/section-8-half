'use client';

import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  initialMs: number;
  onExpired?: () => void;
}

export function CountdownTimer({ initialMs, onExpired }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(initialMs);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          onExpired?.();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onExpired]);

  const seconds = Math.ceil(remaining / 1000);
  const progress = (remaining / initialMs) * 100;

  // Color based on time remaining: green -> yellow -> red
  let color = 'bg-cyberpunk-success';
  if (progress < 33) color = 'bg-cyberpunk-pink';
  else if (progress < 66) color = 'bg-cyberpunk-warn';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-cyberpunk-accent text-sm">Decision Timeout</span>
        <span className="font-mono text-cyberpunk-pink">{seconds}s</span>
      </div>
      <div className="w-full h-2 bg-gray-800 border border-cyberpunk-accent overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
