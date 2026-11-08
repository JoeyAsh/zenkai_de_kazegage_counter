import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import type { CounterAction, CounterState } from "../../../supabase/functions/_shared/protocol.ts";
import { config } from "../config.ts";
import { createSupabaseSource } from "../counter-client.ts";
import { useCounter } from "../useCounter.ts";
import { sendAction } from "./api.ts";
import { buildAuthorizeUrl } from "./auth.ts";
import { ControlPanel } from "./ControlPanel.tsx";
import { LoginView } from "./LoginView.tsx";
import { errorMessage } from "./messages.ts";
import { clearToken, saveOAuthState } from "./storage.ts";

// Created once per page load; useCounter subscribes to it.
const source = createSupabaseSource(config.supabaseUrl, config.supabasePublishableKey);

function Panel({ token, onExpired, onLogout }: { token: string; onExpired(): void; onLogout(): void }) {
  const { state: live, loaded } = useCounter(source, config.channelLogin);
  const [fromResponse, setFromResponse] = useState<CounterState | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Show our own response right away unless the realtime row is already newer.
  const state = useMemo(() => {
    if (!fromResponse) return live;
    if (!live) return fromResponse;
    return Date.parse(fromResponse.updatedAt) > Date.parse(live.updatedAt) ? fromResponse : live;
  }, [live, fromResponse]);

  const onAction = useCallback(
    async (action: CounterAction) => {
      setBusy(true);
      setFeedback(null);
      const res = await sendAction(token, action, { functionUrl: config.functionUrl });
      setBusy(false);
      if (res.ok) {
        setFromResponse(res.state);
        return;
      }
      if (res.error === "unauthorized") {
        onExpired();
        return;
      }
      setFeedback(errorMessage(res));
    },
    [token, onExpired],
  );

  return <ControlPanel state={state} loaded={loaded} busy={busy} feedback={feedback} onAction={onAction} onLogout={onLogout} />;
}

export function ModApp({ initialToken, initialError }: { initialToken: string | null; initialError: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [message, setMessage] = useState(initialError);

  const login = () => {
    const oauthState = crypto.randomUUID();
    saveOAuthState(oauthState);
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.assign(buildAuthorizeUrl(config.twitchClientId, redirectUri, oauthState));
  };

  const expire = useCallback(() => {
    clearToken();
    setToken(null);
    setMessage(errorMessage({ ok: false, error: "unauthorized", message: "" }));
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setMessage(null);
  }, []);

  return (
    <Box sx={{ minHeight: "100dvh" }}>
      {token ? (
        <Panel token={token} onExpired={expire} onLogout={logout} />
      ) : (
        <LoginView message={message} onLogin={login} />
      )}
    </Box>
  );
}
