import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export const Level: Context<number> = createContext<number>('tpl-level', 0);
