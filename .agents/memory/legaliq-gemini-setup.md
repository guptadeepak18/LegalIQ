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

## Thinking budget silently eats maxOutputTokens

`gemini-2.5-*` models default to "thinking" mode, which consumes part of `maxOutputTokens` for internal reasoning before writing the visible response — even though the API call succeeds and looks fine in logs. This showed up as intermittent `JSON.parse` failures ("Unexpected end of JSON input" / "Unterminated string") on prompts asking for structured JSON, especially latency-sensitive ones with a short output cap (e.g. a follow-up-question generator capped at 1200-2500 tokens). It also inflated latency well past what the raw prompt/response size would suggest (10-20s+ for a short JSON reply), which can blow through client-side timeouts even when the model call itself succeeds a moment later.

**Why:** thinking tokens are billed and counted against `maxOutputTokens` but are not part of `response.text`, so a budget that looks generous for the visible JSON schema can still truncate it.

**How to apply:** pass `config.thinkingConfig: { thinkingBudget: 0 }` for `gemini-2.5-flash` calls that need fast, fully-formed structured JSON. `gemini-2.5-pro` does not allow `0` — use its minimum (`128`) instead. Do this for any latency-sensitive or tightly-token-capped Gemini JSON call in this codebase, not just existing ones.
