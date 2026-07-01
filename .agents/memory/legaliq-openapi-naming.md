---
name: LegalIQ OpenAPI naming
description: Body/Response component schema names must not match Orval's auto-generated <OperationIdPascal>Body or Response pattern.
---

# LegalIQ OpenAPI Schema Naming

**Rule:** Every request/response body schema in `lib/api-spec/openapi.yaml` must use entity-shaped names, never `<OperationIdPascal>Body` or `<OperationIdPascal>Response`.

**Why:** Orval generates Zod schemas in `generated/api.ts` named `<OperationIdPascal>Body` for each operation's request body. If a component schema has the same name, the `api-zod` barrel re-exports both and TypeScript throws TS2308 "already exported a member".

**How to apply:** When writing the spec, rename colliding schemas:
- `CreateLeadBody` → `LeadRegistration`
- `SubmitAssessmentBody` → `AssessmentInput`
- `AdminLoginBody` → `AdminCredentials`
- etc. (see openapi.yaml for the current mapping)

After any spec change: `pnpm --filter @workspace/api-spec run codegen`
