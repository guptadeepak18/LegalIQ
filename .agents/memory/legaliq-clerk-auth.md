---
name: LegalIQ Clerk auth integration
description: How LegalIQ uses Clerk for onboarding identity verification (Google + email/password + email OTP) and where the auth gates live.
---

LegalIQ uses Replit-managed Clerk (not the old custom OTP-email flow) to verify a lead's identity before they can see their Legal Health Score.

- `/onboard` step 0 gates on `useUser().isSignedIn`. Signed-out users see a "Verify Your Identity" card linking to `/sign-up` (Google + email/password, Clerk handles email verification) and `/sign-in`. Once signed in, it auto-advances to step 1 (Business Details), which still collects the mobile number as a plain form field (not OTP-verified) — mobile OTP was intentionally dropped in favor of Clerk email verification.
- `/results` gates on the same `useUser()` hook: redirect precedence must be checked in one effect, not two independent effects — checking "no assessment result" and "not signed in" in separate `useEffect`s races and can send an unauthenticated user to `/` instead of `/sign-in` (whichever effect's `navigate()` call resolves last wins). Always nest: not-loaded → wait; not-signed-in → `/sign-in`; signed-in-but-no-result → `/`.
- The API server derives the lead's email from the Clerk session (`getAuth(req)` + `clerkClient.users.getUser(userId)`) rather than accepting it in the request body — `POST /leads` no longer takes `email`/`emailToken`.
- **Why:** avoids duplicating verification logic (Clerk already does OAuth + email OTP) and prevents a spoofable client-supplied email.

## `runTest` e2e is unreliable on Clerk-gated flows in this project

`runTest` with `testClerkAuth: true` can get stuck returning a cached "Testing is blocked: ... Clerk's external OAuth-style flow ..." error for the rest of the session after the harness first hits an unauthenticated Clerk sign-up screen, even on later retries.

**Why:** the harness appears to latch onto the blocked state from the first attempt rather than re-evaluating per-call.

**How to apply:** don't burn retries re-running `runTest` against Clerk-gated pages once this error appears once in a session. Instead verify backend logic via direct DB seeding + curl through the proxy (bypassing the Clerk-gated frontend route), and verify frontend layout/behavior visually via the mockup-sandbox + canvas skills (build an isolated mock component with representative data, screenshot at target viewport widths).
