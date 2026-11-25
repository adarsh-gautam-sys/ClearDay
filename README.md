# ClearDay — Urban Air Quality & Winter Smog Assistant

> **Google Virtual PromptWars — Challenge 6**  
> Helping families and communities navigate severe winter smog with low-emission daily routines, budget-tiered indoor air quality hacks, sustainable alternatives, and transparent impact math.

---

## Key Capabilities

- **Live Winter Smog Telemetry & Window Detection**: Integrates **Open-Meteo Air Quality & Geocoding APIs** (with 6 instant winter-smog city presets and offline fallback) to surface US AQI, PM2.5, PM10, NO₂, O₃, CO, a 24-hour curve, the **Cleanest Ventilation Window**, and the **Peak Inversion Hazard Window**.
- **Tailored GenAI Action Plan (`@google/genai`)**: Generates structured JSON guidance via `gemini-2.5-flash` (`responseJsonSchema`) with a 15s upstream timeout guard, grounded in live telemetry and household context, organized into:
  - `01 · Daily Routine` (anchored to today's inversion curve)
  - `02 · Indoor Hacks` (`Free`, `Under $40`, `Upgrade` tiers with step-by-step instructions)
  - `03 · Sustainable Swaps` (with neighborhood multipliers and a copy-ready Community Advisory draft)
- **Deterministic Impact Ledger (Zero Hallucinated Math)**: Interactive **"Adopt Today"** toggles recalculate indoor PM2.5 reduction (`%` & `µg/m³`), cigarette-equivalent dose avoided, daily & 90-day winter CO₂e / PM2.5 savings, and a **Community Scale Multiplier** slider in <1 ms client-side using cited EPA, WHO, DEFRA, and Berkeley Earth factors.
- **Grounded SSE Smog Copilot**: Real-time Server-Sent Events (`text/event-stream`) Q&A with XML prompt-injection boundaries, abort/stop controls, and a deterministic respiratory emergency guardrail.
- **Horizontally Scalable Distributed Store**: Pluggable `DistributedStore` supporting **Redis HTTP REST** (`REDIS_REST_URL` / `REDIS_REST_TOKEN`), **Google Cloud Firestore** (`FIRESTORE_CACHE_ENABLED=true` via Cloud Run metadata token), or a **byte-bounded** (2 MiB / 64 KiB max entry) LRU memory store for local development.

---

## Design System (`MengTo/Skills`)

Built following the [`MengTo/Skills`](https://github.com/MengTo/Skills) web-design skill specifications:
- `light-mode-paper-technical`: Deep charcoal outer frame (`#141517`), warm diagonal-textured paper interior (`#F6F4EF`), elevated parchment cards (`#FCFBF8`), corner L-brackets, and restrained atmospheric teal (`#0F6E6E`).
- `split-layout-technical`: Asymmetric desktop split workspace stacking cleanly on mobile.
- `beautiful-shadows`: Layered neutral elevation utilities (`sm`, `md`, `lg`).
- `number-details`: Monospace architectural markers (`00`–`05`) with `tabular-nums`.
- `thinking-orbs`: Accessible `ThinkingOrb` canvas indicators paired with single-source `aria-live="polite"` status text.

---

## Architecture

```text
Browser UI (React 19 + Paper-Technical Split Shell)
  ├── Local State & Impact Engine (<1ms deterministic math, localStorage)
  └── Next.js 15 Standalone Server (Bounded 32 KiB JSON + Proxy-Safe IP Rate Limiting)
        ├── GET  /api/health       ──▶ Store backend, AI mode, container liveness
        ├── GET  /api/air-quality  ──▶ Open-Meteo APIs (Distributed 15m cache + CDN headers)
        ├── POST /api/plan         ──▶ @google/genai JSON Schema (Distributed 15m cache + fallback)
        └── POST /api/chat         ──▶ @google/genai SSE stream + respiratory safety detector
              │
              ▼
   DistributedStore (Redis REST │ Cloud Firestore REST │ Byte-Bounded Dev Store)
```

---

## Quick Start & Cloud Run

```bash
npm install
cp .env.example .env.local   # Optional: add GEMINI_API_KEY or Redis/Firestore vars
npm run dev
```

Open `http://localhost:3000`.

### Cloud Run Production Container
Built with `output: "standalone"` and a multi-stage non-root `Dockerfile` listening on `PORT=8080`:
- Health check endpoint: `GET /api/health`
- Horizontal scaling: set `REDIS_REST_URL` + `REDIS_REST_TOKEN` **or** `FIRESTORE_CACHE_ENABLED=true` + `FIRESTORE_PROJECT_ID` so caching and rate-limiting share state across all Cloud Run instances.

---

## Verification Commands

| Command | Checks |
| :--- | :--- |
| `npm test` | Unit tests (AQI breakpoints, smog windows, deterministic impact math, distributed store byte/REST/Firestore checks, SSE parser, bounded JSON, anti-spoof IP extraction), API route integration tests, UI interaction tests, and `axe-core` accessibility audits |
| `npm run typecheck` | Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`) |
| `npm run lint` | ESLint (`next/core-web-vitals`, `next/typescript`, `jsx-a11y`) |
| `npm run build` | Standalone production bundle + strict CSP & HSTS headers (`next.config.ts`) |
