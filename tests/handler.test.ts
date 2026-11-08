import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHandler,
  type ApplyArgs,
  type ApplyResult,
} from "../supabase/functions/counter-action/handler.ts";
import type { FetchFn } from "../supabase/functions/_shared/twitch.ts";
import type { ActionResponse, CounterRow } from "../supabase/functions/_shared/protocol.ts";

const ORIGIN = "http://localhost:5173";
const TOKEN = "secret-token-value-123";
const REQUEST_ID = "3f2b8c1e-6a4d-4e7b-9c1a-2d5e8f0a1b3c";

const row: CounterRow = {
  channel_id: "999",
  channel_login: "presarioo",
  session_count: 3,
  total_count: 10,
  last_action: "increment",
  last_actor_login: "modguy",
  updated_at: "2026-11-08T10:00:00Z",
};

interface World {
  clientId?: string;
  userId?: string;
  isMod?: boolean;
  validateStatus?: number;
}

function setup(world: World = {}, applyResult: ApplyResult = { row }) {
  const { clientId = "client-abc", userId = "100", isMod = true, validateStatus = 200 } = world;
  const urls: string[] = [];
  const fetchFn: FetchFn = (input) => {
    const url = new URL(String(input));
    urls.push(url.pathname);
    const json = (body: unknown, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (url.host === "id.twitch.tv") {
      return validateStatus === 200
        ? json({ user_id: userId, login: "modguy", client_id: clientId, scopes: [] })
        : json({}, validateStatus);
    }
    if (url.pathname === "/helix/users") return json({ data: [{ id: "999" }] });
    if (url.pathname === "/helix/moderation/channels") {
      return json({ data: isMod ? [{ broadcaster_id: "999" }] : [] });
    }
    return json({}, 404);
  };
  const apply = vi.fn<(args: ApplyArgs) => Promise<ApplyResult>>(() => Promise.resolve(applyResult));
  const handler = createHandler({
    clientId: "client-abc",
    channelLogin: "presarioo",
    allowedOrigins: [ORIGIN, "https://joeyash.github.io"],
    fetchFn,
    apply,
  });
  return { handler, apply, urls };
}

function post(body: unknown, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) {
  return new Request("https://fn.test/counter-action", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = { requestId: REQUEST_ID, action: { type: "increment" } };

async function json(res: Response): Promise<ActionResponse> {
  return (await res.json()) as ActionResponse;
}

afterEach(() => vi.restoreAllMocks());

describe("CORS and method", () => {
  it("answers preflight from an allowed origin with 204 and CORS headers", async () => {
    const { handler } = setup();
    const res = await handler(new Request("https://fn.test/", { method: "OPTIONS", headers: { origin: ORIGIN } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-headers")).toBe("authorization, content-type");
  });

  it("sends no ACAO header to a foreign origin", async () => {
    const { handler } = setup();
    const res = await handler(
      new Request("https://fn.test/", { method: "OPTIONS", headers: { origin: "https://evil.example" } }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects GET with 405", async () => {
    const { handler } = setup();
    const res = await handler(new Request("https://fn.test/", { method: "GET" }));
    expect(res.status).toBe(405);
  });
});

describe("authentication", () => {
  it("rejects a missing Authorization header with 401", async () => {
    const { handler, apply } = setup();
    const res = await handler(post(validBody, {}));
    expect(res.status).toBe(401);
    expect((await json(res)).ok).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });

  it("rejects a malformed Authorization header with 401", async () => {
    const { handler } = setup();
    expect((await handler(post(validBody, { authorization: "Basic abc" }))).status).toBe(401);
    expect((await handler(post(validBody, { authorization: "Bearer " }))).status).toBe(401);
  });

  it("rejects a token Twitch considers invalid with 401", async () => {
    const { handler, apply } = setup({ validateStatus: 401 });
    expect((await handler(post(validBody))).status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });

  it("rejects a token issued for a foreign client_id with 401", async () => {
    const { handler, apply } = setup({ clientId: "other-client" });
    expect((await handler(post(validBody))).status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });

  it("maps Twitch outages to 500 without details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { handler } = setup({ validateStatus: 503 });
    const res = await handler(post(validBody));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await json(res))).not.toContain("503");
  });
});

describe("authorization and validation", () => {
  it("rejects a non-moderator with 403", async () => {
    const { handler, apply } = setup({ isMod: false });
    const res = await handler(post(validBody));
    expect(res.status).toBe(403);
    expect(apply).not.toHaveBeenCalled();
  });

  it("rejects an invalid body with 400", async () => {
    const { handler, apply } = setup();
    const res = await handler(post({ requestId: "nope", action: { type: "increment" } }));
    expect(res.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });

  it("rejects non-JSON bodies with 400", async () => {
    const { handler, apply } = setup();
    const req = new Request("https://fn.test/", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: "not json",
    });
    expect((await handler(req)).status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("applying actions", () => {
  it("applies with ids from the token and resolved channel, never from the body", async () => {
    const { handler, apply } = setup();
    const body = { ...validBody, actorId: "666", actorLogin: "hacker", channelId: "1", channelLogin: "x" };
    const res = await handler(post(body));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const parsed = await json(res);
    expect(parsed.ok && parsed.state.session).toBe(3);
    expect(apply).toHaveBeenCalledWith({
      requestId: REQUEST_ID,
      channelId: "999",
      channelLogin: "presarioo",
      actorId: "100",
      actorLogin: "modguy",
      action: { type: "increment" },
    });
  });

  it("maps ZK409 to 409 with the last incrementer in the message", async () => {
    const { handler } = setup({}, { errorCode: "ZK409", detail: "modb" });
    const res = await handler(post(validBody));
    expect(res.status).toBe(409);
    const parsed = await json(res);
    expect(!parsed.ok && parsed.error).toBe("cooldown");
    expect(!parsed.ok && parsed.message).toContain("modb");
  });

  it("maps ZK429 to 429 and ZK400 to 400", async () => {
    expect((await setup({}, { errorCode: "ZK429" }).handler(post(validBody))).status).toBe(429);
    expect((await setup({}, { errorCode: "ZK400" }).handler(post(validBody))).status).toBe(400);
  });

  it("maps unknown errors to 500 without internal details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { handler } = setup({}, { errorCode: "XX000", detail: "relation secret_table missing" });
    const res = await handler(post(validBody));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await json(res));
    expect(text).not.toContain("secret_table");
    expect(text).not.toContain("XX000");
  });

  it("maps a throwing apply to 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { handler, apply } = setup();
    apply.mockRejectedValueOnce(new Error("db down"));
    expect((await handler(post(validBody))).status).toBe(500);
  });

  it("caches the channel id per handler instance", async () => {
    const { handler, urls } = setup();
    await handler(post(validBody));
    await handler(post({ ...validBody, requestId: "4f2b8c1e-6a4d-4e7b-9c1a-2d5e8f0a1b3c" }));
    expect(urls.filter((p) => p === "/helix/users")).toHaveLength(1);
  });
});

describe("logging", () => {
  it("never logs the token", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    await setup({ validateStatus: 503 }).handler(post(validBody));
    await setup({}, { errorCode: "XX000" }).handler(post(validBody));
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(TOKEN);
  });
});
