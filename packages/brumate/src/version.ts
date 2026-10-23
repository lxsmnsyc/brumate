import { readFileSync } from 'node:fs';

/** The version of brumate, which the devtools show. `package.json` is next to `src` and `dist`. */
export const BRUMATE_VERSION: string = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;
