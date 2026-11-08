// Shared between the web frontend and the Deno edge function. Web-standard TS only, no imports.

export type CounterAction =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "set_session"; value: number }
  | { type: "reset_session" };

export interface ActionRequest {
  requestId: string;
  action: CounterAction;
}

export interface CounterState {
  channelId: string;
  channelLogin: string;
  session: number;
  total: number;
  lastAction: CounterAction["type"] | null;
  lastActorLogin: string | null;
  updatedAt: string;
}

export type ActionError =
  | "unauthorized"
  | "forbidden"
  | "bad_request"
  | "rate_limited"
  | "cooldown"
  | "internal";

export type ActionResponse =
  | { ok: true; state: CounterState }
  | { ok: false; error: ActionError; message: string };

export const MAX_SESSION_VALUE = 1_000_000;

export interface CounterRow {
  channel_id: string;
  channel_login: string;
  session_count: number;
  total_count: number;
  last_action: string | null;
  last_actor_login: string | null;
  updated_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseAction(raw: unknown): CounterAction | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const action = raw as Record<string, unknown>;
  switch (action.type) {
    case "increment":
    case "decrement":
    case "reset_session":
      return { type: action.type };
    case "set_session": {
      const value = action.value;
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > MAX_SESSION_VALUE
      ) {
        return null;
      }
      return { type: "set_session", value };
    }
    default:
      return null;
  }
}

export function parseActionRequest(body: unknown): ActionRequest | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { requestId, action } = body as Record<string, unknown>;
  if (typeof requestId !== "string" || !UUID_RE.test(requestId)) return null;
  const parsed = parseAction(action);
  return parsed ? { requestId, action: parsed } : null;
}

const ACTION_TYPES: ReadonlySet<string> = new Set([
  "increment",
  "decrement",
  "set_session",
  "reset_session",
]);

export function counterRowToState(row: CounterRow): CounterState {
  return {
    channelId: row.channel_id,
    channelLogin: row.channel_login,
    session: row.session_count,
    total: Number(row.total_count),
    lastAction:
      row.last_action !== null && ACTION_TYPES.has(row.last_action)
        ? (row.last_action as CounterAction["type"])
        : null,
    lastActorLogin: row.last_actor_login,
    updatedAt: row.updated_at,
  };
}
