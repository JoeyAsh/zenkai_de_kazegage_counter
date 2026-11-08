import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider } from "@mui/material/styles";
import { config } from "../config.ts";
import { createSupabaseSource } from "../counter-client.ts";
import { kazekageTheme } from "../theme.ts";
import { useCounter } from "../useCounter.ts";
import { Overlay } from "./Overlay.tsx";

// Created once per page load; useCounter subscribes to it.
const source = createSupabaseSource(config.supabaseUrl, config.supabasePublishableKey);

function App() {
  const { state } = useCounter(source, config.channelLogin);
  return <Overlay state={state} />;
}

// OBS browser source: the page itself must stay fully transparent.
const transparentPage = {
  "html, body, #root": { background: "transparent", backgroundColor: "transparent", margin: 0, overflow: "hidden" },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={kazekageTheme}>
      <CssBaseline />
      <GlobalStyles styles={transparentPage} />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
