export const ADMIN_PERMISSIONS = [
  "dashboard",
  "leads:view",
  "leads:update",
  "leads:export",
  "ai",
  "analytics",
  "reviews",
  "email",
  "brochures",
  "settings",
  "admin-users",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const FULL_ADMIN_PERMISSIONS: AdminPermission[] = [...ADMIN_PERMISSIONS];

export function normalizePermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value)) return [...FULL_ADMIN_PERMISSIONS];
  const allowed = new Set<string>(ADMIN_PERMISSIONS);
  const permissions = [...new Set(value.filter((permission): permission is AdminPermission =>
    typeof permission === "string" && allowed.has(permission),
  ))];
  const legacyFullPermissions = ADMIN_PERMISSIONS.filter((permission) => permission !== "brochures");
  if (!permissions.includes("brochures") && legacyFullPermissions.every((permission) => permissions.includes(permission))) {
    permissions.push("brochures");
  }
  return permissions;
}

export function hasFullPermissions(value: unknown): boolean {
  const permissions = normalizePermissions(value);
  return ADMIN_PERMISSIONS.every((permission) => permissions.includes(permission));
}