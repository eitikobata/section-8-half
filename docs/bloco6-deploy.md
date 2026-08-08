# Bloco 6 — Deploy & Infrastructure

## Overview

Bloco 6 fornece:
- **Docker Compose** para orquestração local/dev e produção
- **Dockerfiles** multi-stage otimizados para NestJS (backend) e Next.js (frontend)
- **Variáveis de ambiente** centralizadas (`.env.example`, `.env.production.example`)
- **Documentação** de deploy em VPS via EasyPanel ou Docker direto

Arquitetura:
```
┌─────────────────────────────────────────────────────────┐
│ Reverse Proxy (nginx / EasyPanel) — HTTPS/SSL           │
├─────────────────────────────────────────────────────────┤
│ Frontend (Next.js:3001)     │ Backend API (NestJS:3000)  │
├─────────────────────────────────────────────────────────┤
│ PostgreSQL:5432  │  Redis:6379  (internos, não expostos)│
└─────────────────────────────────────────────────────────┘
```

---

## Local Development (Docker Compose)

### Quick Start

```bash
# 1. Clone repo
git clone https://github.com/eitikobata/section-8-half.git
cd section-8-half

# 2. Setup environment
cp .env.example .env
# Edit .env if needed (defaults are OK for local dev)

# 3. Start services
docker-compose up -d

# 4. Seed demo data (first run)
docker-compose exec backend npm run seed -w backend

# 5. Open browser
# Frontend:  http://localhost:3001
# Backend:   http://localhost:3000
# API docs:  http://localhost:3000/api (if Swagger enabled)
```

### Services Status

```bash
# Check all running
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop & clean
docker-compose down
docker-compose down -v  # also remove volumes (deletes data)
```

### Development Workflow

**Hot reload** is enabled for source files (volumes mounted):
- Backend changes (src/, prisma/) → auto-rebuild via NestJS development mode
- Frontend changes (src/, public/) → auto-rebuild via Next.js dev server

**Database migrations:**
```bash
# Run migrations (Prisma)
docker-compose exec backend npx prisma migrate dev --name add_something

# View schema
docker-compose exec backend npx prisma studio  # web UI at localhost:5555
```

**Database shell:**
```bash
docker-compose exec postgres psql -U postgres -d section8half
```

**Redis shell:**
```bash
docker-compose exec redis redis-cli
```

---

## Production Deployment

### Prerequisites

- **Docker** & **Docker Compose** (v2.x+)
- **Domain** with DNS pointed to your VPS
- **SSL Certificate** (Let's Encrypt recommended)
- **VPS** with at least 2GB RAM, 1 vCPU (or managed database + Redis services)

### Setup on VPS

#### 1. Prepare Environment

```bash
# SSH into VPS
ssh user@your-vps-ip

# Create app directory
mkdir -p /opt/section-8-half
cd /opt/section-8-half

# Clone repo (or copy files)
git clone https://github.com/eitikobata/section-8-half.git .

# Setup production environment
cp .env.production.example .env.production

# Edit with real secrets
nano .env.production
```

**Critical environment variables for production:**

```bash
# MUST MATCH: frontend and backend must use same domain
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com  # or https://api.yourdomain.com

# Generate secrets: openssl rand -hex 32
JWT_ACCESS_SECRET=<32-char-hex>
JWT_REFRESH_SECRET=<32-char-hex>

# API keys for AI integration
CLAUDE_API_KEY=sk-...
GEMINI_API_KEY=...

# Database & cache credentials (use strong passwords)
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password-if-needed>

# Cookie hardening (HTTPS only)
COOKIE_SECURE=true
COOKIE_DOMAIN=.yourdomain.com
```

#### 2. Build Images

```bash
docker-compose build
# This builds both backend and frontend multi-stage images
```

#### 3. Start Services

```bash
# Start in background
docker-compose up -d

# Wait for postgres to be ready (~10s)
docker-compose logs -f postgres

# Seed demo data (one-time)
docker-compose exec backend npm run seed -w backend

# Verify all services are up
docker-compose ps
```

#### 4. Reverse Proxy Setup

**Option A: Using EasyPanel**

If deploying via EasyPanel (recommended for simplicity):
1. Create a new application in EasyPanel dashboard
2. Point it to your Git repo
3. Configure env vars in EasyPanel dashboard (copy from `.env.production`)
4. EasyPanel handles Docker, SSL, and reverse proxy automatically
5. Set custom domain in EasyPanel settings

**Option B: Manual nginx**

If running manually, configure nginx as a reverse proxy:

```nginx
upstream backend {
    server localhost:3000;
}

upstream frontend {
    server localhost:3001;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

#### 5. SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Auto-renew
sudo systemctl enable certbot.timer
```

---

## Monitoring & Maintenance

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Tail last 100 lines
docker-compose logs -n 100 backend
```

### Database Backups

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U postgres section8half > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U postgres section8half < backup.sql

# Backup volumes
docker run --rm -v section8half_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

### Resource Monitoring

```bash
# Container stats
docker stats

# Check disk usage
docker system df
```

### Scaling

For production with high load:

1. **Use managed services** (RDS for Postgres, ElastiCache for Redis)
2. **Load balancer** for multiple backend instances
3. **CDN** for static frontend assets (Cloudflare, AWS CloudFront)
4. **Increase Docker resource limits** in compose file

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Database not ready: wait a few seconds and retry
# 2. Wrong DATABASE_URL: check .env file
# 3. Migration failed: docker-compose exec backend npx prisma migrate resolve
```

### Frontend won't connect to backend
```bash
# Check WebSocket connection: browser DevTools → Network → WS
# 1. NEXT_PUBLIC_API_URL must match actual backend URL
# 2. FRONTEND_URL on backend must match frontend origin
# 3. CORS settings in backend/src/config/app.config.ts
```

### Redis/Postgres connections fail
```bash
# Check health
docker-compose ps
docker-compose logs redis
docker-compose logs postgres

# Restart containers
docker-compose restart redis postgres
```

### Demo login not working
```bash
# Re-seed data
docker-compose exec backend npm run seed -w backend

# Check demo user
docker-compose exec postgres psql -U postgres -d section8half \
  -c "SELECT id, email, username FROM users LIMIT 5;"
```

---

## Production Checklist

- [ ] `.env.production` created with real secrets
- [ ] Database password changed (not default `postgres`)
- [ ] JWT secrets generated (`openssl rand -hex 32`)
- [ ] FRONTEND_URL and BACKEND_URL match domain exactly
- [ ] COOKIE_SECURE=true (requires HTTPS)
- [ ] SSL certificate installed and configured
- [ ] Rate limiting enabled (THROTTLE_LIMIT)
- [ ] AI API keys (CLAUDE/GEMINI) configured
- [ ] Images built and tested locally first
- [ ] Database backups scheduled
- [ ] Monitoring/alerting setup
- [ ] Firewall rules configured (only 80, 443 exposed)
- [ ] SSH key auth enabled (no password login)

---

## File Structure

```
section-8-half/
├── .env.example                 # Dev template
├── .env.production.example      # Prod template
├── .dockerignore                # Files to exclude from Docker builds
├── docker-compose.yml           # Dev/prod compose (primary)
├── docker-compose.prod.yml      # Prod overrides (optional)
├── Dockerfile.backend           # NestJS multi-stage build
├── Dockerfile.frontend          # Next.js multi-stage build
├── backend/                     # NestJS application
│   ├── package.json
│   ├── src/
│   ├── prisma/
│   └── dist/                    # Built output (gitignored)
├── frontend/                    # Next.js application
│   ├── package.json
│   ├── src/
│   ├── public/
│   └── .next/                   # Built output (gitignored)
└── docs/
    ├── bloco6-deploy.md         # This file
    ├── bloco4.5-auth.md
    └── ...
```

---

## References

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [NestJS Docker](https://docs.nestjs.com/deployment/docker)
- [Next.js Docker](https://nextjs.org/docs/deployment/docker)
- [EasyPanel Docs](https://easypanel.io/)
- [Let's Encrypt](https://letsencrypt.org/)
