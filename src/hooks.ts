/**
 * How React reaches the sdk. One provider at the root; components pull state with
 * `useStore(selector)` and call verbs through `useReader()` / `useAgent()`.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { useStore as useZustandStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Rabbithole, RabbitholeState } from "@/sdk";

export const RabbitholeContext = createContext<Rabbithole | null>(null);

export function useRabbithole(): Rabbithole {
  const rh = useContext(RabbitholeContext);
  if (!rh) throw new Error("RabbitholeContext missing — wrap the app in <RabbitholeContext.Provider>");
  return rh;
}

/** Select a slice of state. Re-renders only when the selected value changes. */
export function useStore<T>(selector: (s: RabbitholeState) => T): T {
  return useZustandStore(useRabbithole().store, selector);
}

/** Like useStore, for selectors that build a new object/array each time. */
export function useStoreShallow<T>(selector: (s: RabbitholeState) => T): T {
  return useZustandStore(useRabbithole().store, useShallow(selector));
}

export function useReader() {
  return useRabbithole().reader;
}

export function useAgent() {
  return useRabbithole().agent;
}

/** Re-render on an interval while `active` — for elapsed-time counters. */
export function useTicker(active: boolean, ms = 100): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return Date.now();
}

/** today · yesterday · 3 days ago · Aug 21 */
export function dateLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  const n = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(n) - startOf(d)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** avatar letter from the profile role */
export function initial(role: string): string {
  return (role.trim()[0] ?? "?").toUpperCase();
}

export function clockLabel(at: number): string {
  return new Date(at).toTimeString().slice(0, 8);
}
