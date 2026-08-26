import assert from "node:assert/strict";
import { parseAdminDateTime } from "../services/consultationTime.js";

const scheduled = parseAdminDateTime("2026-08-27T15:00");
assert.ok(scheduled);
assert.equal(scheduled.toISOString(), "2026-08-27T09:30:00.000Z");

const midnight = parseAdminDateTime("2026-08-27T00:00");
assert.ok(midnight);
assert.equal(midnight.toISOString(), "2026-08-26T18:30:00.000Z");

assert.equal(parseAdminDateTime("2026-02-30T15:00"), null);
console.log("consultation time tests passed");