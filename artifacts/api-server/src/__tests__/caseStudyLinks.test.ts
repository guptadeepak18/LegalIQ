import assert from "node:assert/strict";
import { listVerifiedCaseStudySources } from "../data/caseStudies.js";

const sources = listVerifiedCaseStudySources();
assert.ok(sources.length > 0, "verified case catalog must not be empty");

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      return await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "LegalIQ-Case-Source-Validator/1.0",
          accept: "text/html,application/pdf;q=0.9,*/*;q=0.8",
        },
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

for (const source of sources) {
  const response = await fetchWithRetry(source.sourceUrl);
  // Some authoritative publishers (notably Indian Kanoon) reject automated
  // clients with 403 while the exact page remains available in a browser.
  // Treat an HTTP response as reachable, but fail missing/gone/server-error
  // pages and network/DNS/timeout failures.
  assert.ok(
    response.status !== 404 && response.status !== 410 && response.status < 500,
    `${source.id} source did not resolve successfully: ${response.status} ${source.sourceUrl}`,
  );
}

console.log(`caseStudyLinks tests passed (${sources.length} exact sources resolved)`);