// Centralized config for the correlation engine (Bloco 2).
// Same pattern as redis.config.ts — one source of truth read by the
// CorrelationService (and by tests / docs referencing the same numbers).
export const correlationConfig = {
  // Sliding window size, in ms. Suspicious events older than this
  // relative to the newest one are pruned before evaluating the rule.
  windowMs: parseInt(process.env.CORRELATION_WINDOW_MS ?? '60000', 10),

  // How many "suspicious" events for the same entity, inside the
  // window, are needed to open (or feed) an incident.
  eventThreshold: parseInt(process.env.CORRELATION_EVENT_THRESHOLD ?? '3', 10),

  // An event counts as "suspicious" for windowing purposes when its
  // severityRaw (0-100, as reported by the sensor) is >= this value.
  // Kept independent from eventType strings on purpose — the engine
  // reacts to reported severity, not to a hardcoded list of names.
  suspicionThreshold: parseInt(
    process.env.CORRELATION_SEVERITY_THRESHOLD ?? '50',
    10,
  ),

  consumerGroup: process.env.CORRELATION_CONSUMER_GROUP ?? 'correlation-engine',
  consumerName:
    process.env.CORRELATION_CONSUMER_NAME ?? `worker-${process.pid}`,

  // XREADGROUP BLOCK time (ms) and batch size per read.
  blockMs: parseInt(process.env.CORRELATION_BLOCK_MS ?? '5000', 10),
  batchCount: parseInt(process.env.CORRELATION_BATCH_COUNT ?? '10', 10),
};
