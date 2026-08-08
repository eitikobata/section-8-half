# Section 8½ — Backend

NestJS API for the Threat Correlation Engine: event ingestion, correlation
engine, real-time incident WebSocket, JWT auth, and AI-assisted incident
analysis.

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run start:dev
```

Server runs on `http://localhost:3000` by default.

## Architecture

- **Ingestion**: `POST /events` webhook → validates payload → upserts
  Entity → persists RawEvent → publishes to Redis Stream
- **Correlation**: Redis Streams consumer group, sliding window per
  entity, auto-opens Incident when suspicious event threshold is hit
- **Real-time**: `IncidentsGateway` (socket.io) emits new incidents and
  status updates; REST API for incident history and analyst actions
- **Auth**: JWT access token (15min, in-memory on client) + rotation-based
  refresh token (httpOnly cookie, 7-30 days, SHA-256 hashed in Postgres).
  Reuse detection revokes all sessions if a used refresh token reappears.
- **AI**: Claude/Gemini integration (with mock fallback) generates incident
  summaries and suggests response protocol/agent/rules of engagement

## Docs

Detailed architecture and decision rationale per block:
- [`docs/bloco2-correlation.md`](docs/bloco2-correlation.md)
- [`docs/bloco3-realtime.md`](docs/bloco3-realtime.md)
- [`docs/bloco4-ia.md`](docs/bloco4-ia.md)
- [`docs/bloco4.5-auth.md`](docs/bloco4.5-auth.md)

## Environment

See [`.env.example`](.env.example) for the full list of variables
(database, Redis, JWT secrets, AI provider keys, correlation engine
tuning, rate limiting).

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Dev server with watch mode |
| `npm run build` | Production build (`dist/`) |
| `npm run start:prod` | Run built production server |
| `npm run seed` | Seed demo user + sample data |
| `npx prisma studio` | Web UI for the database |
