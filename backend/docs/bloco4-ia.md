# Bloco 4 — IA Integration (Incident Analysis & Response Suggestion)

## Overview

Bloco 4 adds **AI-powered incident enrichment** to the correlation engine. When an incident is created (Bloco 2), the system:

1. Generates a **natural language summary** of the event sequence
2. Re-evaluates **severity** using pattern analysis
3. Suggests a **response agent** (from a roster of 5 original agents) with tailored protocol & rules of engagement
4. Lets the analyst **accept, partially accept, or override** the suggestion
5. Emits all results via **WebSocket** so the dashboard updates in real time

## Architecture

### Services

**`AiService`** (`src/ai/ai.service.ts`)
- Async-fire-and-forget from `CorrelationService`
- Calls LLM (Claude or Gemini) via HTTP
- Parses responses and persists enriched data to Postgres
- Emits WebSocket events when analysis completes

**`CorrelationService`** (modified)
- After creating an incident, calls `aiService.generateSuggestion(incidentId)`
- Non-blocking — incident opens immediately, AI enriches it in parallel

### Database

Three new fields on `Incident` model:

```prisma
summary              String?        // AI-generated natural language summary
suggestedSeverity    Int?           // AI re-evaluated severity (0-100)
aiAgentSuggestion    Json?          // {agentId, agentName, specialty, protocol, rulesOfEngagement}
analystDecision      Json?          // {action, agentFinal, protocolFinal, rulesFinal, timestamp}
```

### Agent Roster

Five **original fictional agents** (no Ghost in the Shell names):

1. **Echo** — Network Intrusion Detection
2. **Sentinel** — Endpoint Forensics
3. **Relay** — Threat Hunting & Pattern Analysis
4. **Nexus** — Incident Containment
5. **Prism** — Threat Intelligence Integration

Each has a specialty that shapes the protocol recommendation.

## Configuration

**`src/config/ai.config.ts`**

```typescript
export const aiConfig = {
  provider: 'claude' | 'gemini' | 'mock',  // via AI_PROVIDER env
  claudeApiKey: string,                     // via CLAUDE_API_KEY env
  claudeModel: 'claude-3-5-sonnet-20241022', // default
  geminiApiKey: string,                     // via GEMINI_API_KEY env
  geminiModel: 'gemini-2.0-flash',          // default
  timeoutMs: 30000,                         // via AI_TIMEOUT_MS env
  debug: false,                             // via AI_DEBUG=true env
};
```

**Environment Variables**

```bash
# Required for production
CLAUDE_API_KEY=sk-ant-...
AI_PROVIDER=claude

# OR for Gemini
GEMINI_API_KEY=...
AI_PROVIDER=gemini

# Optional tuning
AI_TIMEOUT_MS=30000
AI_DEBUG=true  # logs prompts/responses
```

## Workflow

### Incident Creation Flow

```
1. Correlation engine detects pattern → creates Incident
2. Emits "incident.created" via WebSocket (dashboard shows it immediately)
3. Spawns AiService.generateSuggestion(incidentId) in background (non-blocking)
4. AiService fetches incident + events, calls LLM 3x (summary, severity, agent)
5. Persists results to Incident.summary, suggestedSeverity, aiAgentSuggestion
6. Emits "incident.analysis" via WebSocket (dashboard updates summary/agent card)
```

### Analyst Decision Flow

**POST** `/incidents/{id}/decision`

```json
{
  "action": "accept" | "partial" | "reject",
  "agentId": "agent-alpha",         // if "partial", override agent
  "protocolOverride": "CUSTOM_PROTO", // if "partial", override protocol
  "rulesOverride": "..."             // if "partial", override rules
}
```

Response: Incident with `analystDecision` field populated

- **accept**: Uses AI suggestion as-is
- **partial**: Keeps some AI fields, overrides others
- **reject**: Analyst provides own values

## API Endpoints

### List Incidents (existing)
**GET** `/incidents` → returns all incidents with summary/suggestion/decision fields

### Get Incident Detail (existing)
**GET** `/incidents/{id}` → full incident with events, comments, AI analysis

### Register Analyst Decision (NEW)
**POST** `/incidents/{id}/decision`

```json
{
  "action": "accept"
}
```

All endpoints require valid JWT (`JwtAuthGuard`).

## WebSocket Events

### incident.analysis
Emitted when AI finishes analysis or analyst registers decision.

```json
{
  "id": "incident-123",
  "summary": "...",
  "suggestedSeverity": 75,
  "aiAgentSuggestion": {
    "agentId": "agent-alpha",
    "agentName": "Echo",
    "specialty": "Network Intrusion Detection",
    "protocol": "ISOLATE_AND_MONITOR",
    "rulesOfEngagement": "Enable full network capture, restrict outbound traffic"
  },
  "analystDecision": {
    "action": "partial",
    "timestamp": "2025-01-15T10:00:00Z",
    "agentFinal": "agent-bravo",
    "protocolFinal": "ISOLATE_AND_MONITOR",
    "rulesFinal": "..."
  }
}
```

## Error Handling

- **AI provider down**: Incident still opens, analysis is logged but doesn't block. Dashboard shows summary/agent as missing/unknown.
- **Invalid LLM response**: Falls back to defaults (random agent, generic protocol)
- **No API key**: Throws error on first `generateSuggestion()` call — use `mock` provider for dev/test

## Testing

### Mock Provider (Dev)

Set `AI_PROVIDER=mock` to skip all API calls. `AiService` returns deterministic responses:

```typescript
// Mock summary
"Mock summary: 5 suspicious event(s) detected on entity-123"

// Mock severity
Math.min(100, 30 + eventCount * 10)

// Mock agent
Random from roster
```

### Integration Test Flow

1. Start backend with `AI_PROVIDER=mock`
2. POST event via webhook → incident created
3. Wait 1-2 seconds
4. GET `/incidents/{id}` → has summary, suggestedSeverity, aiAgentSuggestion
5. POST `/incidents/{id}/decision` with analyst override
6. GET `/incidents/{id}` → analystDecision populated

## Interview Talking Points

- **Non-blocking enrichment**: Incident opens immediately, AI analysis happens in parallel. No latency tradeoff between detection speed and enrichment depth.
- **LLM fallback strategy**: If AI fails, we don't block the incident. Graceful degradation.
- **Analyst-in-the-loop**: AI suggests, analyst decides. Keeps humans in charge of security decisions.
- **Original agent roster**: Demonstrates originality in design (no franchise IP reuse).
- **Configurable provider**: Claude/Gemini/Mock — easy to swap or test without API calls.

## Future Work (Bloco 5+)

- **Timer UI component**: Countdown for analyst to accept/override AI suggestion (gamified UX element)
- **Incident response templates**: Store playbooks per agent/protocol for faster team execution
- **Feedback loop**: Log which AI suggestions analysts accept/reject to fine-tune prompts over time
- **Multi-provider**: Route summarization to Claude, severity to Gemini, agent to a vector DB of historical incidents