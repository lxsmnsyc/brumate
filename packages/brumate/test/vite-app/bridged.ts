import { bridge } from 'brumate/store';
import type { Bridge } from 'brumate/store';

export const counter: Bridge<{ value: number }, number> = bridge({
  create: (snapshot?: number) => ({ value: snapshot ?? 0 }),
  get: (source) => source.value,
  subscribe: () => () => {},
});
