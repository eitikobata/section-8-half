# Section 8½ — Frontend (Bloco 5)

Next.js dashboard for the Threat Correlation Engine. Real-time incident monitoring, AI-assisted response decisions, and analyst workflow.

## Setup

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:3000 npm run dev
```

## Architecture

- **Auth**: JWT access + refresh tokens, auto-refresh 1min before expiry
- **Real-time**: socket.io-client (WebSocket) for incident updates
- **State**: TanStack Query (React Query) for API data, Zustand for UI state
- **Forms**: React Hook Form + Zod validation
- **Styling**: Tailwind CSS + cyberpunk theme

## Routes

- `/` — Login screen
- `/dashboard` — Main incident monitoring dashboard

## Environment

```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_INCIDENT_DECISION_TIMEOUT_MS=120000
```
