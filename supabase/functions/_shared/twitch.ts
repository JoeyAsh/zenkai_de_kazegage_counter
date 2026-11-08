// Twitch client helpers. Web-standard APIs only (no Deno globals), so the same
// module runs in the Deno edge function and in Vitest. `fetch` is injected.

export type FetchFn = typeof fetch;

export interface TwitchIdentity {
  userId: string;
  login: string;
  clientId: string;
  scopes: string[];
}

const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";
const HELIX = "https://api.twitch.tv/helix";
const MAX_MODERATED_PAGES = 20;

function helixHeaders(token: string, clientId: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Client-Id": clientId };
}

/** Returns the identity for a valid token, `null` for an invalid one; throws on other failures. */
export async function validateToken(token: string, fetchFn: FetchFn): Promise<TwitchIdentity | null> {
  const res = await fetchFn(VALIDATE_URL, { headers: { Authorization: `OAuth ${token}` } });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Twitch validate failed with status ${res.status}`);
  const body = await res.json();
  if (typeof body?.user_id !== "string" || typeof body?.login !== "string" || typeof body?.client_id !== "string") {
    return null;
  }
  return {
    userId: body.user_id,
    login: body.login,
    clientId: body.client_id,
    scopes: Array.isArray(body.scopes) ? body.scopes.filter((s: unknown) => typeof s === "string") : [],
  };
}

/** Resolves a login name to a Twitch user id, or `null` if the user does not exist. */
export async function resolveUserId(
  login: string,
  token: string,
  clientId: string,
  fetchFn: FetchFn,
): Promise<string | null> {
  const url = new URL(`${HELIX}/users`);
  url.searchParams.set("login", login);
  const res = await fetchFn(url, { headers: helixHeaders(token, clientId) });
  if (!res.ok) throw new Error(`Twitch users lookup failed with status ${res.status}`);
  const body = await res.json();
  const id = body?.data?.[0]?.id;
  return typeof id === "string" ? id : null;
}

/** True if the identity is the broadcaster or moderates the broadcaster's channel. */
export async function isModeratorOf(
  broadcasterId: string,
  identity: TwitchIdentity,
  token: string,
  fetchFn: FetchFn,
): Promise<boolean> {
  if (identity.userId === broadcasterId) return true;

  let cursor: string | undefined;
  for (let page = 0; page < MAX_MODERATED_PAGES; page++) {
    const url = new URL(`${HELIX}/moderation/channels`);
    url.searchParams.set("user_id", identity.userId);
    url.searchParams.set("first", "100");
    if (cursor) url.searchParams.set("after", cursor);

    const res = await fetchFn(url, { headers: helixHeaders(token, identity.clientId) });
    if (res.status === 401 || res.status === 403) return false;
    if (!res.ok) throw new Error(`Twitch moderated channels failed with status ${res.status}`);

    const body = await res.json();
    const data: unknown[] = Array.isArray(body?.data) ? body.data : [];
    if (data.some((c) => (c as { broadcaster_id?: unknown })?.broadcaster_id === broadcasterId)) return true;

    cursor = body?.pagination?.cursor;
    if (!cursor) return false;
  }
  return false;
}
