'use client';

import React from 'react';

interface AlertBannerProps {
  unresolvedCount: number;
}

/**
 * Full-bleed alert banner — spans the entire site width, sits above the
 * "Monitored Entities" panel. Shows only while there are unresolved
 * incidents (NEW/TRIAGED). BIOS/terminal aesthetic: scanlines, blinking
 * cursor, monospace ASCII-style border.
 *
 * The character image and dialogue are placeholders for now — drop
 * character-banner.png into frontend/public/ (recommended: 140px tall,
 * transparent PNG, shoulders-up crop) and wire dialogue text in later.
 */
export function AlertBanner({ unresolvedCount }: AlertBannerProps) {
  if (unresolvedCount === 0) return null;

  return (
    <div className="w-full relative overflow-hidden border-y-2 border-cyberpunk-pink bg-black">
      {/* Scanline overlay */}
      <div className="bios-scanlines pointer-events-none absolute inset-0" />

      <div className="relative flex items-end gap-4 px-4 sm:px-8">
        {/* Character placeholder — swap src once art is ready */}
        <img
          src="/character-banner.png"
          alt=""
          className="h-[140px] w-auto shrink-0 select-none pointer-events-none"
          onError={(e) => {
            // Hide gracefully if the file hasn't been dropped in yet,
            // instead of showing a broken image icon.
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        <div className="flex-1 py-4 min-w-0">
          <p className="text-cyberpunk-pink text-xs sm:text-sm font-mono tracking-widest">
            <span className="bios-cursor">█</span> SYSTEM ALERT — {unresolvedCount} INCIDENT
            {unresolvedCount > 1 ? 'S' : ''} AWAITING TRIAGE
          </p>

          {/* Dialogue placeholder — empty for now, wire actual lines later */}
          <p className="mt-1 text-gray-500 text-xs font-mono italic">
            {'>'} ...
          </p>
        </div>
      </div>
    </div>
  );
}
