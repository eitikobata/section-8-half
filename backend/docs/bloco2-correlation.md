# Bloco 2 — Correlation Engine

## Rule

An entity's raw events accumulate in a **sliding time window**. When
`N` events for the *same entity*, each with `severityRaw` at or above
a threshold, land inside that window, an `Incident` is opened (or fed,
if one is already open for that entity).

Defaults (all configurable via env, see `.env.example`):

| Parameter | Default | Meaning |
|---|---|---|
| `CORRELATION_WINDOW_MS` | 60000 | Window size |
| `CORRELATION_EVENT_THRESHOLD` | 3 | Events needed inside the window |
| `CORRELATION_SEVERITY_THRESHOLD` | 50 | Min `severityRaw` (0-100) to count as "suspicious" |

Deliberately **not** keyed off a hardcoded list of event type strings
(`login_failure`, etc.) — the rule reacts to reported severity, so any
sensor can trigger it just by reporting a high enough `severityRaw`,
without the correlation engine needing to know every event type that
exists.

## Why Redis for the window, Postgres for the data

- **Redis**: one sorted set per entity (`correlation:entity:{externalId}`),
  score = event timestamp, member = `rawEventId`. Only used to track
  *membership and recency* — cheap `ZADD` / `ZREMRANGEBYSCORE` /
  `ZCARD` to maintain and evaluate the window.
- **Postgres**: still the only source of truth for event data. When the
  threshold is crossed, the engine resolves the IDs sitting in the
  Redis window back to real `RawEvent` rows to read `severityRaw` and
  link them to the `Incident`.

This keeps Redis disposable — losing the sorted sets loses in-flight
window state, not data, and window keys carry a TTL of `2x` the window
as a safety net for entities that go quiet.

## Consumption model

`CorrelationService` runs as a background consumer **inside the same
Nest process** (no separate worker process yet — not needed at this
scale, and easy to extract later). It uses a Redis Streams **consumer
group** (`XGROUP` / `XREADGROUP` / `XACK`) rather than a plain
`XREAD`, so:

- Delivery is at-least-once and resumable — if the process restarts,
  unacked entries are redelivered instead of lost.
- Multiple worker instances could consume the same stream in the
  future (horizontal scale) without double-processing, since the
  group hands out each entry to only one consumer.

There's no dead-letter queue yet — a malformed entry is logged and
still acked, so it can't block the stream forever. That's an explicit
gap, flagged for a later block rather than solved now.

## Severity calculation

`Incident.severity` is **not** a raw event's `severityRaw`. It's
computed once the window triggers, from all events currently in the
window (`src/correlation/severity.util.ts`):

```
severity = min(100, round(average(severityRaw) + bonus))
bonus    = max(0, eventCount - eventThreshold) * 5
```

More events beyond the minimum threshold firing in the same window
push severity up — the pattern reads as more deliberate, not just
noisier.

## Incident lifecycle within Bloco 2

- No open incident for the entity → **create** one, connect the
  window's (unlinked) `RawEvent`s to it, status `OPEN`.
- Already an open incident (`OPEN` or `INVESTIGATING`) for the entity
  → **feed** it: link any not-yet-linked events from the window, and
  bump `severity` to `max(current, recalculated)`.

Status transitions beyond that (`INVESTIGATING`, `CLOSED`,
`ESCALATED`, timers, analyst actions) belong to Bloco 3+.

## Verification

`npm run test:correlation` — standalone script (no Jest configured in
this project yet), reuses the same suspicious-sequence pattern as the
sensor simulator against the real webhook, then polls Postgres:

1. Fires `login_failure → location_change → privileged_access_attempt`
   (severity 80 each, ~1s apart) for a fresh entity → expects an
   `OPEN` incident with 3 linked events.
2. Fires only low-severity `heartbeat` events for a different fresh
   entity → expects **no** incident.

Requires the Nest app, Postgres, and Redis running.
