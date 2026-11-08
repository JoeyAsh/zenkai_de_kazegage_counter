import { describe, expect, it, vi } from "vitest";
import { watchCounter, type CounterSource } from "../web/src/counter-client.ts";
import type { CounterRow } from "../supabase/functions/_shared/protocol.ts";

const row = (session: number, total: number): CounterRow => ({
  channel_id: "1",
  channel_login: "presarioo",
  session_count: session,
  total_count: total,
  last_action: "increment",
  last_actor_login: "mod1",
  updated_at: "2026-01-01T00:00:00Z",
});

function fakeSource(fetchImpl: () => Promise<CounterRow | null>) {
  let onChange: (r: CounterRow) => void = () => {};
  let onStatus: (s: string) => void = () => {};
  const unsubscribe = vi.fn();
  const fetchByLogin = vi.fn(fetchImpl);
  const source: CounterSource = {
    fetchByLogin,
    onRowChange(_login, cb, st) {
      onChange = cb;
      onStatus = st;
      return unsubscribe;
    },
  };
  return { source, fetchByLogin, unsubscribe, emit: (r: CounterRow) => onChange(r), status: (s: string) => onStatus(s) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("watchCounter", () => {
  it("fetches initially and maps the row to state", async () => {
    const f = fakeSource(async () => row(3, 10));
    const onState = vi.fn();
    watchCounter(f.source, "presarioo", onState);
    await flush();
    expect(f.fetchByLogin).toHaveBeenCalledWith("presarioo");
    expect(onState).toHaveBeenCalledWith(expect.objectContaining({ session: 3, total: 10, channelLogin: "presarioo" }));
  });

  it("reports null when no row exists yet", async () => {
    const f = fakeSource(async () => null);
    const onState = vi.fn();
    watchCounter(f.source, "presarioo", onState);
    await flush();
    expect(onState).toHaveBeenCalledWith(null);
  });

  it("emits new state on row change", async () => {
    const f = fakeSource(async () => null);
    const onState = vi.fn();
    watchCounter(f.source, "presarioo", onState);
    await flush();
    f.emit(row(1, 1));
    expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ session: 1, total: 1 }));
  });

  it("refetches on every SUBSCRIBED status, including reconnects", async () => {
    const f = fakeSource(async () => row(1, 1));
    watchCounter(f.source, "presarioo", vi.fn());
    await flush();
    expect(f.fetchByLogin).toHaveBeenCalledTimes(1);
    f.status("SUBSCRIBED");
    await flush();
    f.status("CHANNEL_ERROR");
    await flush();
    expect(f.fetchByLogin).toHaveBeenCalledTimes(2);
    f.status("SUBSCRIBED");
    await flush();
    expect(f.fetchByLogin).toHaveBeenCalledTimes(3);
  });

  it("keeps the last value when fetch fails and retries on next SUBSCRIBED", async () => {
    let fail = true;
    const f = fakeSource(async () => {
      if (fail) throw new Error("network");
      return row(5, 5);
    });
    const onState = vi.fn();
    watchCounter(f.source, "presarioo", onState);
    await flush();
    expect(onState).not.toHaveBeenCalled();
    fail = false;
    f.status("SUBSCRIBED");
    await flush();
    expect(onState).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledWith(expect.objectContaining({ session: 5 }));
  });

  it("stops after unsubscribe and ignores late results", async () => {
    let resolve: (r: CounterRow | null) => void = () => {};
    const f = fakeSource(() => new Promise((r) => (resolve = r)));
    const onState = vi.fn();
    const stop = watchCounter(f.source, "presarioo", onState);
    stop();
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
    resolve(row(1, 1));
    await flush();
    f.emit(row(2, 2));
    f.status("SUBSCRIBED");
    expect(onState).not.toHaveBeenCalled();
    expect(f.fetchByLogin).toHaveBeenCalledTimes(1);
  });
});
