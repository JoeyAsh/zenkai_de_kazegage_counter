import type { ActionResponse } from "../../../supabase/functions/_shared/protocol.ts";
import { config } from "../config.ts";

export function errorMessage(res: Extract<ActionResponse, { ok: false }>): string {
  switch (res.error) {
    case "unauthorized":
      return "Sitzung abgelaufen – bitte erneut anmelden";
    case "forbidden":
      return `Nur Mods von ${config.channelLogin} dürfen zählen`;
    default:
      return res.message; // server messages are already German and user-facing
  }
}
