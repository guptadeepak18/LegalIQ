import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
export const API_BASE = `${BASE_URL}/api`;

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { headers: requestHeaders, ...requestOptions } = options ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders,
    },
    ...requestOptions,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? `API error ${res.status}`);
  }
  return data as T;
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("liq_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
