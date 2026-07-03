---
name: Clerk Google OAuth blocks e2e test subagent
description: The Playwright-based testing subagent reliably refuses to proceed when a Clerk sign-in screen shows a "Continue with Google" option, even with explicit instructions to use only the programmatic auth path.
---

When a Clerk-gated flow's sign-in screen includes "Continue with Google" alongside email/password or OTP, the `runTest()` testing subagent auto-blocks on encountering that screen — it treats the presence of the third-party OAuth button as unsafe to interact with, regardless of instructions telling it to ignore that button and use only the programmatic `[Clerk Auth]` step.

**Why:** Retried twice across a session with progressively more explicit "do not use Google OAuth, use only programmatic Clerk Auth" instructions; same block both times. This is a testing-environment safety behavior, not something fixable by prompting.

**How to apply:** Don't retry `runTest()` a third time on the same Clerk+Google flow — it won't change outcome. Fall back to:
1. Direct DB + curl verification for backend/API logic (insert test fixtures via SQL, hit routes with curl, check timing/response shape, clean up fixtures after).
2. `mockup-extract` skill to pull the actual UI component into the sandbox with mock data (stubbing auth/router/API), then use the `screenshot` tool in both light and dark mode for visual QA — this avoids the Clerk auth gate entirely since the sandbox never imports the real auth flow.
