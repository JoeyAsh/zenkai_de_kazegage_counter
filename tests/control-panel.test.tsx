// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import { ControlPanel } from "../web/src/mod/ControlPanel.tsx";
import { kazekageTheme } from "../web/src/theme.ts";
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

function setup(over: Partial<Parameters<typeof ControlPanel>[0]> = {}) {
  const onAction = vi.fn();
  const onLogout = vi.fn();
  render(
    <ThemeProvider theme={kazekageTheme}>
      <ControlPanel state={state} busy={false} feedback={null} onAction={onAction} onLogout={onLogout} {...over} />
    </ThemeProvider>,
  );
  return { onAction, onLogout };
}

describe("ControlPanel", () => {
  it("shows live values and the status line", () => {
    setup();
    expect(screen.getByTestId("session-value").textContent).toBe("12");
    expect(screen.getByTestId("total-value").textContent).toBe("1.234");
    expect(screen.getByText(/somemod/)).toBeTruthy();
  });

  it("shows a placeholder and disables actions until loaded", () => {
    const { onAction } = setup({ state: null, loaded: false });
    expect(screen.getByTestId("session-value").textContent).toBe("…");
    expect(screen.getByTestId("total-value").textContent).toBe("…");
    expect(screen.getByText("Lade Zählerstand …")).toBeTruthy();
    expect(screen.queryByText("Noch keine Aktion")).toBeNull();
    const plusOne = screen.getByRole("button", { name: /\+1 Frage/ }) as HTMLButtonElement;
    expect(plusOne.disabled).toBe(true);
    fireEvent.click(plusOne);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("increments on click", () => {
    const { onAction } = setup();
    fireEvent.click(screen.getByRole("button", { name: "+1 Frage" }));
    expect(onAction).toHaveBeenCalledWith({ type: "increment" });
  });

  it("decrements on click", () => {
    const { onAction } = setup();
    fireEvent.click(screen.getByRole("button", { name: "−1 Korrektur" }));
    expect(onAction).toHaveBeenCalledWith({ type: "decrement" });
  });

  it("disables all action buttons while busy", () => {
    setup({ busy: true });
    for (const name of ["+1 Frage", "−1 Korrektur", "Session setzen", "Neue Session starten"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("asks for confirmation before resetting the session", async () => {
    const { onAction } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Neue Session starten" }));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Bestätigen" }));
    expect(onAction).toHaveBeenCalledWith({ type: "reset_session" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Bestätigen" })).toBeNull());
  });

  it("does not reset when the dialog is cancelled", async () => {
    const { onAction } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Neue Session starten" }));
    fireEvent.click(await screen.findByRole("button", { name: "Abbrechen" }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("validates the set-session input", () => {
    const { onAction } = setup();
    const input = screen.getByLabelText("Neuer Session-Stand") as HTMLInputElement;
    const button = screen.getByRole("button", { name: "Session setzen" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "-1" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "7" } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledWith({ type: "set_session", value: 7 });
  });

  it("shows feedback", () => {
    setup({ feedback: "Schon gezählt von bob" });
    expect(screen.getByText("Schon gezählt von bob")).toBeTruthy();
  });

  it("logs out", () => {
    const { onLogout } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Abmelden" }));
    expect(onLogout).toHaveBeenCalled();
  });
});
