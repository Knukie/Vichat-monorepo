# Vichat Widget — Embedded Chat Frontend (Theme: Valki Talki)

De **Vichat Widget** is de embedbare frontend van het Vichat-platform.  
Het is een lichte, moderne chatwidget die je in elke website kunt plaatsen en die praat met de Vichat backend (`valki-bot`).  
De widget ondersteunt tekst, afbeeldingen en (in de toekomst) meerdere agents/departments.

*“Valki Talki” is één van de beschikbare themes/stijlen binnen Vichat.*

---

## 🎯 Doel van deze widget

- Bezoekers van een site direct laten chatten met:
  - een AI-assistant,
  - een menselijke agent,
  - of een combinatie (multi-agent).
- Integreren met de backend-API zonder dat de websitebouwer zelf complexe logica hoeft te schrijven.
- Veilig draaien onder strikte CSP (Content Security Policy), inclusief veilige weergave van Markdown/HTML.
- Dezelfde datamodellen gebruiken als de backend via `@valki/contracts`.

---

## ✨ Belangrijkste features (huidig)

- 💬 Chat UI met user- en bot/agent-bubbels
- 🖼️ Ondersteuning voor het meesturen van afbeeldingen (images array)
- 🧩 FE/BE-consistentie via `@valki/contracts` (Message, Conversation, User, ImageMeta, etc.)
- 🏷️ Basis voor agent/department selectie (bijv. Support / Sales / Reserveringen)
- 🛡️ Veilige rendering van botcontent (HTML escaping, hardening van links)
- 🧪 Playwright E2E-tests, incl. security smoke tests en strict CSP harness
- 🧱 Ontworpen om in elke site te embedden via een klein `<script>` of bundel

---

## 🧱 Projectstructuur (globaal)

> Let op: deze structuur is een samenvatting van de actuele widget-codebase.



valki-talki-widget/
├── src/
│ ├── components/
│ │ ├── ChatWidget.tsx / .jsx # Hoofd chatcomponent
│ │ ├── MessageList.tsx # Lijst met messages
│ │ ├── MessageBubble.tsx # UI voor individuele bubbels
│ │ ├── InputBar.tsx # Tekstinvoer + uploadknop
│ │ └── AgentSelector.tsx # (optioneel) agents/departments UI
│ ├── core/
│ │ ├── api.ts # Calls naar backend
│ │ ├── state.ts # Widget state management
│ │ └── contracts.ts # (nu vervangen door @valki/contracts)
│ ├── util/
│ │ ├── markdown.ts # Markdown/HTML sanitization & rendering
│ │ └── csp.ts # Strict CSP helpers/harness
│ ├── index.tsx / index.js # Widget entrypoint
│ └── styles/ # Styling/theming (o.a. Valki Talki theme)
├── tests/
│ ├── widget.spec.ts # Basis eindgebruikersflow
│ └── security-smoke.spec.ts # XSS / link-hardening / CSP-tests
├── package.json
└── README.md


---

## 🛠️ Installatie & ontwikkeling

### Vereisten
- Node 18+
- npm of yarn
- Een draaiende backend (`valki-bot` / Vichat backend) om tegenaan te praten

### Dependencies installeren

```sh
npm install


Zorg dat @valki/contracts is toegevoegd als dependency (via GitHub of npm):

npm install https://github.com/Knukie/valki-contracts.git#main

Development-server starten
npm run dev


Dit start een lokale dev-preview van de Vichat widget.

Productie build maken
npm run build


Output gaat naar dist/ of vergelijkbare map (zie bundlerconfig).

🔌 Embed in een website

In de uiteindelijke integratie kan een website bijvoorbeeld:

<div id="vichat"></div>
<script
  src="https://cdn.yoursite.com/vichat-widget.js"
  data-client-id="YOUR_CLIENT_ID"
  data-backend-url="https://api.yourbackend.com"
></script>


Of via bundling/SPA:

import { renderVichatWidget } from "vichat-widget";

renderVichatWidget({
  elementId: "vichat",
  backendUrl: "https://api.yourbackend.com",
  clientId: "YOUR_CLIENT_ID",
});


Belangrijkste configuratie:

backendUrl → URL naar de Vichat backend (/api/valki, /api/upload, etc.)

clientId → identificatie van de embed/site/klant

optioneel: agentId / departmentId voor directe routering

📡 Verwachte backend contracten

De Vichat widget praat met de backend op basis van @valki/contracts.
Typische calls:

POST /api/valki

Body (voorbeeld):

{
  "message": "Hoi! Ik heb een vraag.",
  "clientId": "vichat-client-123",
  "conversationId": "optional-conv-id",
  "images": [],
  "agentId": "optional-agent-id"
}


Response (vereenvoudigd):

{
  "messages": [
    {
      "id": "msg_123",
      "conversationId": "conv_123",
      "role": "assistant",
      "content": "Hoi! Hoe kan ik je helpen?",
      "images": [],
      "ts": "2026-01-08T09:00:00.000Z"
    }
  ]
}

📦 Shared Contracts in de widget

De Vichat widget gebruikt domeintypes uit @valki/contracts om dezelfde datamodellen te gebruiken als de backend:

import type {
  Message,
  Conversation,
  User,
  ImageMeta
} from "@valki/contracts";

export type UiMessage = Message & {
  isPending?: boolean;
  isLocalOnly?: boolean;
};

🛡️ Security & CSP

De Vichat widget bevat speciale logica om veilig te zijn onder strikte Content Security Policies:

Geen inline scripts

Botcontent wordt ontsmet/sanitized voordat het gerenderd wordt

Links in botberichten worden gehardend (bijv. rel="noreferrer noopener", target="_blank")

De tests in tests/security-smoke.spec.ts controleren o.a.:

dat <img src=x onerror=alert(1)> niet als echte <img> uitgevoerd wordt

dat bots niet zomaar script injecties kunnen forceren via HTML-injectie

🧪 Testen

Veelvoorkomende scripts (bekijk package.json voor exacte namen):

npm run test
npm run test:e2e
npm run test:e2e:smoke


Let op dat sommige E2E-tests een Playwright browser binary vereisen; in CI of bepaalde omgevingen moet deze eerst geïnstalleerd worden.

🚧 Waar Vichat het beste naartoe kan groeien (Widget Roadmap)

Op basis van de huidige code en roadmap:

1. Robust image flow

Betere UX bij het uploaden van afbeeldingen (preview, retry, duidelijke foutmeldingen).

Strakke aansluiting op de backend image normalizer (alleen toegestane types tonen/doorsturen).

Mogelijk: drag & drop, meerdere afbeeldingen per bericht.

2. Multi-agent / department selector

UI waarmee de gebruiker vooraf of tijdens het gesprek een agent/department kan kiezen (bijv. Support, Sales, Reserveringen).

Dit direct koppelen aan agentId/departmentId richting de backend.

3. Realtime updates

Ondersteuning voor SSE of WebSockets om nieuwe berichten en typing indicators live te tonen.

Sync tussen meerdere tabs/devices.

4. Thema’s en branding

Config opties voor kleuren, logo, welcome message.

Makkelijk themable (waaronder het Valki Talki theme).

5. Foutafhandeling & UX-polish

Heldere UI wanneer de backend niet bereikbaar is.

Resend-knop voor mislukte berichten.

Loading- en typingstates verfijnen.

6. FE/BE contract-checking

Eventueel Zod-schema’s inzetten aan frontendzijde om responses van backend te valideren voordat ze gerenderd worden.

Striktere typing rondom API-calls.

🗺️ Korte Vichat Widget Roadmap (samenvattend)

 Image upload UX & foutmeldingen verbeteren

 Multi-agent / department keuze inbouwen

 Realtime (SSE/WebSocket) integratie met backend

 Thema/branding configurabel maken (waaronder Valki Talki theme)

 Contract-validatie met Zod

 Extra integraties (bijv. fullscreen, chat history module)

📝 Licentie

Private project – alle rechten voorbehouden.
Niet bedoeld voor publieke redistributie zonder toestemming.
