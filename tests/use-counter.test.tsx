// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCounter } from "../web/src/useCounter.ts";
import type { CounterSource } from "../web/src/counter-client.ts";

describe("useCounter", () => {
  it("is loaded only after the first state and unsubscribes on unmount", async () => {
    let resolve: (v: null) => void = () => {};
    const unsubscribe = vi.fn();
    const source: CounterSource = {
      fetchByLogin: () => new Promise((r) => (resolve = r)),
      onRowChange: () => unsubscribe,
    };
    const { result, unmount } = renderHook(() => useCounter(source, "presarioo"));
    expect(result.current).toEqual({ state: null, loaded: false });
    await act(async () => resolve(null));
    expect(result.current).toEqual({ state: null, loaded: true });
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
