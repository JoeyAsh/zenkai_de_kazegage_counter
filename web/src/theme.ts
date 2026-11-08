import { createTheme } from "@mui/material/styles";

// Palette: sand / ochre / terracotta, ink-indigo, wind-turquoise accent (see .claude/rules/design.md).
// Shared as raw tokens so pages can use them outside MUI palette slots (e.g. the overlay's ink panel).
export const tokens = {
  ink: "#16183a", // deep indigo ink, overlay panel ground
  inkSoft: "#2a2d5c",
  sand: "#f1e3c4",
  sandLight: "#fbf3df",
  ochre: "#e2ae55",
  terracotta: "#b5532f",
  wind: "#45c9bb", // wind turquoise accent
} as const;

// Font: "Noto Serif JP" (SIL OFL), loaded in the HTML pages via Google Fonts.
export const kazekageTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: tokens.terracotta, contrastText: "#fff8ec" },
    secondary: { main: "#2bb3a8" }, // wind turquoise (darker shade for light backgrounds)
    warning: { main: "#c58b2a" }, // ochre
    background: { default: tokens.sand, paper: "#f8eed6" },
    text: { primary: "#1d2142", secondary: "#4a4668" }, // ink / indigo
  },
  typography: {
    fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
  },
  shape: { borderRadius: 6 },
});
