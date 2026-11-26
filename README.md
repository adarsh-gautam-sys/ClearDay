# ClearDay — Urban Air Quality & Winter Smog Assistant

> **Google Virtual PromptWars — Challenge 6**  
> Helping families and communities navigate severe winter smog with low-emission daily routines, budget-tiered indoor air quality hacks, sustainable alternatives, and transparent impact math.

---

## Key Capabilities

- **Live Winter Smog Telemetry & Window Detection**: Integrates **Open-Meteo Air Quality & Geocoding APIs** (with 6 winter-smog city presets and offline fallback) to surface US AQI, PM2.5, PM10, NO₂, O₃, CO, a 24-hour forecast curve, the **Cleanest Ventilation Window**, and the **Peak Inversion Hazard Window**.
- **Tailored GenAI Action Plan (`@google/genai`)**: Generates schema-validated JSON guidance via **`gemini-3-flash-preview`** (`responseJsonSchema` + Zod `ActionPlanResponseSchema`) with a 15s upstream timeout guard, grounded in live telemetry and household context:
  - `01 · Daily Routine` (anchored to today's inversion curve)
  - `02 · Indoor Hacks` (`Free`, `Under $40`, `Upgrade` tiers with expandable setup steps)
  - `03 · Sustainable Swaps` (each with swap-specific **Direct Impact** rationale, neighborhood multipliers, and a copy-ready Community Advisory draft)
- **Deterministic Direct Impact Ledger (Zero Hallucinated Math)**: Interactive **"Adopt Today"** toggles recalculate indoor PM2.5 reduction (`%`, `µg/m³`, and accessible `progressbar`), cigarette-equivalent dose avoided, daily & 90-day winter CO₂e / PM2.5 savings, a copyable **Plain-English Direct Impact Summary**, and a **Community Scale Multiplier** slider in <1 ms client-side using cited US EPA, WHO, DEFRA, and Berkeley Earth factors.
- **Grounded SSE Smog Copilot**: Real-time Server-Sent Events (`text/event-stream`) Q&A backed by Vertex AI streaming with upstream abort/cancellation propagation, XML prompt-delimiter + Unicode bidi/zero-width sanitization, and a deterministic respiratory emergency guardrail.
- **Horizontally Scalable Distributed Store**: Pluggable `DistributedStore` supporting **Redis HTTP REST** (`REDIS_REST_URL` / `REDIS_REST_TOKEN`), **Google Cloud Firestore Native** (auto-enabled on Cloud Run via `K_SERVICE` or `FIRESTORE_CACHE_ENABLED=true` using Cloud Run metadata OAuth tokens), or a **byte-bounded** (2 MiB / 64 KiB max entry) LRU memory store for local development.

---

## Design System & Interactive Frontend (`MengTo/Skills` + Three.js + shadcn/ui + ReactBits)

- **Three.js Volumetric Smog Chamber (`threejs-weather` skill)**: Pre-allocated WebGL particulate pool (`setDrawRange`) separated into [createSmogScene.ts](src/components/three/createSmogScene.ts), zero-allocation per-frame color lerping, pointer parallax, 24h scrubber coupling, an **Outdoor vs. Inside Plan** simulation toggle, offscreen/tab pausing, and static reduced-motion/no-WebGL fallback.
- **shadcn/ui Radix Primitives & WAI-ARIA Combobox**: Accessible `Tabs`, `Dialog` (Portal + focus trap), `Slider`, `Tooltip`, `Button`, `Badge`, and keyboard-navigable [CitySearchCombobox.tsx](src/components/shell/CitySearchCombobox.tsx) (`ArrowDown`/`ArrowUp`/`Home`/`End`/`Enter`/`Escape` + `aria-activedescendant`).
- **Accessibility First**: Full HTML5/ARIA landmarks (`header`, `section[aria-label]`, `main`, `aside`, `footer`), Windows High Contrast `@media (forced-colors: active)` support, `sr-only` live status announcements & exact `CountUp` screen-reader values, and **0 `axe-core` violations** (verified both in Vitest and live headless Chromium with computed color contrast).

---

## Modular Architecture

```text
Browser UI (React 19 + Paper-Technical Split Shell + App Router error.tsx / loading.tsx)
  ├── Hooks: useClearDayWorkspace (persistence/telemetry) · useSmogCopilot (SSE + abort)
  └── Next.js 15 Standalone Server (withApiErrorHandling + verifySameOrigin + streaming 32 KiB cap)
        ├── GET  /api/health       ──▶ Deep Firestore/Redis ping probe (rate-limited), AI readiness
        ├── GET  /api/air-quality  ──▶ Open-Meteo geocoding & telemetry (15m distributed cache)
        ├── POST /api/plan         ──▶ @google/genai JSON Schema (client.ts + actionPlanSchema.ts)
        └── POST /api/chat         ──▶ @google/genai SSE stream + Unicode/medical safety guardrails
              │
              ▼
   DistributedStore (Redis REST │ Cloud Firestore REST + GcpMetadataTokenProvider │ Memory Dev Store)
   Observability: Cloud Logging structured JSON logger + X-Request-Id correlation on all routes
```

---

## Live Deployment (Google Cloud Run)

- **Live URL**: https://clearday-562790399795.asia-south1.run.app
- **GCP Project**: `clearday-air-pw6` (`asia-south1`)
- **Health Probe**: `GET /api/health?probe=1` (verifies Cloud Firestore round-trip & Vertex AI IAM readiness)
- **Keyless AI Auth (`vertex-adc`)**: Cloud Run service account `clearday-runner` (`roles/aiplatform.user` + `roles/datastore.user`), using `@google/genai` with `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_LOCATION=global`, and `GEMINI_MODEL=gemini-3-flash-preview` (zero static API keys stored).

---

## Quick Start & Cloud Run Container

```bash
npm install
cp .env.example .env.local   # Optional: configure GEMINI_API_KEY or Vertex/Redis/Firestore vars
npm run dev
```

Open `http://localhost:3000`.

### Production Docker & CI
- Multi-stage non-root `Dockerfile` (`output: "standalone"`, `PORT=8080`, native container `HEALTHCHECK`).
- GitHub Actions CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` on every push and PR.

---

## Verification Commands

| Command | Checks |
| :--- | :--- |
| `npm test` | Comprehensive Vitest suite across unit, integration, UI, and accessibility specs (`analyzer`, `calculator`, `safety`, `schemas`, `prompts`, `gemini`, `sse`, `openMeteo`, `security`, `storageFactory`, `routes`, `workspace`, `components`, `extraComponents`, and live `axe-core` audits) |
| `npm run typecheck` | Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`) |
| `npm run lint` | ESLint (`next/core-web-vitals`, `next/typescript`, `jsx-a11y`, strict `eqeqeq`/`no-var`/`prefer-const`) |
| `npm run build` | Standalone production bundle + hardened CSP, COOP, CORP, HSTS, and cross-domain headers |
