readme: |
  # Valki Bot — Backend API & Multi-Agent Processing Engine

  Valki Bot is de backend van het Valki-platform:  
  een multi-agent chatmotor die tekstverwerking, afbeelding-normalisatie, agent-routing, Postgres-opslag en Discord-integraties ondersteunt.  
  De backend is ontworpen voor schaalbaarheid, veiligheid en volledige FE/BE-consistentie via gedeelde TypeScript-contracten.

  ---

  ## 🧠 Wat deze backend doet

  - Verwerkt inkomende chatberichten (tekst + afbeeldingen)
  - Normaliseert requests tot gestructureerde objecten conform @valki/contracts
  - Roept LLM-agents aan (via agentId-routing)
  - Slaat conversaties, messages en users op met Prisma + Postgres
  - Normaliseert image uploads en filtert ongeldige bestanden
  - Stuurt responses terug naar de frontend widget of Discord
  - Gebruikt requestId voor end-to-end tracing
  - Maakt gebruik van een shared contractlaag zodat frontend & backend dezelfde domeintypes delen

  ---

  ## 📁 Projectstructuur

  Dit is de actuele structuur van dit project (zoals aanwezig in valki-bot-main):



  valki-bot/
  ├── prisma/
  │ ├── schema.prisma
  │ └── migrations/
  ├── src/
  │ ├── api/
  │ │ ├── server.js
  │ │ ├── routes/
  │ │ └── middleware/
  │ ├── core/
  │ │ ├── chat.js
  │ │ ├── normalize.js
  │ │ ├── uploads.js
  │ │ └── db.js
  │ ├── worker/
  │ │ └── discord.js
  │ └── util/
  ├── package.json
  ├── .env.example
  └── README.md


  Samenvatting:

  - **src/api** → Express server en HTTP-endpoints  
  - **src/core** → business logic (normalisatie, chat, uploads, DB helpers)  
  - **src/worker** → Discord worker  
  - **prisma** → database schema + migraties  

  ---

  ## 🔌 API Endpoints (zoals nu aanwezig)

  | Methode | Endpoint        | Doel |
  |---------|------------------|------|
  | POST    | `/api/valki`     | Hoofd chat endpoint |
  | GET     | `/api/messages`  | Ophalen messages |
  | POST    | `/api/upload`    | Afbeelding uploaden + normalisatie |
  | GET     | `/health`        | Liveness (process health) |
  | GET     | `/ready`         | Readiness (DB connectivity) |

  De API volgt de shapes van **@valki/contracts**.

  ---

  ## 🔌 WebSocket (protocol v1)

  - URL: `ws(s)://HOST/ws` (configurable via `WS_PATH`).
  - De WebSocket draait op dezelfde HTTP server/poort (Railway-friendly).

  **Client → Server**
  ```json
  { "v": 1, "type": "auth", "token": "optional" }
  { "v": 1, "type": "ping", "ts": 123 }
  { "v": 1, "type": "message", "messageId": "abc", "agentId": "optional", "text": "Hallo!" }
  ```

  **Server → Client**
  ```json
  { "v": 1, "type": "ready", "sessionId": "uuid", "authenticated": false }
  { "v": 1, "type": "pong", "ts": 123 }
  { "v": 1, "type": "error", "code": "UNAUTHORIZED", "message": "Token is invalid." }
  ```

  **Lokale test**
  ```bash
  npx wscat -c ws://localhost:3000/ws
  # send: {"v":1,"type":"ping","ts":123}
  ```

  Of via script:
  ```bash
  node scripts/ws-smoke-test.js
  ```

  ---

  ## 📦 Shared Contracts

  De backend importeert domeintypes uit bijhorende repository:

  ```ts
  import type {
    Message,
    Conversation,
    User,
    ImageMeta,
    Role,
    UserRole
  } from "@valki/contracts";
  

  Dit garandeert dat FE en BE dezelfde datavormen gebruiken.

  🛠️ Installatie & Setup
  Vereisten

  Node 18+

  PostgreSQL (bij voorkeur Railway)

  NPM

  Dependencies installeren
  npm install

  Environment variables

  Maak een .env bestand op basis van:

  DATABASE_URL="postgres://..."
  OPENAI_API_KEY="..."
  OPENAI_MODEL="gpt-5.2-chat-latest"
  OPENAI_SUMMARY_MODEL="gpt-5.2-chat-latest"
  OPENAI_VERSION="" # optional
  VALKI_PROMPT_ID="..."
  AUTH_TOKEN_SECRET="..."
  ENABLE_VALKI_SNAPSHOT=false # set true to enable legacy VALKI snapshot scheduler
  VALKI_STATS_API="" # required only when ENABLE_VALKI_SNAPSHOT=true
  DISCORD_CLIENT_ID="..."
  DISCORD_CLIENT_SECRET="..."
  DISCORD_REDIRECT_URI="..."
  GOOGLE_CLIENT_ID="..."
  GOOGLE_CLIENT_SECRET="..."
  GOOGLE_REDIRECT_URI="..."
  NODE_ENV=development
  PORT=8080
  WS_PATH=/ws
  CORS_ORIGINS="https://valki.wiki,https://www.valki.wiki,https://auth.valki.wiki"
  IQAI_API_BASE="https://app.iqai.com"
  IQAI_BEARER="" # optional if upstream is public
  PUBLIC_SELF_BASE_URL="https://auth.valki.wiki"
  AGENT_SNAPSHOT_INTERVAL_MS=3600000
  AGENT_SNAPSHOT_SOURCE="iqai"

  Prisma initialiseren
  npx prisma generate
  npx prisma migrate deploy

  Development server
  npm run dev

  Production
  npm start

  ## 🛠️ Build & Start Notes

  - Build must run `prisma generate` (e.g. via `pnpm prisma:generate`).
  - Start runs `prisma migrate deploy` before booting the server.

  ## 🚄 Railway notes

  - Set `PORT` via Railway (the API listens on `process.env.PORT`).
  - WebSocket upgrades use the same host/port (no extra Railway ports required).
  - Recommended healthchecks:
    - Liveness: `/health`
    - Readiness: `/ready`

  🧩 Belangrijke backend-onderdelen
  1. Chat Pipeline

  Code: src/core/chat.js, src/core/normalize.js

  Verantwoordelijk voor:

  Message shaping

  ImageMeta verwerking

  Agent routing

  Safety filters

  Request tracing via requestId

  2. Uploads & Image Normalisatie

  Code: src/core/uploads.js

  Functies:

  max file size checks

  MIME-type validatie

  Afwijzen van onveilige bestanden

  Mapping naar ImageMeta

  3. Database (Prisma)

  Database tables:

  User

  Conversation

  Message

  Agent

  Upload

  4. Discord Worker

  Code: src/worker/discord.js

  Taken:

  Ontvangt Discord user input

  Converteert naar Valki chatverzoek

  Stuurt agent-responses terug

  🧪 Quality Checks
  npm run lint
  npm run typecheck
  npm test


  CI/CD gebeurt via Railway Deployments.

  🗺️ Aanbevolen ontwikkelrichting (roadmap op basis van huidige code)
  🔥 1. Image Pipeline 2.0

  Uitbreiden MIME support (PNG/JPEG/webp/HEIC)

  Dropped image logging verbeteren

  Canonical ImageMeta-shape + fallback

  💬 2. Multi-Agent Routing

  Conversatie → agent mapping

  Departmenting (sales/support/general)

  Skills/capabilities registreren per agent

  🧠 3. Conversation Intelligence

  Automatic summaries

  Sentiment & risk detection

  Memory snapshots per conversation

  ⚡ 4. Realtime Updates

  SSE / WebSocket ondersteuning

  Typing indicators

  Cross-device sync

  🔐 5. Security & Observability

  Rate limiting

  Audit logs

  Prometheus metrics

  RequestId tracing dashboard

  📜 6. Contract-Driven Development

  Zod schema’s voor runtime validatie

  OpenAPI genereren vanuit @valki/contracts

  Client SDK genereren
