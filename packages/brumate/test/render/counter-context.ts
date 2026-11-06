// The context of provide-functions.brm, which provides functions that change it.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export interface CounterValue {
  increment: () => void;
  add: (step: number) => void;
  reset(): void;
  steps: { double: { run: () => void } };
  actions: { run: () => void }[];
}

export const Counter: Context<CounterValue | undefined> = createContext<CounterValue | undefined>(
  'counter',
);
