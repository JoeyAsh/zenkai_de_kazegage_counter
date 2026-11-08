import { createClient } from "@supabase/supabase-js";
import {
  counterRowToState,
  type CounterRow,
  type CounterState,
} from "../../supabase/functions/_shared/protocol.ts";

/** Minimal slice of the Supabase client so tests can use a fake. */
export interface CounterSource {
  fetchByLogin(login: string): Promise<CounterRow | null>;
  onRowChange(login: string, cb: (row: CounterRow) => void, onStatus: (s: string) => void): () => void;
}

export function createSupabaseSource(url: string, key: string): CounterSource {
  const client = createClient(url, key);
  return {
    async fetchByLogin(login) {
      const { data, error } = await client.from("counter").select("*").eq("channel_login", login).maybeSingle();
      if (error) throw error;
      return data as CounterRow | null;
    },
    onRowChange(login, cb, onStatus) {
      const channel = client
        .channel(`counter:${login}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "counter", filter: `channel_login=eq.${login}` },
          (payload) => {
            if (payload.eventType !== "DELETE") cb(payload.new as CounterRow);
          },
        )
        .subscribe((status) => onStatus(status));
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}

/**
 * Emits the current counter state, then live updates. Refetches on every (re)subscribe so
 * changes missed during a disconnect are picked up. A failed fetch keeps the last value.
 * Emits null when the channel has no row yet.
 */
export function watchCounter(
  source: CounterSource,
  login: string,
  onState: (s: CounterState | null) => void,
): () => void {
  let stopped = false;
  let requestSeq = 0;
  let lastAppliedAt: number | null = null;

  // Apply a row unless it is older than what is already shown (equal timestamps are fine).
  const apply = (row: CounterRow) => {
    const at = Date.parse(row.updated_at);
    if (lastAppliedAt !== null && at < lastAppliedAt) return;
    lastAppliedAt = at;
    onState(counterRowToState(row));
  };

  const refresh = async () => {
    const seq = ++requestSeq;
    try {
      const row = await source.fetchByLogin(login);
      if (stopped || seq !== requestSeq) return; // superseded by a newer fetch
      if (row) apply(row);
      else if (lastAppliedAt === null) onState(null);
    } catch (err) {
      // keep the last known value; the next SUBSCRIBED triggers another attempt
      console.warn("Counter fetch failed:", err instanceof Error ? err.message : "unknown error");
    }
  };

  const unsubscribe = source.onRowChange(
    login,
    (row) => {
      if (!stopped) apply(row);
    },
    (status) => {
      if (!stopped && status === "SUBSCRIBED") void refresh();
    },
  );
  void refresh();

  return () => {
    stopped = true;
    unsubscribe();
  };
}
