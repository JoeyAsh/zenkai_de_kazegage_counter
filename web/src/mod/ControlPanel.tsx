import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  MAX_SESSION_VALUE,
  type CounterAction,
  type CounterState,
} from "../../../supabase/functions/_shared/protocol.ts";
import { formatCount } from "../overlay/format.ts";
import { tokens } from "../theme.ts";

const ACTION_LABELS: Record<CounterAction["type"], string> = {
  increment: "+1",
  decrement: "−1",
  set_session: "Session gesetzt",
  reset_session: "Neue Session",
};

function parseSessionInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_SESSION_VALUE ? value : null;
}

interface Props {
  state: CounterState | null;
  busy: boolean;
  feedback: string | null;
  onAction(a: CounterAction): void;
  onLogout(): void;
}

export function ControlPanel({ state, busy, feedback, onAction, onLogout }: Props) {
  const [input, setInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const value = parseSessionInput(input);

  return (
    <Box sx={{ maxWidth: 480, mx: "auto", px: "16px", py: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography component="h1" variant="h6" sx={{ fontWeight: 700 }}>
          Kazekage-Nerv-o-Meter
        </Typography>
        <Button size="small" color="inherit" onClick={onLogout}>
          Abmelden
        </Button>
      </Box>

      <Box
        sx={{
          p: 2,
          borderRadius: 1,
          color: tokens.sand,
          background: `linear-gradient(100deg, ${tokens.ink} 0%, ${tokens.inkSoft} 100%)`,
          boxShadow: `inset 0 2px 0 ${tokens.ochre}99`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <Typography>Dieser Stream</Typography>
          <Typography
            data-testid="session-value"
            sx={{
              fontSize: 56,
              fontWeight: 900,
              lineHeight: 1,
              color: tokens.sandLight,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCount(state?.session ?? 0)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mt: 0.5 }}>
          <Typography>Insgesamt</Typography>
          <Typography
            data-testid="total-value"
            sx={{ fontSize: 26, fontWeight: 700, color: tokens.ochre, fontVariantNumeric: "tabular-nums" }}
          >
            {formatCount(state?.total ?? 0)}
          </Typography>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ minHeight: "1.5em" }}>
        {state?.lastAction && state.lastActorLogin
          ? `Zuletzt: ${ACTION_LABELS[state.lastAction]} von ${state.lastActorLogin}`
          : "Noch keine Aktion"}
      </Typography>

      {feedback && <Alert severity="warning">{feedback}</Alert>}

      <Button
        variant="contained"
        disabled={busy}
        onClick={() => onAction({ type: "increment" })}
        sx={{ minHeight: 96, fontSize: 28, fontWeight: 900 }}
      >
        +1 Frage
      </Button>

      <Button
        variant="outlined"
        color="inherit"
        disabled={busy}
        onClick={() => onAction({ type: "decrement" })}
        sx={{ minHeight: 48 }}
      >
        −1 Korrektur
      </Button>

      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          label="Neuer Session-Stand"
          size="small"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <Button
          variant="outlined"
          color="secondary"
          disabled={busy || value === null}
          onClick={() => value !== null && onAction({ type: "set_session", value })}
        >
          Session setzen
        </Button>
      </Box>

      <Button
        variant="outlined"
        color="warning"
        disabled={busy}
        onClick={() => setConfirmOpen(true)}
        sx={{ minHeight: 48 }}
      >
        Neue Session starten
      </Button>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Neue Session starten?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Der Session-Zähler wird auf 0 gesetzt. Der Gesamtwert bleibt unverändert.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmOpen(false)}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirmOpen(false);
              onAction({ type: "reset_session" });
            }}
          >
            Bestätigen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
