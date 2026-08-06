# Bloco 3 — Tempo real (WebSocket) + REST de incidentes

## Gateway

`IncidentsGateway` (`src/incidents/incidents.gateway.ts`) é um Nest
Gateway padrão, anexado ao mesmo servidor HTTP do Nest (mesma porta,
`socket.io` na rota `/socket.io`). Sem namespace/room por enquanto —
broadcast global pra todo cliente conectado, já que ainda não existe
sessão/identidade de analista.

Eventos emitidos:

| Evento | Quando | Payload |
|---|---|---|
| `incident.created` | Engine de correlação abre um Incident novo | Incident completo (com `entity`) |
| `incident.updated` | Severidade sobe (mais eventos linkados) OU status muda via ação do analista | `{ id, ...campos que mudaram }` |
| `incident.comment` | Analista comenta um incidente | `IncidentComment` completo |

O gateway não tem lógica própria — é só uma superfície de `emit()`.
Quem decide o que emitir é `CorrelationService` (Bloco 2) e
`IncidentsService` (Bloco 3), depois que já persistiram a mudança no
Postgres. Socket é canal de notificação, não fonte de verdade.

`CorrelationModule` importa `IncidentsModule` e injeta o gateway
direto no `CorrelationService` — sem round-trip HTTP entre engine e
gateway.

## REST — histórico e ações do analista

Base: `/incidents`

| Rota | Descrição |
|---|---|
| `GET /incidents?status=&limit=&offset=` | Listagem paginada, filtro opcional por status |
| `GET /incidents/:id` | Detalhe — entity, eventos (timeline) e comentários |
| `PATCH /incidents/:id/investigate` | `OPEN → INVESTIGATING` |
| `PATCH /incidents/:id/close` | `* → CLOSED` (seta `closedAt`) |
| `PATCH /incidents/:id/escalate` | `OPEN\|INVESTIGATING → ESCALATED` |
| `POST /incidents/:id/comments` | `{ author, body }` — cria comentário e emite `incident.comment` |

Transições de status são validadas contra uma tabela fixa
(`ALLOWED_TRANSITIONS` em `incidents.service.ts`). `CLOSED` é
terminal — reabrir incidente não é escopo do Bloco 3. Transição
inválida = `400`.

## Modelo novo: `IncidentComment`

Tabela `incident_comments`, FK pra `incidents`. `author` é texto livre
por enquanto — ainda não existe sistema de auth/identidade de
analista, isso fica pra quando essa peça entrar no roadmap.

Migration: `prisma/migrations/20260806120000_add_incident_comments`.

## Como testar

1. `docker compose up -d` (Postgres + Redis)
2. `npm install` (novas deps: `@nestjs/websockets`,
   `@nestjs/platform-socket.io`, `socket.io`)
3. `npx prisma migrate dev` (aplica a migration do `IncidentComment`)
4. `npm run start:dev`
5. **Gatilho do socket**: rode `npm run simulator` (ou
   `npm run test:correlation`) em outro terminal — a sequência
   suspeita proposital do simulador dispara o Bloco 2, que agora
   também emite `incident.created` no socket.
6. **Ver o evento chegando** sem montar frontend ainda: teste rápido
   com `wscat` ou um snippet Node:

   ```js
   const { io } = require('socket.io-client');
   const socket = io('http://localhost:3000');
   socket.on('incident.created', console.log);
   socket.on('incident.updated', console.log);
   socket.on('incident.comment', console.log);
   ```

7. **REST**: com o id retornado no `incident.created`,
   `curl -X PATCH http://localhost:3000/incidents/<id>/investigate`,
   depois `.../escalate` ou `.../close`, e
   `curl -X POST http://localhost:3000/incidents/<id>/comments -H "Content-Type: application/json" -d '{"author":"analyst-1","body":"checking entity history"}'`
   — cada ação deve aparecer no socket conectado no passo 6.
   