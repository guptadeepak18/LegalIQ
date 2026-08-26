import { apiFetch, authHeaders } from "@/lib/api";

export const ADMIN_PERMISSION_OPTIONS = [
  { value: "dashboard", label: "Dashboard", detail: "Portfolio overview and KPIs" },
  { value: "leads:view", label: "View leads", detail: "Lead list and assessment reports" },
  { value: "leads:update", label: "Update leads", detail: "Lead statuses and consultations" },
  { value: "leads:export", label: "Export leads", detail: "CSV lead-data downloads" },
  { value: "ai", label: "AI tools", detail: "Insights and email drafting" },
  { value: "analytics", label: "Analytics", detail: "Portfolio analysis dashboard" },
  { value: "reviews", label: "Review moderation", detail: "Approve and reject testimonials" },
  { value: "email", label: "Email management", detail: "Templates, sender settings, and logs" },
  { value: "brochures", label: "Brochure templates", detail: "Create templates and select report brochure designs" },
  { value: "settings", label: "System settings", detail: "Platform configuration visibility" },
  { value: "admin-users", label: "Admin users", detail: "Create and manage administrator accounts" },
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSION_OPTIONS)[number]["value"];

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  permissions: AdminPermission[];
  createdAt?: string;
  updatedAt?: string;
}

const PROFILE_STORAGE_KEY = "liq_admin_profile";

export function getStoredAdminProfile(): AdminProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(PROFILE_STORAGE_KEY);
    return value ? JSON.parse(value) as AdminProfile : null;
  } catch {
    return null;
  }
}

export function storeAdminProfile(profile: AdminProfile): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event("liq-admin-profile-updated"));
}

export function clearAdminSession(): void {
  localStorage.removeItem("liq_admin_token");
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}

export function hasAdminPermission(
  profile: Pick<AdminProfile, "permissions"> | null | undefined,
  permission: AdminPermission,
): boolean {
  return Boolean(profile?.permissions.includes(permission));
}

export async function loadAdminProfile(): Promise<AdminProfile> {
  const response = await apiFetch<{ success: boolean; admin: AdminProfile }>("/auth/me", {
    headers: authHeaders(),
  });
  storeAdminProfile(response.admin);
  return response.admin;
}