'use client';

import React from 'react';

/**
 * Character portrait docked above the dispatch card, as if leaning
 * over the console waiting for orders. Framed like a retro (SNES/PS1
 * era) dialogue cutscene window — opaque background art, bordered,
 * NOT overlapping the card below it (no negative margin) since the
 * art has its own background now instead of transparency.
 *
 * Drop character-dispatch.png into frontend/public/ — recommended
 * 640px wide x 220px tall. Any image works: object-cover crops to
 * fill the frame, so exact proportions aren't critical.
 */
export function DispatchCharacter() {
  return (
    <div className="w-full mb-3 border-2 border-cyberpunk-accent overflow-hidden">
      <img
        src="/character-dispatch.png"
        alt=""
        className="w-full h-[180px] object-cover select-none pointer-events-none"
        onError={(e) => {
          // Hide the whole framed box (not just the img) if the file
          // isn't there yet, so an empty bordered rectangle doesn't
          // show up before the art is ready.
          (e.target as HTMLImageElement).parentElement!.style.display = 'none';
        }}
      />
    </div>
  );
}
