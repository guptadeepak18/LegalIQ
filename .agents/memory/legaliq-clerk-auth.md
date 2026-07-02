---
name: LegalIQ Clerk auth integration
description: How LegalIQ uses Clerk for onboarding identity verification (Google + email/password + email OTP) and where the auth gates live.
---

LegalIQ uses Replit-managed Clerk (not the old custom OTP-email flow) to verify a lead's identity before they can see their Legal Health Score.

- `/onboard` step 0 gates on `useUser().isSignedIn`. Signed-out users see a "Verify Your Identity" card linking to `/sign-up` (Google + email/password, Clerk handles email verification) and `/sign-in`. Once signed in, it auto-advances to step 1 (Business Details), which still collects the mobile number as a plain form field (not OTP-verified) — mobile OTP was intentionally dropped in favor of Clerk email verification.
- `/results` gates on the same `useUser()` hook: redirect precedence must be checked in one effect, not two independent effects — checking "no assessment result" and "not signed in" in separate `useEffect`s races and can send an unauthenticated user to `/` instead of `/sign-in` (whichever effect's `navigate()` call resolves last wins). Always nest: not-loaded → wait; not-signed-in → `/sign-in`; signed-in-but-no-result → `/`.
- The API server derives the lead's email from the Clerk session (`getAuth(req)` + `clerkClient.users.getUser(userId)`) rather than accepting it in the request body — `POST /leads` no longer takes `email`/`emailToken`.
- **Why:** avoids duplicating verification logic (Clerk already does OAuth + email OTP) and prevents a spoofable client-supplied email.
