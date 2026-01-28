# Chatwoot (local development)

## Prerequisites
- Docker Desktop

## Quickstart
1. `cp .env.example .env`
2. Vul `SECRET_KEY_BASE` in met een veilige waarde
3. `pnpm infra:up`
4. `pnpm chatwoot:setup`

## Troubleshooting
- **Ports in use:** stop services die poort 3000/5432/6379 gebruiken of pas de poorten aan in `docker-compose.yml`.
- **Reset volumes:** `docker compose --env-file infra/chatwoot/.env -f infra/chatwoot/docker-compose.yml down --volumes`
