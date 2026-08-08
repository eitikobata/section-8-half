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

  // Cookie settings for the refresh token (hardening pass, Bloco 6).
  // httpOnly means client-side JS can never read it — even if an XSS
  // bug slipped a malicious script onto the page, it couldn't exfiltrate
  // this cookie. `secure` should be true in production (HTTPS only);
  // kept false by default so local http://localhost dev still works.
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
};
