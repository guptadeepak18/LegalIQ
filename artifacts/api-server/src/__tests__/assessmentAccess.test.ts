import assert from "node:assert/strict";
import { addSixCalendarMonths } from "../services/assessmentWindow.js";

function iso(value: Date) {
  return value.toISOString();
}

assert.equal(
  iso(addSixCalendarMonths(new Date("2026-01-31T10:30:00.000Z"))),
  "2026-07-31T10:30:00.000Z",
  "ordinary month-end dates retain their day and time",
);

assert.equal(
  iso(addSixCalendarMonths(new Date("2025-08-31T23:59:59.000Z"))),
  "2026-02-28T23:59:59.000Z",
  "month-end dates clamp to the final day of the target month",
);

assert.equal(
  iso(addSixCalendarMonths(new Date("2023-08-29T00:00:00.000Z"))),
  "2024-02-29T00:00:00.000Z",
  "the six-calendar-month boundary handles leap years",
);

console.log("assessment access date tests passed");