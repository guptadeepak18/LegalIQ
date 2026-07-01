---
name: LegalIQ Gemini setup
description: Gemini AI uses Replit AI Integrations proxy, not direct API key; uses @google/genai SDK.
---

# LegalIQ Gemini AI Setup

Uses **Replit AI Integrations** — no GEMINI_API_KEY needed from the user.

Env vars auto-provisioned: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY`

**Why:** Charges billed to Replit credits; no user API key required.

**How to apply:** In `artifacts/api-server/src/services/gemini.ts`, the `getAiClient()` function reads both env vars and creates a `GoogleGenAI` instance with `httpOptions.baseUrl`. Same pattern in `admin.ts`'s `getAdminAiClient()`.

Models used: `gemini-2.5-flash` (primary), `gemini-2.5-pro` (fallback)
