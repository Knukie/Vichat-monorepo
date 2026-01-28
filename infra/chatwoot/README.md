# Chatwoot (local development)

## Prerequisites
- Docker Desktop

## Quickstart
1. `cp .env.example .env`
2. Vul `SECRET_KEY_BASE` in met een veilige waarde
3. `pnpm infra:up`
4. `pnpm chatwoot:setup`

## Railway deploy (web + worker)
Deze setup gaat uit van **twee Railway services** (web en worker) vanuit dezelfde GitHub repo. De Dockerfile in `infra/chatwoot` draait automatisch `db:chatwoot_prepare` bij deploy voor de web service.

### Web service
1. Maak een nieuwe Railway service: **Deploy > GitHub Repository**.
2. Kies deze repo en zet **Root Directory** op `infra/chatwoot`.
3. Laat Railway de Dockerfile gebruiken (default). Start command moet **leeg** blijven.
4. Zet environment variable `ROLE=web`.
5. Runtime wordt bepaald door `WORKDIR /app` in de Dockerfile (Chatwoot draait onder `/app`).
6. Koppel je **custom domain alleen aan de web service** (niet aan de worker).

### Worker service
1. Maak een tweede Railway service op dezelfde repo.
2. Gebruik ook **Root Directory** `infra/chatwoot`.
3. Zet environment variable `ROLE=worker`.
4. Laat **Start Command** leeg (Dockerfile + entrypoint start Sidekiq als PID1).

### Required environment variables
- `ROLE` (`web` of `worker`)
- `RAILS_ENV=production`
- `NODE_ENV=production`
- `DATABASE_URL` (gebruik de **Supabase Session Pooler** URL met IPv4)
- `REDIS_URL`
- `SECRET_KEY_BASE` (nooit committen)
- `FRONTEND_URL`
- `BACKEND_URL`
- `FORCE_SSL` (true/false)
- `DEFAULT_LOCALE`
- `ENABLE_ACCOUNT_SIGNUP`
- `DISABLE_PREPARED_STATEMENTS=true` (vereist voor pgBouncer/Supabase pooler)
- `ENABLE_AI_AGENTS=false` (aan te zetten zodra migraties stabiel zijn)

> Opmerking: als je Railway anders wilt opzetten (bijv. één service), pas de bovenstaande aannames aan.

## Troubleshooting
- **Ports in use:** stop services die poort 3000/5432/6379 gebruiken of pas de poorten aan in `docker-compose.yml`.
- **Reset volumes:** `docker compose --env-file infra/chatwoot/.env -f infra/chatwoot/docker-compose.yml down --volumes`
