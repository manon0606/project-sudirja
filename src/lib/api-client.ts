/**
 * Client-side fetch helper for backoffice APIs.
 * Unwraps the { ok, data } / { ok, error } envelope and throws ApiClientError
 * with the server's code/message so components can surface real errors.
 */

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, string> };
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Tidak dapat terhubung ke server.");
  }

  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError(response.status, "INTERNAL_ERROR", "Respons server tidak valid.");
  }

  if (!response.ok || !body.ok || body.data === undefined) {
    // Session expired → back to login (httpOnly cookie missing/invalid).
    if (response.status === 401 && typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
      window.location.href = "/backoffice-sudirja/login";
    }
    throw new ApiClientError(
      response.status,
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? "Terjadi kesalahan.",
      body.error?.details,
    );
  }
  return body.data;
}
