import type { ActionResponse, CounterAction } from "../../../supabase/functions/_shared/protocol.ts";

const INTERNAL: ActionResponse = {
  ok: false,
  error: "internal",
  message: "Verbindungsfehler – bitte erneut versuchen",
};

/**
 * Sends one counter action. A network failure or timeout is retried exactly once with the same requestId,
 * which the server treats idempotently, so a lost response cannot double-count.
 */
export async function sendAction(
  token: string,
  action: CounterAction,
  opts: { functionUrl: string; fetchFn?: typeof fetch; requestId?: string; timeoutMs?: number },
): Promise<ActionResponse> {
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const base = {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: opts.requestId ?? crypto.randomUUID(), action }),
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      // A fresh signal per attempt; a timeout counts as a network error.
      res = await fetchFn(opts.functionUrl, { ...base, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      continue; // network error: retry once
    }
    try {
      const parsed = (await res.json()) as ActionResponse;
      if (typeof parsed === "object" && parsed !== null && typeof parsed.ok === "boolean") return parsed;
    } catch {
      // fall through
    }
    return INTERNAL;
  }
  return INTERNAL;
}
