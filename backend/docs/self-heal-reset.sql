-- Section 8½ — self-heal reset
-- Wipes simulated event/incident data. Does NOT touch "users" or
-- "refresh_tokens" -- analyst-demo login must keep working across resets.
-- The sensor simulator (running as its own 24/7 service) organically
-- regenerates entities/events/incidents within minutes of each wipe,
-- so there's no fixed dataset to re-insert here (unlike deep-space's
-- static ticket set).

-- 1. Wipe existing demo data (children first, respecting FKs)
DELETE FROM "incident_comments";
DELETE FROM "raw_events";
DELETE FROM "incidents";
DELETE FROM "entities";

-- 2. Optional housekeeping: drop expired/revoked refresh tokens so
-- this table doesn't grow forever either. Does NOT touch valid,
-- unexpired tokens or the users table itself.
DELETE FROM "refresh_tokens"
WHERE "revokedAt" IS NOT NULL
   OR "expiresAt" < NOW();
