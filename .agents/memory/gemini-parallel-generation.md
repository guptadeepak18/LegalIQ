---
name: Gemini timeout via oversized single call
description: A single large multi-section structured-JSON Gemini generation call can exceed a caller's request timeout, silently triggering a static/fallback data path instead of an error.
---

When a route generates a large multi-section JSON payload (e.g. N sections × M items each) via one Gemini call, response time scales with total output size. If the caller enforces a hard timeout shorter than that generation time, the request doesn't fail loudly — it just falls back to whatever static/default data the caller uses on timeout, which can look like a functioning feature while silently never using AI output.

**Why:** A single "generate all 20 questions across 4 pillars" call took ~35-40s against a 30s timeout. Two different inputs produced byte-identical output because both silently hit the same static fallback — this was invisible until timing was checked directly.

**How to apply:** When a generation call risks exceeding a timeout because of combined output size, split it into parallel per-section calls (`Promise.all`), each scoped to a fraction of the total output with a smaller max-token budget. Verify the fix by timing the request end-to-end and confirming output is genuinely input-specific (not just checking for a 200 response).
