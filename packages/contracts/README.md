# @valki/contracts

Minimalistische TypeScript-types voor het Valki-ecosysteem. Dit pakket bevat uitsluitend gedeelde domein-types (geen runtime logic) zodat frontend en backend dezelfde bron van waarheid gebruiken.

## Installatie

```bash
npm install @valki/contracts
```

## Gebruik

```ts
import type { Message, Conversation } from "@valki/contracts";
```

## Voor wie

- **Frontend (widget)**: gebruikt dezelfde types als de backend.
- **Backend (valki-bot)**: gebruikt dezelfde types als de frontend.
