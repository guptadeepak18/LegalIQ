export const ADMIN_PERMISSIONS = [
  "dashboard",
  "leads:view",
  "leads:update",
  "leads:export",
  "ai",
  "analytics",
  "reviews",
  "email",
  "settings",
  "admin-users",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const FULL_ADMIN_PERMISSIONS: AdminPermission[] = [...ADMIN_PERMISSIONS];

export function normalizePermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value)) return [...FULL_ADMIN_PERMISSIONS];
  const allowed = new Set<string>(ADMIN_PERMISSIONS);
  return [...new Set(value.filter((permission): permission is AdminPermission =>
    typeof permission === "string" && allowed.has(permission),
  ))];
}

export function hasFullPermissions(value: unknown): boolean {
  const permissions = normalizePermissions(value);
  return ADMIN_PERMISSIONS.every((permission) => permissions.includes(permission));
}