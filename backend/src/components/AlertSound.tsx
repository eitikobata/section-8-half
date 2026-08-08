'use client';

import React, { useEffect, useRef } from 'react';

interface AlertSoundProps {
  // Same trigger mechanism as AlertFlash: bump this number to play once.
  triggerKey: number;
  muted: boolean;
}

export function AlertSound({ triggerKey, muted }: AlertSoundProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Don't play on mount (triggerKey starts at 0) — only on real
    // increments, i.e. actual new alerts.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (triggerKey === 0) return;
    if (muted) return;

    const audio = audioRef.current;
    if (!audio) return;

    // Play from the start every time — if a second alert fires while the
    // first is still playing, this restarts it rather than overlapping.
    audio.currentTime = 0;
    audio.play().catch((err) => {
      // Autoplay can be blocked by the browser until the user has
      // interacted with the page at least once — fails silently rather
      // than throwing an unhandled promise rejection.
      console.warn('[AlertSound] Playback blocked:', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  return (
    <audio ref={audioRef} src="/alert.mp3" preload="auto" />
  );
}
