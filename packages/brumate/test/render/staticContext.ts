import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export type Words = { lang: string; table: Record<string, string> };

/** Words by language. The provider of a static context sends none of them to the browser. */
export const StaticWords: Context<Words> = createContext<Words>('staticcontext.words', {
  lang: 'en',
  table: { en: 'Hello' },
});

/** A context that a page sets from a signal, so it stays live. */
export const StaticMood: Context<string> = createContext<string>('staticcontext.mood', 'calm');
