// Same pattern as auth.config.ts — single source of truth read by main.ts.

export const appConfig = {
  // Comma-separated list, so staging/prod can allow multiple origins
  // (e.g. a preview deploy URL alongside the main domain) without code
  // changes. Defaults to the local Next.js dev server.
  frontendOrigins: (process.env.FRONTEND_URL ?? 'http://localhost:3001')
    .split(',')
    .map((s) => s.trim()),
};
