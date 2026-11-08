import { describe, expect, it } from "vitest";
import {
  counterRowToState,
  MAX_SESSION_VALUE,
  parseActionRequest,
  type CounterRow,
} from "../supabase/functions/_shared/protocol.ts";

const ID = "3f2b8c1e-9d4a-4b7e-8a1c-5e6f7a8b9c0d";

describe("parseActionRequest", () => {
  it("accepts a valid increment request unchanged", () => {
    const body = { requestId: ID, action: { type: "increment" } };
    expect(parseActionRequest(body)).toEqual(body);
  });

  it("accepts decrement and reset_session", () => {
    expect(parseActionRequest({ requestId: ID, action: { type: "decrement" } })).not.toBeNull();
    expect(parseActionRequest({ requestId: ID, action: { type: "reset_session" } })).not.toBeNull();
  });

  it("accepts set_session at the bounds", () => {
    for (const value of [0, MAX_SESSION_VALUE]) {
      const body = { requestId: ID, action: { type: "set_session", value } };
      expect(parseActionRequest(body)).toEqual(body);
    }
  });

  it("accepts an upper-case uuid", () => {
    const body = { requestId: ID.toUpperCase(), action: { type: "increment" } };
    expect(parseActionRequest(body)).not.toBeNull();
  });

  it("rejects missing or invalid requestId", () => {
    expect(parseActionRequest({ action: { type: "increment" } })).toBeNull();
    expect(parseActionRequest({ requestId: "abc", action: { type: "increment" } })).toBeNull();
  });

  it("rejects unknown action types", () => {
    expect(parseActionRequest({ requestId: ID, action: { type: "reset_total" } })).toBeNull();
    expect(parseActionRequest({ requestId: ID })).toBeNull();
  });

  it("rejects invalid set_session values", () => {
    for (const value of [-1, 1_000_001, 1.5, "5", undefined]) {
      expect(
        parseActionRequest({ requestId: ID, action: { type: "set_session", value } }),
      ).toBeNull();
    }
  });

  it("rejects non-object bodies", () => {
    expect(parseActionRequest(null)).toBeNull();
    expect(parseActionRequest([])).toBeNull();
    expect(parseActionRequest("increment")).toBeNull();
  });
});

describe("counterRowToState", () => {
  it("maps all fields and converts total_count with Number()", () => {
    const row = {
      channel_id: "123",
      channel_login: "presarioo",
      session_count: 4,
      total_count: "9007" as unknown as number,
      last_action: "increment",
      last_actor_login: "somemod",
      updated_at: "2026-11-08T10:00:00Z",
    } satisfies CounterRow;
    expect(counterRowToState(row)).toEqual({
      channelId: "123",
      channelLogin: "presarioo",
      session: 4,
      total: 9007,
      lastAction: "increment",
      lastActorLogin: "somemod",
      updatedAt: "2026-11-08T10:00:00Z",
    });
  });

  it("maps null last_action and actor to null", () => {
    const state = counterRowToState({
      channel_id: "1",
      channel_login: "c",
      session_count: 0,
      total_count: 0,
      last_action: null,
      last_actor_login: null,
      updated_at: "x",
    });
    expect(state.lastAction).toBeNull();
    expect(state.lastActorLogin).toBeNull();
  });
});
