// Centralized auth config (Bloco 4.5), same pattern as correlation.config.ts
// and redis.config.ts — one source of truth read by AuthService, JwtStrategy
// and the WS guard.
export const authConfig = {
  // Two separate secrets on purpose: an access token leaked from a client
  // (browser storage, logs) can't be replayed against /auth/refresh, and
  // vice-versa. Cheap isolation for an MVP.
  accessTokenSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',

  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTokenTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '7', 10),

  // Seeded demo user (analyst-demo) — powers the auto-fill login button
  // that lands in Bloco 5 (frontend). Same idea as deep-space-support.
  demoUsername: process.env.DEMO_USER_USERNAME ?? 'analyst-demo',
  demoPassword: process.env.DEMO_USER_PASSWORD ?? 'demo12345',
};
