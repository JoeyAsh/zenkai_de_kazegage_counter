const AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";

/** Only needed to let Twitch identify the user; the server checks mod status itself. */
const SCOPE = "user:read:moderated_channels";

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "token",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Parses the URL fragment Twitch redirects back with.
 * null = no auth callback present; { error } = failed or untrusted callback.
 */
export function parseAuthCallback(
  hash: string,
  expectedState: string | null,
): { token: string } | { error: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const error = params.get("error");
  if (error) return { error: params.get("error_description") || error };
  const token = params.get("access_token");
  if (!token) return null;
  const state = params.get("state");
  if (!expectedState || state !== expectedState) return { error: "invalid_state" };
  return { token };
}
