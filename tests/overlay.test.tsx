// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Overlay } from "../web/src/overlay/Overlay.tsx";
import type { CounterState } from "../supabase/functions/_shared/protocol.ts";

const state: CounterState = {
  channelId: "1",
  channelLogin: "presarioo",
  session: 12,
  total: 1234,
  lastAction: "increment",
  lastActorLogin: "somemod",
  updatedAt: "2026-11-08T00:00:00Z",
};

afterEach(cleanup);

describe("Overlay", () => {
  it("shows 0 for both values without state", () => {
    render(<Overlay state={null} />);
    expect(screen.getByTestId("session-value").textContent).toBe("0");
    expect(screen.getByTestId("total-value").textContent).toBe("0");
  });

  it("shows the formatted values and the fixed labels", () => {
    render(<Overlay state={state} />);
    expect(screen.getByTestId("session-value").textContent).toBe("12");
    expect(screen.getByTestId("total-value").textContent).toBe("1.234");
    expect(screen.getByText("Fragen an den Kazekage")).toBeTruthy();
    expect(screen.getByText("Dieser Stream")).toBeTruthy();
    expect(screen.getByText("Insgesamt")).toBeTruthy();
  });
});
