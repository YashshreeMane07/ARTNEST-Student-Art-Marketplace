export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "API_ERROR") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL =
  configuredBase?.replace(/\/+$/, "") ||
  (typeof window !== "undefined" ? `${window.location.origin}/api-server/api` : "/api-server/api");

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError("Could not reach ARTNEST. Check the network and try again.", 0, "NETWORK_ERROR");
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");
  if (!response.ok) {
    throw new ApiError(
      typeof body === "object" && body && typeof body.message === "string"
        ? body.message
        : `Request failed (${response.status}).`,
      response.status,
      typeof body === "object" && body && typeof body.error === "string" ? body.error : "API_ERROR",
    );
  }
  return body as T;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}
