# Section 8½ — Threat Correlation Engine

Simplified SIEM replica. Threat correlation dashboard inspired by *Ghost in
the Shell*'s Public Security Section 9 — renamed to avoid any copyright
overlap.

## Status

- Bloco 1 — Setup + Ingestion ✅
- Bloco 2 — Correlation Engine ✅ (`docs/bloco2-correlation.md`)
- Bloco 3 — Real-time (WebSocket) + incidents REST ✅ (`docs/bloco3-realtime.md`)

What's implemented:
- NestJS project structure
- PostgreSQL + Prisma schema (`Entity`, `RawEvent`, `Incident`, `IncidentComment`)
- Redis Streams connection + publish helper
- `POST /events` webhook (validated with DTO + class-validator)
- Entity upsert + raw event persistence
- Sensor simulator script (normal traffic + deliberate suspicious sequences)
- Redis Stream consumer group correlating events into incidents (sliding
  window per entity, calculated severity)
- `IncidentsGateway` (WebSocket) emitting `incident.created`,
  `incident.updated`, `incident.comment`
- `/incidents` REST: list (paginated, filterable), detail, analyst actions
  (investigate/close/escalate, comment)

## Getting started

```bash
# 1. install deps
npm install

# 2. copy env and adjust if needed
cp .env.example .env

# 3. spin up Postgres + Redis
docker compose up -d

# 4. generate prisma client + run migration
npm run prisma:generate
npm run prisma:migrate

# 5. start the API
npm run start:dev

# 6. in another terminal, start the simulator
npm run simulator
```

Once running, `POST http://localhost:3000/events` accepts:

```json
{
  "entityId": "unit-motoko-09",
  "eventType": "login_failure",
  "location": "sector-2-lab",
  "severityRaw": 85,
  "timestamp": "2026-08-05T12:00:00.000Z",
  "metadata": { "note": "optional free-form field" }
}
```

Every accepted event is persisted to Postgres (audit trail) and published to
the `events:stream` Redis Stream, ready for the correlation worker (Bloco 2).

## Next up: Bloco 4 — AI integration

- Gemini/Claude API for incident summary + severity suggestion
- AI-suggested engagement protocol / agent / rules of engagement
  (stored separately from the analyst's final decision)
  