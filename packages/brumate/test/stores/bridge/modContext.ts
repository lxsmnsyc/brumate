import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { BridgedStore } from 'brumate/store';
import type { StoreApi } from './zustand.ts';

export type ModBears = { bears: number; add: () => void };

export const ModContext: Context<BridgedStore<StoreApi<ModBears>, { bears: number }>> =
  createContext('mod-bears');
