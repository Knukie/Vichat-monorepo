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
  VALKI_PROMPT_ID="..."
  AUTH_TOKEN_SECRET="..."
  DISCORD_CLIENT_ID="..."
  DISCORD_CLIENT_SECRET="..."
  DISCORD_REDIRECT_URI="..."
  GOOGLE_CLIENT_ID="..."
  GOOGLE_CLIENT_SECRET="..."
  GOOGLE_REDIRECT_URI="..."
  NODE_ENV=development
  PORT=8080

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
