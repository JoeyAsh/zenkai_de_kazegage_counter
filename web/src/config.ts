function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Set it in .env (see .env.example).`);
  }
  return value;
}

const supabaseUrl = required("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL);

export const config = {
  supabaseUrl,
  supabasePublishableKey: required("VITE_SUPABASE_PUBLISHABLE_KEY", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  twitchClientId: required("VITE_TWITCH_CLIENT_ID", import.meta.env.VITE_TWITCH_CLIENT_ID),
  channelLogin: required("VITE_TWITCH_CHANNEL", import.meta.env.VITE_TWITCH_CHANNEL).toLowerCase(),
  functionUrl: `${supabaseUrl}/functions/v1/counter-action`,
};
