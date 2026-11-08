import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl, parseAuthCallback } from "../web/src/mod/auth.ts";

describe("buildAuthorizeUrl", () => {
  it("builds the Twitch implicit-grant URL", () => {
    const url = new URL(buildAuthorizeUrl("cid", "http://localhost:5173/mod.html", "st"));
    expect(url.origin + url.pathname).toBe("https://id.twitch.tv/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("token");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5173/mod.html");
    expect(url.searchParams.get("scope")).toBe("user:read:moderated_channels");
    expect(url.searchParams.get("state")).toBe("st");
  });
});

describe("parseAuthCallback", () => {
  it("returns the token when the state matches", () => {
    expect(parseAuthCallback("#access_token=x&state=s&token_type=bearer", "s")).toEqual({ token: "x" });
  });
  it("rejects a wrong or missing expected state", () => {
    expect(parseAuthCallback("#access_token=x&state=other", "s")).toHaveProperty("error");
    expect(parseAuthCallback("#access_token=x&state=s", null)).toHaveProperty("error");
  });
  it("reports an OAuth error", () => {
    expect(parseAuthCallback("#error=access_denied&state=s", "s")).toHaveProperty("error");
  });
  it("returns null for an empty hash", () => {
    expect(parseAuthCallback("", "s")).toBeNull();
    expect(parseAuthCallback("#", "s")).toBeNull();
  });
});
