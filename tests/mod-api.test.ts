import { describe, expect, it, vi } from "vitest";
import { sendAction } from "../web/src/mod/api.ts";
import { errorMessage } from "../web/src/mod/messages.ts";

const opts = { functionUrl: "http://fn/counter-action" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("sendAction", () => {
  it("POSTs with bearer token and {requestId, action}", async () => {
    const state = { session: 1 };
    const fetchFn = vi.fn().mockResolvedValue(json(200, { ok: true, state }));
    const res = await sendAction("tok", { type: "increment" }, { ...opts, fetchFn, requestId: "rid" });
    expect(res).toEqual({ ok: true, state });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(opts.functionUrl);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ requestId: "rid", action: { type: "increment" } });
  });

  it.each([401, 403, 409, 429])("returns the error body for %i", async (status) => {
    const body = { ok: false, error: "cooldown", message: "m" };
    const fetchFn = vi.fn().mockResolvedValue(json(status, body));
    expect(await sendAction("t", { type: "increment" }, { ...opts, fetchFn })).toEqual(body);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries once with the same requestId after a network error", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("net"))
      .mockResolvedValueOnce(json(200, { ok: true, state: {} }));
    const res = await sendAction("t", { type: "increment" }, { ...opts, fetchFn });
    expect(res.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const ids = fetchFn.mock.calls.map((c) => JSON.parse(c[1].body).requestId);
    expect(ids[0]).toBe(ids[1]);
  });

  it("gives up with internal after a second network error", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("net"));
    const res = await sendAction("t", { type: "increment" }, { ...opts, fetchFn });
    expect(res).toMatchObject({ ok: false, error: "internal" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("treats an unparseable response body as internal error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("<html>", { status: 502 }));
    expect(await sendAction("t", { type: "increment" }, { ...opts, fetchFn })).toMatchObject({
      ok: false,
      error: "internal",
    });
  });
});

describe("errorMessage", () => {
  it("maps unauthorized", () => {
    expect(errorMessage({ ok: false, error: "unauthorized", message: "x" })).toBe(
      "Sitzung abgelaufen – bitte erneut anmelden",
    );
  });
  it("maps forbidden using the configured channel", () => {
    expect(errorMessage({ ok: false, error: "forbidden", message: "x" })).toBe(
      "Nur Mods von presarioo dürfen zählen",
    );
  });
  it("passes the server message for cooldown", () => {
    expect(errorMessage({ ok: false, error: "cooldown", message: "Schon gezählt von bob" })).toBe(
      "Schon gezählt von bob",
    );
  });
});
