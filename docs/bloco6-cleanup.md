# Bloco 6 — Repo Cleanup Log

Registro do que foi encontrado e corrigido ao preparar o repo pro deploy.
Mantido por transparência e porque parte disso é bom material de
entrevista (mostra processo de debug real, não só "deu certo").

## O que estava quebrado

1. **`backend/` continha o frontend inteiro duplicado dentro dele** —
   `next.config.js`, `tailwind.config.ts`, `postcss.config.js`,
   `src/app/`, `src/components/`, `src/hooks/`, `src/lib/`, `README.md`
   com conteúdo de frontend. Provável sobra do mesmo incidente dos
   `.git` aninhados (Bloco 5) — o `.git` foi corrigido na época, mas os
   arquivos de frontend que vazaram pra `backend/` nunca foram
   removidos.

2. **A cópia duplicada tinha a versão *mais nova* do auth.** Dentro de
   `backend/src/components/AuthProvider.tsx` e `backend/src/lib/api.ts`
   estava a versão correta do hardening (refresh token via cookie
   httpOnly, access token só em memória). A versão que rodava de
   verdade — `frontend/src/` — ainda tinha a versão antiga
   (localStorage). Ou seja: o hardening documentado nunca chegou no
   frontend real. Migrado a versão correta pra `frontend/src/`.

3. **`backend/package.json` e `tsconfig.json` eram os do Next.js**
   (scripts `next dev/build`, `module: ESNext`, `jsx: react-jsx`, sem
   `experimentalDecorators`). Reescritos do zero pra NestJS. Também
   faltava `nest-cli.json` (não existia em lugar nenhum do repo).

4. **`cookie-parser` e `@nestjs/throttler` são usados no código mas
   nunca estavam no `package.json`** — build quebrava com
   `Cannot find module`. Adicionados (`cookie-parser`, `@nestjs/throttler`,
   `@types/cookie-parser`).

5. **Import errado de `cookie-parser` em `main.ts`**: `import * as
   cookieParser` não é chamável com a versão de `@types/cookie-parser`
   instalada — precisa ser `import cookieParser from 'cookie-parser'`
   (default import). Corrigido.

6. **`backend/.env.example` tinha só variáveis de frontend**
   (`NEXT_PUBLIC_*`), nada de `DATABASE_URL`, `REDIS_HOST`, `JWT_*` etc.
   Reescrito batendo 1:1 com o que `src/config/*.ts` realmente lê.

7. **Dockerfiles (Bloco 6, primeira versão) assumiam npm workspaces na
   raiz** (`npm ci` + `npm run build -w backend`) — mas não existe
   `package.json` na raiz do repo. Reescritos pra instalar/buildar cada
   app dentro do seu próprio diretório.

8. **Variáveis `THROTTLE_TTL`/`THROTTLE_LIMIT` inventadas nos
   `.env.example`** — o rate limit do `/auth/login` é hardcoded via
   `@Throttle({ limit: 5, ttl: 60000 })` no controller, não vem de env
   var. Removidas dos templates de ambiente pra não sugerir uma config
   que não existe.

## Validação feita

- `npm install` + `npm run build` rodado de verdade em `backend/` e
  `frontend/` (não só lido o código).
- **Frontend: build 100% limpo**, incluindo o auth-fix já aplicado.
- **Backend: build limpo** exceto pela geração do Prisma Client, que
  não pôde ser testada nesta sandbox (rede bloqueia
  `binaries.prisma.sh`) — mas os models do schema batem exatamente com
  o que o código importa (`User`, `Incident`, `RawEvent`,
  `IncidentStatus`), então isso deve resolver sozinho ao rodar
  `npx prisma generate` localmente.
- `docker-compose.yml` e `docker-compose.prod.yml` validados
  sintaticamente (YAML parse OK).

## O que não foi tocado

- Lógica de negócio (correlation engine, auth service, AI service) —
  só a estrutura de arquivos, configs de build, e o bug pontual do
  import do cookie-parser.
- Line-ending diffs (LF vs CRLF) em alguns arquivos não commitados —
  não é conteúdo real mudando, ignorado.
