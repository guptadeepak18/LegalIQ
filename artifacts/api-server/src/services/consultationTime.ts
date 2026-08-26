const INDIA_TIME_ZONE = "Asia/Kolkata";
const INDIA_OFFSET_MINUTES = 330;

/**
 * datetime-local has no timezone. The admin scheduling UI is intentionally
 * defined as India time, so convert that wall-clock value to the UTC instant
 * stored by PostgreSQL.
 */
export function parseAdminDateTime(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [, year, month, day, hour, minute] = match;
  const utcMillis = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) -
    INDIA_OFFSET_MINUTES * 60_000;
  const parsed = new Date(utcMillis);
  const check = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(parsed);
  const values = Object.fromEntries(check.map((part) => [part.type, part.value]));
  if (`${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}` !== value.trim()) return null;
  return parsed;
}