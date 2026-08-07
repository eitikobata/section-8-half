# Bloco 4.5 — Auth (MVP-grade)

## Modelo mental (pra quem tá pegando auth pela primeira vez)

- **Access token**: um JWT curto (15min), mandado no header
  `Authorization: Bearer <token>` em toda requisição REST/WS. Ele *é* a
  prova de identidade — o servidor não guarda sessão nenhuma pra ele,
  só valida a assinatura e a expiração. Curto de propósito: se vazar,
  a janela de uso é pequena.
- **Refresh token**: dura muito mais (7-30 dias), mas só serve pra uma
  coisa: trocar por um access token novo em `/auth/refresh`. Ele *é*
  guardado no servidor (hash no Postgres), porque precisa poder ser
  revogado — é o único jeito de "deslogar" alguém antes do prazo.
- **Rotação**: toda vez que um refresh token é usado, ele é invalidado
  e um par novo (access + refresh) é emitido. Se alguém roubar um
  refresh token antigo e tentar reusar depois que o dono já rotacionou,
  o token roubado já tá marcado como revogado — falha.

## O que foi implementado

`src/auth/` — módulo novo:

| Arquivo | Responsabilidade |
|---|---|
| `auth.service.ts` | `login`, `refresh` (com rotação), `logout` (revoga 1 token) |
| `auth.controller.ts` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| `jwt.strategy.ts` | Passport strategy — valida access token, popula `req.user` |
| `guards/jwt-auth.guard.ts` | Guard REST (`@UseGuards(JwtAuthGuard)`) |
| `guards/ws-jwt.guard.ts` | Verifica o access token no handshake do WebSocket |

`src/config/auth.config.ts` — secrets, TTLs e credenciais do usuário
demo, mesmo padrão de `correlation.config.ts`.

## Modelos novos (Prisma)

- **`User`**: `username`, `passwordHash` (bcrypt), `role` (enum
  `UserRole`, só `ANALYST` por enquanto — hierarquia de papéis
  fica pra quando algum fluxo real do produto precisar diferenciar
  analistas).
- **`RefreshToken`**: `tokenHash` (SHA-256, nunca o token cru),
  `jti`, `expiresAt`, `revokedAt`. `revokedAt` é o mecanismo de
  revogação inteiro — sem Redis separado pra isso, o lookup por
  `tokenHash` (unique index) já é rápido o suficiente pro volume de
  um MVP.

`IncidentComment.author` (texto livre) virou `IncidentComment.authorId`
(FK pra `User`) — o comentário agora carrega quem realmente postou,
não o que o cliente mandou no body.

Migration: `prisma/migrations/20260807000000_add_auth`.

## O que mudou nos módulos existentes

- `IncidentsController` — `@UseGuards(JwtAuthGuard)` em todas as rotas.
  `POST /incidents/:id/comments` não recebe mais `author` no body,
  pega de `req.user.id`.
- `IncidentsGateway` — `handleConnection` chama
  `WsJwtGuard.verifyClient()` na mão (Nest não roda `@UseGuards` no
  hook de conexão, só em `@SubscribeMessage`) e desconecta quem não
  manda um token válido em `socket.handshake.auth.token`.
- `IncidentsModule` — importa `AuthModule` (o gateway agora depende do
  `WsJwtGuard`).

## Usuário demo

Seed fixo (`analyst-demo` / senha em `DEMO_USER_USERNAME` /
`DEMO_USER_PASSWORD` no `.env`) — é o que vai alimentar o botão de
auto-fill do login no Bloco 5 (frontend), mesmo padrão do
`deep-space-support`.

## Como testar

1. `npm install` (novas deps: `@nestjs/jwt`, `@nestjs/passport`,
   `passport`, `passport-jwt`, `bcrypt`)
2. `npx prisma migrate dev` (aplica a migration do Bloco 4.5)
3. `npm run prisma:seed` (cria o `analyst-demo`)
4. `npm run start:dev`
5. Login:
   ```bash
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"analyst-demo","password":"demo12345"}'
   ```
   Guarda o `accessToken` e o `refreshToken` da resposta.
6. Rota protegida (deve dar 401 sem o header):
   ```bash
   curl http://localhost:3000/incidents \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXNqYmFpY3YwMDAwcDVmcnkybzg0OHp1IiwidXNlcm5hbWUiOiJhbmFseXN0LWRlbW8iLCJyb2xlIjoiQU5BTFlTVCIsImlhdCI6MTc4NjEzMDk4MCwiZXhwIjoxNzg2MTMxODgwfQ.o10IYSDTaf5EwmQVMoi6NMl5LEH9yFrEpbiCkT0ywI8"
   ```
7. Refresh (o `refreshToken` usado aqui fica revogado, um par novo
   volta na resposta):
   ```bash
   curl -X POST http://localhost:3000/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken":"<refreshToken>"}'
   ```
8. WebSocket autenticado:
   ```js
   const { io } = require('socket.io-client');
   const socket = io('http://localhost:3000', {
     auth: { token: '<accessToken>' },
   });
   socket.on('connect', () => console.log('conectado'));
   socket.on('disconnect', () => console.log('rejeitado/desconectado'));
   ```
   Sem `auth.token` (ou com um token inválido), o socket conecta e é
   imediatamente desconectado pelo `WsJwtGuard`.
