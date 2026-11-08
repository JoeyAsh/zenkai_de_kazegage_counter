import type { CounterState } from "../../../supabase/functions/_shared/protocol.ts";

const numberFormat = new Intl.NumberFormat("de-DE", { useGrouping: true, maximumFractionDigits: 0 });

/** German number formatting with a dot as thousands separator, e.g. 1234 -> "1.234". */
export function formatCount(n: number): string {
  return numberFormat.format(n);
}

export type DiffKind = "up" | "down" | "reset" | "none";

/** Classifies a counter change so the overlay can pick a matching animation. */
export function diffKind(prev: CounterState | null, next: CounterState): DiffKind {
  if (prev === null) return "none";
  if (next.session === 0 && prev.session > 0 && next.total === prev.total) return "reset";
  if (next.session > prev.session || next.total > prev.total) return "up";
  if (next.session < prev.session || next.total < prev.total) return "down";
  return "none";
}
