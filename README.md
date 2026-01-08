# Vichat Monorepo

Vichat is een AI-powered chatplatform bestaande uit:
- **Backend API** (`packages/bot`) — Node.js/Express + Prisma + PostgreSQL (Railway)
- **Widget** (`packages/widget`) — embedbare webchat
- **Shared Contracts** (`packages/contracts`) — canonieke TypeScript domeintypes (FE + BE)

Dit monorepo is opgezet met **pnpm workspaces** zodat frontend en backend altijd dezelfde types gebruiken en type-drift wordt voorkomen.

---

## Repository structure

```text
vichat-monorepo/
├─ packages/
│  ├─ contracts/   # @valki/contracts (types only)
│  ├─ bot/         # valki-bot (backend API)
│  └─ widget/      # vichat-widget (frontend widget)
├─ pnpm-workspace.yaml
├─ package.json
└─ README.md
```

## Packages

### packages/contracts — @valki/contracts
Single source of truth voor domeintypes zoals:
- Message
- Conversation
- User / Roles / Statuses
- ImageMetadata

Geen runtime code (alleen types)

### packages/bot — valki-bot
Express API + Prisma (PostgreSQL)

Belangrijke endpoints (kan per versie verschillen):
- /api/messages
- /api/upload
- (aanrader) /health en /ready

Railway notes
- Vereist DATABASE_URL
- Start draait migrations (Prisma)
- Luistert op process.env.PORT

### packages/widget
Embedbare webchat-widget
- Consumeert exact dezelfde types uit @valki/contracts
- Stuurt canonieke payloads naar de backend

## Local development

### Requirements
- Node.js (LTS)
- pnpm (npm i -g pnpm@9)

### Install
```bash
pnpm install
```

### Typecheck (alles)
```bash
pnpm -r typecheck
```

### Run bot (lokaal)
```bash
pnpm --filter valki-bot start
```

### Run widget (lokaal)
```bash
pnpm --filter vichat-widget dev
```

Scriptnaam kan afwijken; check packages/widget/package.json.

## Deployment overview

### Railway (backend)
Deploy alleen valki-bot:
- Build: pnpm install --frozen-lockfile
- Start: pnpm --filter valki-bot start
- Vereist env vars: DATABASE_URL (+ OpenAI/Discord keys)

### Widget
Widget kan:
- apart gedeployed worden (Railway / Vercel / Cloudflare)
- of als static build output (afhankelijk van setup)

## Roadmap (high-level)
- Backend image pipeline fix (no silent drops, canonical ImageMetadata, structured errors)
- Conversation metadata endpoints
- Widget UI: summaries / assignment / status
- Agent routing & roles
- Observability + CI/CD + versioning (Changesets)

## Notes
Oude repos zijn gemigreerd naar dit monorepo.
@valki/contracts is build-time only en wordt niet als service gedeployed.
