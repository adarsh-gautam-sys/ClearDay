# ClearDay — Urban Air Quality & Winter Smog Assistant

> **Google Virtual PromptWars — Challenge 6**  
> Helping families and communities navigate severe winter smog with low-emission daily routines, budget-tiered indoor air quality hacks, sustainable alternatives, and transparent impact math.

---

## Key Capabilities

- **Live Winter Smog Telemetry & Window Detection**: Integrates **Open-Meteo Air Quality & Geocoding APIs** (with 6 instant winter-smog city presets and offline fallback) to surface US AQI, PM2.5, PM10, NO₂, O₃, CO, a 24-hour curve, the **Cleanest Ventilation Window**, and the **Peak Inversion Hazard Window**.
- **Tailored GenAI Action Plan (`@google/genai`)**: Generates structured JSON guidance via `gemini-2.5-flash` (`responseJsonSchema`) grounded in live telemetry and household context (scope, children/elderly/asthma/pets, commute, filtration, cooking fuel, and heating), organized into:
  - `01 · Daily Routine` (anchored to today's inversion curve)
  - `02 · Indoor Hacks` (`Free`, `Under $40`, `Upgrade` tiers with step-by-step instructions)
  - `03 · Sustainable Swaps` (with neighborhood multipliers and a copy-ready Community Advisory draft)
- **Deterministic Impact Ledger (Zero Hallucinated Math)**: Interactive **"Adopt Today"** toggles recalculate indoor PM2.5 reduction (`%` & `µg/m³`), cigarette-equivalent dose avoided, daily & 90-day winter CO₂e / PM2.5 savings, and a **Community Scale Multiplier** slider in <1 ms client-side using cited EPA, WHO, DEFRA, and Berkeley Earth factors.
- **Grounded Streaming Smog Copilot**: Real-time streaming Q&A with prompt-injection XML boundaries and a deterministic respiratory emergency guardrail.
- **Guided Offline Mode**: Works out-of-the-box even without a `GEMINI_API_KEY`, using a rule-based winter smog planner and contextual responder until a key is added.

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
  └── Next.js 15 App Router API Routes (Zod + Sliding-Window Rate Limiter + TTL Cache)
        ├── GET  /api/air-quality  ──▶ Open-Meteo APIs (15m grid cache + preset fallback)
        ├── POST /api/plan         ──▶ @google/genai JSON Schema (15m cache + rule fallback)
        └── POST /api/chat         ──▶ @google/genai Stream + respiratory safety detector
```

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # Optional: add GEMINI_API_KEY for live Gemini Flash
npm run dev
```

Open `http://localhost:3000`.

### Environment Variables (`.env.example`)
- `GEMINI_API_KEY` *(optional)* — Server-only Google Gemini API key. Leave blank to run in **Guided Offline** mode.
- `GEMINI_MODEL` *(optional, default `gemini-2.5-flash`)* — Gemini model ID.

---

## Verification & Rubric Alignment

| Command | Checks |
| :--- | :--- |
| `npm test` | Unit tests (AQI breakpoints, smog window detection, deterministic impact math, Zod schemas, rate limiter, safety), API route integration tests, UI interaction tests, and `axe-core` accessibility audits |
| `npm run typecheck` | Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`) |
| `npm run lint` | ESLint (`next/core-web-vitals`, `next/typescript`, `jsx-a11y`) |
| `npm run build` | Production bundle + strict CSP & security headers (`next.config.ts`) |
