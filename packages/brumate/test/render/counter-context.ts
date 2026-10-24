// The context of provide-functions.brm, which provides a count and functions that change it.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export interface CounterValue {
  count: number;
  increment: () => void;
  add: (step: number) => void;
  reset(): void;
  steps: { double: { run: () => void } };
}

export const Counter: Context<CounterValue | undefined> = createContext<CounterValue | undefined>(
  'counter',
  undefined,
);
