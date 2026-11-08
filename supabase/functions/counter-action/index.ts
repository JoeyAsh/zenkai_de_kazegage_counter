// Deno entry point (excluded from tsc). All logic lives in handler.ts.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHandler, type ApplyArgs, type ApplyResult } from "./handler.ts";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function readSecretKey(): string {
  const json = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (json) {
    try {
      const key = (JSON.parse(json) as Record<string, unknown>).default;
      if (typeof key === "string" && key) return key;
    } catch {
      // fall through to the legacy key
    }
  }
  // Local CLI may only provide the legacy service role key.
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(requireEnv("SUPABASE_URL"), readSecretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function apply(args: ApplyArgs): Promise<ApplyResult> {
  const { data, error } = await supabase.rpc("apply_counter_action", {
    p_request_id: args.requestId,
    p_channel_id: args.channelId,
    p_channel_login: args.channelLogin,
    p_actor_id: args.actorId,
    p_actor_login: args.actorLogin,
    p_action: args.action.type,
    p_value: args.action.type === "set_session" ? args.action.value : null,
  });
  if (error) return { errorCode: error.code, detail: error.details ?? undefined };
  return { row: data };
}

Deno.serve(
  createHandler({
    clientId: requireEnv("TWITCH_CLIENT_ID"),
    channelLogin: requireEnv("TWITCH_CHANNEL_LOGIN"),
    allowedOrigins: requireEnv("ALLOWED_ORIGINS")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    fetchFn: fetch,
    apply,
  }),
);
