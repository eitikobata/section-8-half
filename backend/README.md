# Section 8½ — Threat Correlation Engine

Simplified SIEM replica. Threat correlation dashboard inspired by *Ghost in
the Shell*'s Public Security Section 9 — renamed to avoid any copyright
overlap.

## Status: Bloco 1 — Setup + Ingestion ✅

What's implemented:
- NestJS project structure
- PostgreSQL + Prisma schema (`Entity`, `RawEvent`, `Incident`)
- Redis Streams connection + publish helper
- `POST /events` webhook (validated with DTO + class-validator)
- Entity upsert + raw event persistence
- Sensor simulator script (normal traffic + deliberate suspicious sequences)

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

## Next up: Bloco 2 — Correlation Engine

- Redis Stream consumer (worker)
- Sliding time window per entity
- Rule-based incident creation
- Calculated severity (vs raw)
