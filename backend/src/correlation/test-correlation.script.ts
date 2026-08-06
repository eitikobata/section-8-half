/**
 * Correlation engine verification script — Bloco 2.
 *
 * Not a Jest suite (none is set up in this project yet) — a standalone
 * script in the same spirit as the sensor simulator: hits the real
 * webhook, then asserts against the real Postgres row. Requires the
 * Nest app (with CorrelationModule) AND Postgres/Redis running.
 *
 * Run with: npm run test:correlation
 */
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const TARGET_URL =
  process.env.SIMULATOR_TARGET_URL ?? 'http://localhost:3000/events';

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendEvent(payload: Record<string, unknown>) {
  await axios.post(TARGET_URL, payload);
}

/** Same suspicious pattern the sensor simulator fires: three high-severity
 * events for the same entity, ~1s apart, well inside the default window. */
async function fireSuspiciousSequence(entityId: string) {
  const eventTypes = [
    'login_failure',
    'location_change',
    'privileged_access_attempt',
  ];
  for (const eventType of eventTypes) {
    await sendEvent({
      entityId,
      eventType,
      location: 'sector-2-lab',
      severityRaw: 80,
      timestamp: new Date().toISOString(),
      metadata: { source: 'test-correlation-script' },
    });
    await sleep(1000);
  }
}

async function fireNormalTraffic(entityId: string) {
  await sendEvent({
    entityId,
    eventType: 'heartbeat',
    location: 'sector-1-dock',
    severityRaw: 5,
    timestamp: new Date().toISOString(),
    metadata: { source: 'test-correlation-script' },
  });
}

async function waitForIncident(entityExternalId: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const incident = await prisma.incident.findFirst({
      where: { entity: { externalId: entityExternalId }, status: 'OPEN' },
      include: { events: true },
    });
    if (incident) return incident;
    await sleep(500);
  }
  return null;
}

async function main() {
  console.log('[test-correlation] Scenario 1: suspicious sequence should open an incident');
  const suspiciousEntity = `test-suspicious-${Date.now()}`;
  await fireSuspiciousSequence(suspiciousEntity);

  const incident = await waitForIncident(suspiciousEntity, 15000);
  if (incident) {
    console.log(
      `[test-correlation] PASS — incident ${incident.id} opened, severity=${incident.severity}, events=${incident.events.length}`,
    );
  } else {
    console.error('[test-correlation] FAIL — no incident opened within timeout');
  }

  console.log('[test-correlation] Scenario 2: normal traffic alone should NOT open an incident');
  const quietEntity = `test-quiet-${Date.now()}`;
  await fireNormalTraffic(quietEntity);
  await fireNormalTraffic(quietEntity);
  await sleep(3000);
  const falsePositive = await prisma.incident.findFirst({
    where: { entity: { externalId: quietEntity } },
  });
  console.log(
    falsePositive
      ? '[test-correlation] FAIL — incident opened from normal traffic'
      : '[test-correlation] PASS — no incident opened from normal traffic',
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[test-correlation] script error:', err.message);
  process.exit(1);
});
