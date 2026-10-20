import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export const Theme: Context<string> = createContext('theme', 'light');
