/**
 * Safe JSON reader.
 *
 * Hosting/proxy kabhi HTML error page (`<html>…`) ya khaali body bhej deta hai; us par
 * `response.json()` crash karta hai (`Unexpected token '<'`). Har fetch isi se parse hota hai
 * taaki customer ko friendly message mile, white screen ya console error nahi.
 */
export type JsonResult<T> = { data: T | null; error: string | null };

function statusMessage(status: number): string {
  if (status === 401 || status === 403) return "Your session has expired — please refresh the page and try again.";
  if (status === 404) return "This service is not available right now — please try again in a little while.";
  if (status === 429) return "Too many requests — please try again in a minute.";
  // R41 (owner): customer ko "server problem" jaisi andar ki baat mat dikhao —
  // friendly line + WhatsApp raasta. Asli problem /api/sheet-health par owner dekhta hai.
  if (status >= 500) return "This could not be completed right now — please try again in a little while, or send your order to us on WhatsApp and our team will confirm it right away.";
  return "The request could not be completed — please try again.";
}

export async function readJson<T>(response: Response): Promise<JsonResult<T>> {
  let text = "";
  try {
    text = await response.text();
  } catch {
    return { data: null, error: "We could not read the reply. Please check your internet connection and try again." };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { data: null, error: response.ok ? null : statusMessage(response.status) };
  }
  if (trimmed.startsWith("<")) {
    return {
      data: null,
      error: response.ok
        ? "The reply was not correct — please refresh the page or send your order to us on WhatsApp."
        : statusMessage(response.status),
    };
  }

  try {
    return { data: JSON.parse(trimmed) as T, error: null };
  } catch {
    return { data: null, error: "We could not understand the reply — please try again." };
  }
}

/** POST helper: network fail + HTML page + timeout, sab par saaf message. */
export async function postJson<T>(
  url: string,
  body: unknown,
  init?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<JsonResult<T> & { status: number }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(init?.timeoutMs ?? 30_000),
    });
    const result = await readJson<T>(response);
    return { ...result, status: response.status };
  } catch (error) {
    const name = (error as Error)?.name;
    return {
      data: null,
      status: 0,
      error:
        name === "TimeoutError" || name === "AbortError"
          ? "Your order could not be completed right now (timeout). Please send your order to us on WhatsApp — we will confirm it right away."
          : "Network error — please check your internet connection, or send your order to us on WhatsApp.",
    };
  }
}
