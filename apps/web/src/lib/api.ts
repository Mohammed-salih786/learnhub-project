import { cookies } from "next/headers";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieHeader = cookies().toString();
  const headers = new Headers(init.headers);
  if (cookieHeader) headers.set("cookie", cookieHeader);
  headers.set("accept", "application/json");

  const response = await fetch(`/api/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers,
    cache: "no-store"
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `API request failed (${response.status})`);
  }
  return payload as T;
}
