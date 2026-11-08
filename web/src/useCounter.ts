import { useEffect, useState } from "react";
import type { CounterState } from "../../supabase/functions/_shared/protocol.ts";
import { watchCounter, type CounterSource } from "./counter-client.ts";

export function useCounter(source: CounterSource, login: string): { state: CounterState | null; loaded: boolean } {
  const [state, setState] = useState<CounterState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    return watchCounter(source, login, (s) => {
      setState(s);
      setLoaded(true);
    });
  }, [source, login]);

  return { state, loaded };
}
