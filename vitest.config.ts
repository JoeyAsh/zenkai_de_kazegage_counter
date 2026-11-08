import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      VITE_TWITCH_CLIENT_ID: "test-client-id",
      VITE_TWITCH_CHANNEL: "presarioo",
    },
  },
});
