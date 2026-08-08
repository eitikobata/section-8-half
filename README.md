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
  docker-compose for local dev, and a dedicated EasyPanel-ready compose
  file for production against a shared Postgres instance.
- **Self-healing demo data**: a scheduled n8n workflow wipes simulated
  event/incident data periodically while a 24/7 simulator service
  organically repopulates it — so the live demo never goes stale or
  grows unbounded.

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
  performance a separate blacklist would buy. Documented as an explicit
  MVP trade-off, not an oversight.
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
- Demo Redis/Postgres instances are shared across the author's other
  projects on the same VPS, not dedicated — a deliberate cost trade-off
  for a portfolio project, not how this would be run for a real client.

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
| Infra | Docker (multi-stage builds), EasyPanel, n8n (scheduled self-heal) |

---

## Running locally

```bash
git clone https://github.com/eitikobata/section-8-half.git
cd section-8-half
cp .env.example .env
docker-compose up -d --build
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed
```

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Demo login: `analyst-demo` / `demo12345`

Full deployment guide (Docker, EasyPanel, troubleshooting) is in
[`docs/bloco6-deploy.md`](docs/bloco6-deploy.md).

---

## Project structure

```
section-8-half/
├── backend/          # NestJS API — ingestion, correlation, auth, AI, WebSocket
│   ├── src/
│   ├── prisma/        # schema + migrations
│   └── docs/           # per-block architecture docs
├── frontend/          # Next.js analyst dashboard
│   └── src/
├── docs/               # deployment guide, cleanup log
├── Dockerfile.backend
├── Dockerfile.frontend
└── docker-compose.yml
```

Per-block architecture docs (correlation logic, WebSocket design, auth
model, AI integration) live in [`backend/docs/`](backend/docs/).

---

## Roadmap

- [x] Bloco 1 — Ingestion (Redis Streams pipeline, sensor simulator)
- [x] Bloco 2 — Correlation engine (sliding window, auto-incident creation)
- [x] Bloco 3 — Real-time layer (WebSocket, incident REST API)
- [x] Bloco 4 — AI integration (summary + response suggestion)
- [x] Bloco 4.5 — Auth (JWT + rotating refresh, hardening)
- [x] Bloco 5 — Frontend (Next.js analyst dashboard)
- [x] Bloco 6 — Deploy (Docker, EasyPanel)
- [ ] Bloco 7 — Self-heal (scheduled reset done; always-on simulator service pending)

---

## Author

Built by [Eiti Kobata](https://github.com/eitikobata) as a portfolio
project. Renamed from an earlier working title to avoid any overlap with
existing media IP — every agent, entity, and character name in this
project is original.
