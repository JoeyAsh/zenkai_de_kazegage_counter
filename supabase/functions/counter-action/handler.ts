// Request handler for the counter-action edge function. Web-standard APIs only
// (no Deno globals, no npm: imports) so it runs in Deno and in Vitest.

import {
  counterRowToState,
  parseActionRequest,
  type ActionError,
  type ActionResponse,
  type CounterAction,
  type CounterRow,
} from "../_shared/protocol.ts";
import { isModeratorOf, resolveUserId, validateToken, type FetchFn } from "../_shared/twitch.ts";

export interface ApplyArgs {
  requestId: string;
  channelId: string;
  channelLogin: string;
  actorId: string;
  actorLogin: string;
  action: CounterAction;
}

export type ApplyResult = { row: CounterRow } | { errorCode: string; detail?: string };

export interface HandlerDeps {
  clientId: string;
  channelLogin: string;
  allowedOrigins: string[];
  fetchFn: FetchFn;
  apply(args: ApplyArgs): Promise<ApplyResult>;
}

const STATUS: Record<ActionError, number> = {
  unauthorized: 401,
  forbidden: 403,
  bad_request: 400,
  cooldown: 409,
  rate_limited: 429,
  internal: 500,
};

const MESSAGES: Record<ActionError, string> = {
  unauthorized: "Nicht angemeldet oder Anmeldung abgelaufen.",
  forbidden: "Nur Broadcaster und Moderatoren dürfen zählen.",
  bad_request: "Ungültige Anfrage.",
  cooldown: "Schon gezählt.",
  rate_limited: "Zu viele Aktionen, bitte kurz warten.",
  internal: "Interner Fehler, bitte später erneut versuchen.",
};

const SQL_ERRORS: Record<string, ActionError> = {
  ZK400: "bad_request",
  ZK409: "cooldown",
  ZK429: "rate_limited",
};

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  let channelId: string | null = null;

  async function getChannelId(token: string): Promise<string | null> {
    if (channelId) return channelId;
    const id = await resolveUserId(deps.channelLogin, token, deps.clientId, deps.fetchFn);
    if (id) channelId = id;
    return id;
  }

  return async (req) => {
    const origin = req.headers.get("origin");
    const headers: Record<string, string> = { "content-type": "application/json", vary: "Origin" };
    if (origin && deps.allowedOrigins.includes(origin)) {
      headers["access-control-allow-origin"] = origin;
      headers["access-control-allow-headers"] = "authorization, content-type";
      headers["access-control-allow-methods"] = "POST, OPTIONS";
      headers["access-control-max-age"] = "86400";
    }

    const fail = (error: ActionError, message = MESSAGES[error]): Response => {
      const body: ActionResponse = { ok: false, error, message };
      return new Response(JSON.stringify(body), { status: STATUS[error], headers });
    };

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "bad_request", message: "Methode nicht erlaubt." }), {
        status: 405,
        headers: { ...headers, allow: "POST, OPTIONS" },
      });
    }

    try {
      const match = /^Bearer\s+(\S+)$/.exec(req.headers.get("authorization") ?? "");
      const token = match?.[1];
      if (!token) return fail("unauthorized");

      const identity = await validateToken(token, deps.fetchFn);
      if (!identity || identity.clientId !== deps.clientId) return fail("unauthorized");

      const broadcasterId = await getChannelId(token);
      if (!broadcasterId) {
        console.error("counter-action: broadcaster login could not be resolved");
        return fail("internal");
      }
      if (!(await isModeratorOf(broadcasterId, identity, token, deps.fetchFn))) return fail("forbidden");

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return fail("bad_request");
      }
      const parsed = parseActionRequest(raw);
      if (!parsed) return fail("bad_request");

      const result = await deps.apply({
        requestId: parsed.requestId,
        channelId: broadcasterId,
        channelLogin: deps.channelLogin,
        actorId: identity.userId,
        actorLogin: identity.login,
        action: parsed.action,
      });

      if ("row" in result) {
        const body: ActionResponse = { ok: true, state: counterRowToState(result.row) };
        return new Response(JSON.stringify(body), { status: 200, headers });
      }

      const error = SQL_ERRORS[result.errorCode];
      if (!error) {
        console.error(`counter-action: unexpected database error code ${result.errorCode}`);
        return fail("internal");
      }
      if (error === "cooldown") {
        return fail(error, `Schon gezählt von ${result.detail ?? "jemand anderem"}`);
      }
      return fail(error);
    } catch (err) {
      console.error("counter-action: unhandled error", err instanceof Error ? err.message : "unknown");
      return fail("internal");
    }
  };
}
