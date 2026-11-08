import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { kazekageTheme } from "../theme.ts";
import { parseAuthCallback } from "./auth.ts";
import { ModApp } from "./ModApp.tsx";
import { clearOAuthState, loadOAuthState, loadToken, saveToken } from "./storage.ts";

// Handle the Twitch redirect once, before React renders (StrictMode would run an initializer twice).
function initAuth(): { token: string | null; error: string | null } {
  const result = parseAuthCallback(window.location.hash, loadOAuthState());
  if (result) {
    // Keep the token out of the address bar and the browser history.
    history.replaceState(null, "", window.location.pathname);
    clearOAuthState();
    if ("token" in result) {
      saveToken(result.token);
      return { token: result.token, error: null };
    }
    return { token: null, error: "Anmeldung fehlgeschlagen – bitte erneut versuchen" };
  }
  return { token: loadToken(), error: null };
}

const auth = initAuth();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={kazekageTheme}>
      <CssBaseline />
      <ModApp initialToken={auth.token} initialError={auth.error} />
    </ThemeProvider>
  </StrictMode>,
);
