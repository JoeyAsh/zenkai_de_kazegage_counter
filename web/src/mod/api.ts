import type { ActionResponse, CounterAction } from "../../../supabase/functions/_shared/protocol.ts";

const INTERNAL: ActionResponse = {
  ok: false,
  error: "internal",
  message: "Verbindungsfehler – bitte erneut versuchen",
};

/**
 * Sends one counter action. A network failure is retried exactly once with the same requestId,
 * which the server treats idempotently, so a lost response cannot double-count.
 */
export async function sendAction(
  token: string,
  action: CounterAction,
  opts: { functionUrl: string; fetchFn?: typeof fetch; requestId?: string },
): Promise<ActionResponse> {
  const fetchFn = opts.fetchFn ?? fetch;
  const init = {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: opts.requestId ?? crypto.randomUUID(), action }),
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(opts.functionUrl, init);
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
