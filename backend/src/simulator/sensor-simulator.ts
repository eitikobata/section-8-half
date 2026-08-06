/**
 * Sensor Simulator — Section 8½
 *
 * Standalone script (not part of the Nest app) that mimics androids/
 * cameras/cyberbrains reporting events to the ingestion webhook.
 * Run with: npm run simulator
 *
 * Bloco 2 will reuse the "suspicious sequence" generator below to
 * deliberately trigger the correlation engine (login_failure +
 * location_change + privileged_access_attempt within a short window).
 */
import axios from 'axios';

const TARGET_URL =
  process.env.SIMULATOR_TARGET_URL ?? 'http://localhost:3000/events';
const INTERVAL_MS = parseInt(
  process.env.SIMULATOR_INTERVAL_MS ?? '3000',
  10,
);

const ENTITY_IDS = [
  'unit-renji-01',
  'unit-motoka-09',
  'terminal-bureau8-04',
  'cyberbrain-bato-22',
  'unit-tokusa-07'
];

const NORMAL_EVENT_TYPES = [
  'heartbeat',
  'location_ping',
  'routine_diagnostics',
  'login_success',
];

const SUSPICIOUS_EVENT_TYPES = [
  'login_failure',
  'location_change',
  'privileged_access_attempt',
];

const LOCATIONS = [
  'sector-1-dock',
  'sector-2-lab',
  'sector-3-comms',
  'sector-4-reactor',
  'sector-5-quarters',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function sendEvent(payload: Record<string, unknown>) {
  try {
    const res = await axios.post(TARGET_URL, payload);
    console.log(
      `[simulator] sent ${payload.eventType} for ${payload.entityId} -> ${res.status}`,
    );
  } catch (err: any) {
    console.error(
      `[simulator] failed to send event: ${err?.response?.status ?? ''} ${err?.message}`,
    );
  }
}

function buildNormalEvent() {
  return {
    entityId: randomFrom(ENTITY_IDS),
    eventType: randomFrom(NORMAL_EVENT_TYPES),
    location: randomFrom(LOCATIONS),
    severityRaw: Math.floor(Math.random() * 20), // low severity
    timestamp: new Date().toISOString(),
    metadata: { source: 'simulator', kind: 'normal' },
  };
}

/**
 * Fires the three suspicious events for the SAME entity in rapid
 * succession — this is the exact pattern Bloco 2's correlation engine
 * should catch and turn into an incident.
 */
async function fireSuspiciousSequence() {
  const entityId = randomFrom(ENTITY_IDS);
  const location = randomFrom(LOCATIONS);

  for (const eventType of SUSPICIOUS_EVENT_TYPES) {
    await sendEvent({
      entityId,
      eventType,
      location,
      severityRaw: 70 + Math.floor(Math.random() * 30), // high severity
      timestamp: new Date().toISOString(),
      metadata: { source: 'simulator', kind: 'suspicious_sequence' },
    });
    // small gap between events, well within a "short window" correlation rule
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(
    `[simulator] fired suspicious sequence for ${entityId} @ ${location}`,
  );
}

async function loop() {
  console.log(
    `[simulator] starting — target: ${TARGET_URL}, interval: ${INTERVAL_MS}ms`,
  );

  setInterval(async () => {
    await sendEvent(buildNormalEvent());
  }, INTERVAL_MS);

  // every ~8 normal ticks, throw in a suspicious sequence to keep
  // the correlation engine (Bloco 2) fed with real incidents to catch
  setInterval(
    async () => {
      await fireSuspiciousSequence();
    },
    INTERVAL_MS * 8,
  );
}

loop();
