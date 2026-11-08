import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { tokens } from "../theme.ts";

export function LoginView({ message, onLogin }: { message: string | null; onLogin(): void }) {
  return (
    <Box sx={{ maxWidth: 480, mx: "auto", px: "16px", py: 6, textAlign: "center" }}>
      <Box
        aria-hidden
        sx={{
          width: 72,
          height: 72,
          mx: "auto",
          mb: 2,
          display: "grid",
          placeItems: "center",
          bgcolor: tokens.terracotta,
          color: tokens.sandLight,
          fontSize: 48,
          fontWeight: 900,
          borderRadius: "5px 9px 6px 10px",
          transform: "rotate(-4deg)",
        }}
      >
        風
      </Box>
      <Typography component="h1" variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Kazekage-Nerv-o-Meter
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Mod-Panel – melde dich mit Twitch an, um Fragen mitzuzählen.
      </Typography>
      {message && (
        <Alert severity="warning" sx={{ mb: 2, textAlign: "left" }}>
          {message}
        </Alert>
      )}
      <Button variant="contained" size="large" fullWidth onClick={onLogin} sx={{ py: 1.5, fontSize: 18 }}>
        Mit Twitch anmelden
      </Button>
    </Box>
  );
}
