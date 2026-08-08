# Section 8½ — Threat Correlation Engine

A SIEM-inspired security platform that ingests raw security events, correlates
them into incidents in real time, and uses AI to suggest a response protocol —
built as a portfolio piece to demonstrate event-driven architecture, hardened
auth, and a fully containerized deployment pipeline end to end.

**Live demo:** https://s82.eitikobata.com _(demo credentials: `analyst-demo` / `demo12345`)_

---

## What it does

1. **Sensors** (simulated) report raw events — login failures, location
   changes, privileged access attempts — to a webhook.
2. Events are published to a **Redis Stream** and consumed by a
   **correlation engine** that tracks a sliding time window per entity.
3. When enough suspicious events for the same entity land inside that
   window, an **incident opens automatically** and is pushed to every
   connected analyst in real time over **WebSocket**.
4. An **AI layer** (Gemini, with Claude and a mock provider as swappable
   alternatives) analyzes the incident and suggests a response protocol,
   an agent from an original roster, and rules of engagement.
5. The analyst reviews the AI's suggestion, can accept or override it, and
   dispatches a response — the decision and the AI's original suggestion
   are stored separately, so nothing is silently overwritten.
6. The live demo stays fresh on its own: a scheduled job periodically
   clears simulated event/incident data while a continuously running
   event simulator repopulates it, so the dashboard never sits empty or
   grows unbounded.

---

## Architecture

```
┌──────────────┐     POST /events      ┌─────────────────────────┐
│   Sensors    │ ────────────────────▶ │   NestJS Backend        │
│ (simulated)  │                       │                          │
└──────────────┘                       │  ┌────────────────────┐ │
                                        │  │ Ingestion           │ │
                                        │  │ (validate, persist, │ │
                                        │  │  publish to stream) │ │
                                        │  └─────────┬──────────┘ │
                                        │            │            │
                                        │            ▼            │
                                        │  ┌────────────────────┐ │      ┌───────────┐
                                        │  │ Redis Streams        │◀────▶│   Redis   │
                                        │  │ Consumer Group       │      └───────────┘
                                        │  └─────────┬──────────┘ │
                                        │            │            │
                                        │            ▼            │
                                        │  ┌────────────────────┐ │
                                        │  │ Correlation Engine   │ │
                                        │  │ (sliding window per  │ │
                                        │  │  entity, opens       │ │
                                        │  │  incidents)          │ │
                                        │  └─────────┬──────────┘ │
                                        │            │            │      ┌───────────┐
                                        │            ├───────────────────▶│ PostgreSQL│
                                        │            │            │      └───────────┘
                                        │            ▼            │
                                        │  ┌────────────────────┐ │
                                        │  │ AI Layer             │ │
                                        │  │ (Gemini/Claude/mock,  │ │
                                        │  │  suggests response)  │ │
                                        │  └─────────┬──────────┘ │
                                        │            │            │
                                        │            ▼            │
                                        │  ┌────────────────────┐ │
                                        │  │ WebSocket Gateway     │ │
                                        │  └─────────┬──────────┘ │
                                        └────────────┼────────────┘
                                                      │ live push
                                                      ▼
                                        ┌─────────────────────────┐
                                        │   Next.js Frontend       │
                                        │  (analyst dashboard,     │
                                        │   incident review,       │
                                        │   response dispatch)     │
                                        └─────────────────────────┘
```

---

## Key features

- **Event-driven correlation**, not naive threshold alerts — a sliding
  time window per entity means the engine looks at *patterns* of
  behavior, not single events in isolation.
- **Real-time analyst dashboard** over WebSocket — new incidents and
  status changes appear live, no polling.
- **Hardened auth**: short-lived JWT access tokens (15min, in-memory on
  the client — never localStorage) + rotating refresh tokens stored
  hashed in Postgres as an httpOnly cookie. Reuse of an already-rotated
  refresh token revokes every session for that user, not just the
  reused one.
- **AI provider abstraction** — swap between Gemini, Claude, or a
  deterministic mock (for tests/demos without burning API credits) via
  a single environment variable, no code changes.
- **Fully containerized**: multi-stage Docker builds for both apps,
  docker-compose for local dev, and a dedicated EasyPanel-ready
  configuration for production.
- **Self-healing demo data**: scheduled reset paired with a continuously
  running event simulator keeps the live demo populated with fresh,
  realistic activity indefinitely.

---

## Technical decisions & trade-offs

A few choices worth being able to explain out loud:

- **Redis Streams over Pub/Sub** — Pub/Sub has no persistence or
  replay: a consumer that's briefly down loses every message published
  while it was offline. Streams give an append-only log with consumer
  groups, so the correlation engine can crash, restart, and pick up
  exactly where it left off.
- **WebSocket over polling** — incidents need to reach the analyst the
  moment they're created, not up to N seconds later. socket.io also
  gives automatic reconnection handling for free, which matters more
  than it sounds like for a page an analyst is expected to leave open
  all shift.
- **Separating ingestion from correlation** — `POST /events` only
  validates and persists; it doesn't do correlation inline. That keeps
  the webhook fast and lets the correlation engine scale independently
  (or fail and restart) without ever blocking event ingestion.
- **Refresh token rotation with reuse detection over a simpler
  approach** — a single long-lived refresh token is simpler to
  implement but gives no signal if it's ever stolen. Rotating on every
  use and treating a reused (already-consumed) token as a theft signal
  costs more code but converts "we hope this wasn't stolen" into
  "we'll actually notice."
- **A Postgres table for refresh token revocation instead of a Redis
  blacklist** — for this scale, one fewer moving part beats the extra
  performance a separate blacklist would buy. An explicit MVP
  trade-off, not an oversight.
- **AI-generated suggestion and analyst decision stored as two separate
  fields**, never merged — losing the AI's original suggestion the
  moment an analyst edits it would make it impossible to later measure
  how often analysts agree with the AI, which is the whole point of
  keeping a human in the loop.

### Known limitations (intentional, not overlooked)

- Single role (`ANALYST`) — RBAC with multiple roles is deliberately
  deferred until a real product flow needs to tell analysts apart.
- No horizontal scaling story for the correlation engine yet (single
  consumer per group) — fine at demo scale, would need partitioning
  work for production-grade throughput.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | NestJS, TypeScript, Prisma |
| Real-time | Socket.IO (WebSocket) |
| Event streaming | Redis Streams |
| Database | PostgreSQL |
| Auth | JWT (access + rotating refresh), bcrypt, httpOnly cookies |
| AI | Google Gemini (primary), Anthropic Claude (alternative), mock provider |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, TanStack Query, Zustand |
| Infra | Docker (multi-stage builds), EasyPanel, scheduled self-heal |

---

## Running locally

Requires Docker and Docker Compose.

```bash
git clone https://github.com/eitikobata/section-8-half.git
cd section-8-half
docker-compose up -d --build
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed
```

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Demo login: `analyst-demo` / `demo12345`

Minimum environment variables (set in your shell or a local `.env` file
next to `docker-compose.yml`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Auth token signing (use `openssl rand -hex 32`) |
| `AI_PROVIDER` | `gemini`, `claude`, or `mock` |
| `GEMINI_API_KEY` / `CLAUDE_API_KEY` | Key for whichever provider is selected |
| `FRONTEND_URL` | Must match the frontend's real origin exactly (cookie scoping) |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` | Backend URL, as seen by the browser |

---

## Project structure

```
section-8-half/
├── backend/          # NestJS API — ingestion, correlation, auth, AI, WebSocket
│   ├── src/
│   └── prisma/         # schema + migrations
├── frontend/          # Next.js analyst dashboard
│   └── src/
├── Dockerfile.backend
├── Dockerfile.frontend
└── docker-compose.yml
```

---

## Author

Built by [Eiti Kobata](https://github.com/eitikobata) as a portfolio
project. Renamed from an earlier working title to avoid any overlap with
existing media IP — every agent, entity, and character name in this
project is original.
