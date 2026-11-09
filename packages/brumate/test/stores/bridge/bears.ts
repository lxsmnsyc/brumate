import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { bridge } from 'brumate/store';
import type { Bridge, BridgedStore } from 'brumate/store';
import { createStore } from './zustand.ts';
import type { StoreApi } from './zustand.ts';

export interface Bears {
  bears: number;
  add: () => void;
}

/** Counts what the bridge does, so a test sees how often the browser makes the source. */
function count(name: string): void {
  const counts = ((globalThis as { bridgeCounts?: Record<string, number> }).bridgeCounts ??= {});
  counts[name] = (counts[name] ?? 0) + 1;
}

export const bearStore: Bridge<StoreApi<Bears>, { bears: number }> = bridge({
  create: (snapshot?: { bears: number }) => {
    count('create');
    return createStore<Bears>()((set) => ({
      bears: (globalThis as { bearsStart?: number }).bearsStart ?? snapshot?.bears ?? 0,
      add: () => set((state) => ({ bears: state.bears + 1 })),
    }));
  },
  get: (source) => ({ bears: source.getState().bears }),
  subscribe: (source, listener) => source.subscribe(listener),
  set: (source, value) => {
    count('set');
    source.setState(value);
  },
});

export const BearContext: Context<BridgedStore<StoreApi<Bears>, { bears: number }>> =
  createContext('bears');

/** A bridge without `set`. */
export const readBears: Bridge<StoreApi<Bears>, { bears: number }> = bridge({
  create: (snapshot?: { bears: number }) =>
    createStore<Bears>()((set) => ({
      bears: snapshot?.bears ?? 0,
      add: () => set((state) => ({ bears: state.bears + 1 })),
    })),
  get: (source) => ({ bears: source.getState().bears }),
  subscribe: (source, listener) => source.subscribe(listener),
});

/** A bridge whose data cannot be sent: it holds a function. */
export const badStore: Bridge<StoreApi<Bears>, { add: () => void }> = bridge({
  create: () => createStore<Bears>()((set) => ({ bears: 0, add: () => set({ bears: 1 }) })),
  get: (source) => ({ add: source.getState().add }),
  subscribe: (source, listener) => source.subscribe(listener),
});

export const BadContext: Context<BridgedStore<StoreApi<Bears>, { add: () => void }>> =
  createContext('bad');

export const NoSetContext: Context<BridgedStore<StoreApi<Bears>, { bears: number }>> =
  createContext('no-set');
