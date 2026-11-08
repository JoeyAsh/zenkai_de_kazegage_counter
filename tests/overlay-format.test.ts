import { describe, expect, it } from "vitest";
import { diffKind, formatCount } from "../web/src/overlay/format.ts";
import type { CounterState } from "../supabase/functions/_shared/protocol.ts";

function state(session: number, total: number): CounterState {
  return {
    channelId: "1",
    channelLogin: "presarioo",
    session,
    total,
    lastAction: null,
    lastActorLogin: null,
    updatedAt: "2026-11-08T00:00:00Z",
  };
}

describe("formatCount", () => {
  it("formats zero", () => {
    expect(formatCount(0)).toBe("0");
  });

  it("uses a dot as German thousands separator", () => {
    expect(formatCount(1234)).toBe("1.234");
    expect(formatCount(1234567)).toBe("1.234.567");
  });
});

describe("diffKind", () => {
  it("is none for the first state", () => {
    expect(diffKind(null, state(3, 10))).toBe("none");
  });

  it("is up when the session grows", () => {
    expect(diffKind(state(3, 10), state(4, 11))).toBe("up");
  });

  it("is down when the session shrinks with the total", () => {
    expect(diffKind(state(4, 11), state(3, 10))).toBe("down");
  });

  it("is reset when the session drops to 0 and the total stays", () => {
    expect(diffKind(state(7, 20), state(0, 20))).toBe("reset");
  });

  it("is none when nothing changed", () => {
    expect(diffKind(state(7, 20), state(7, 20))).toBe("none");
  });
});
