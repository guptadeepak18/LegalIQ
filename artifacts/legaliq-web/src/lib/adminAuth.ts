/** Read the signed-in admin email from the JWT already stored by admin login. */
export function getAdminEmailFromToken(): string {
  if (typeof window === "undefined") return "Admin";

  const token = localStorage.getItem("liq_admin_token");
  if (!token) return "Admin";

  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return "Admin";

    const normalizedPayload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalizedPayload)) as { email?: unknown };
    return typeof payload.email === "string" && payload.email.length > 0
      ? payload.email
      : "Admin";
  } catch {
    return "Admin";
  }
}