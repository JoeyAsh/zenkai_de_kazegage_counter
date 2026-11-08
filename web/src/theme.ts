import { createTheme } from "@mui/material/styles";

// Palette: sand / ochre / terracotta, ink-indigo, wind-turquoise accent (see .claude/rules/design.md).
// Font: "Noto Serif JP" (SIL OFL), loaded in the HTML pages.
export const kazekageTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#b5532f", contrastText: "#fff8ec" }, // terracotta
    secondary: { main: "#2bb3a8" }, // wind turquoise
    warning: { main: "#c58b2a" }, // ochre
    background: { default: "#f1e3c4", paper: "#f8eed6" }, // sand
    text: { primary: "#1d2142", secondary: "#4a4668" }, // ink / indigo
  },
  typography: {
    fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
  },
  shape: { borderRadius: 6 },
});
