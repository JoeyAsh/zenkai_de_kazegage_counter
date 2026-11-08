import { describe, expect, it } from "vitest";
import {
  isModeratorOf,
  resolveUserId,
  validateToken,
  type FetchFn,
  type TwitchIdentity,
} from "../supabase/functions/_shared/twitch.ts";

interface Call {
  url: URL;
  headers: Headers;
}

function fakeFetch(respond: (call: Call) => { status?: number; body?: unknown }) {
  const calls: Call[] = [];
  const fn: FetchFn = (input, init) => {
    const call = { url: new URL(String(input)), headers: new Headers(init?.headers) };
    calls.push(call);
    const { status = 200, body = {} } = respond(call);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  };
  return { fn, calls };
}

const identity: TwitchIdentity = {
  userId: "100",
  login: "modguy",
  clientId: "client-abc",
  scopes: ["user:read:moderated_channels"],
};

describe("validateToken", () => {
  it("returns the identity on 200 and sends an OAuth header", async () => {
    const { fn, calls } = fakeFetch(() => ({
      body: {
        client_id: "client-abc",
        login: "modguy",
        user_id: "100",
        scopes: ["user:read:moderated_channels"],
        expires_in: 5520,
      },
    }));
    await expect(validateToken("tok", fn)).resolves.toEqual(identity);
    expect(calls[0]!.url.href).toBe("https://id.twitch.tv/oauth2/validate");
    expect(calls[0]!.headers.get("Authorization")).toBe("OAuth tok");
  });

  it("returns null on 401", async () => {
    const { fn } = fakeFetch(() => ({ status: 401, body: { status: 401 } }));
    await expect(validateToken("bad", fn)).resolves.toBeNull();
  });

  it("throws on network errors", async () => {
    const fn: FetchFn = () => Promise.reject(new TypeError("network down"));
    await expect(validateToken("tok", fn)).rejects.toThrow();
  });
});

describe("resolveUserId", () => {
  it("returns data[0].id and sends Bearer and Client-Id headers", async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { data: [{ id: "42", login: "presarioo" }] } }));
    await expect(resolveUserId("Presarioo", "tok", "client-abc", fn)).resolves.toBe("42");
    expect(calls[0]!.url.origin + calls[0]!.url.pathname).toBe("https://api.twitch.tv/helix/users");
    expect(calls[0]!.url.searchParams.get("login")).toBe("Presarioo");
    expect(calls[0]!.headers.get("Authorization")).toBe("Bearer tok");
    expect(calls[0]!.headers.get("Client-Id")).toBe("client-abc");
  });

  it("returns null for empty data", async () => {
    const { fn } = fakeFetch(() => ({ body: { data: [] } }));
    await expect(resolveUserId("nobody", "tok", "client-abc", fn)).resolves.toBeNull();
  });
});

describe("isModeratorOf", () => {
  it("returns true for the broadcaster without calling Helix", async () => {
    const { fn, calls } = fakeFetch(() => ({}));
    await expect(isModeratorOf("100", identity, "tok", fn)).resolves.toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("finds the channel on page 2", async () => {
    const { fn, calls } = fakeFetch(({ url }) =>
      url.searchParams.get("after") === "c1"
        ? { body: { data: [{ broadcaster_id: "42" }], pagination: {} } }
        : { body: { data: [{ broadcaster_id: "7" }], pagination: { cursor: "c1" } } },
    );
    await expect(isModeratorOf("42", identity, "tok", fn)).resolves.toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url.pathname).toBe("/helix/moderation/channels");
    expect(calls[0]!.url.searchParams.get("user_id")).toBe("100");
    expect(calls[0]!.url.searchParams.get("first")).toBe("100");
    expect(calls[0]!.headers.get("Authorization")).toBe("Bearer tok");
    expect(calls[0]!.headers.get("Client-Id")).toBe("client-abc");
  });

  it("returns false when moderating only other channels", async () => {
    const { fn } = fakeFetch(() => ({ body: { data: [{ broadcaster_id: "7" }], pagination: {} } }));
    await expect(isModeratorOf("42", identity, "tok", fn)).resolves.toBe(false);
  });

  it("returns false on Helix 401", async () => {
    const { fn } = fakeFetch(() => ({ status: 401, body: {} }));
    await expect(isModeratorOf("42", identity, "tok", fn)).resolves.toBe(false);
  });

  it("stops after 20 pages", async () => {
    const { fn, calls } = fakeFetch(() => ({
      body: { data: [{ broadcaster_id: "7" }], pagination: { cursor: "more" } },
    }));
    await expect(isModeratorOf("42", identity, "tok", fn)).resolves.toBe(false);
    expect(calls).toHaveLength(20);
  });
});
