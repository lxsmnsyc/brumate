// Finds out whether the client of an app sends spans to `onTrace`, so the build can leave the
// code out when it does not. The entry is a file that imports the loader and names `onTrace`.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SCRIPT = /\.[cm]?[jt]sx?$/;
const LOADER = /['"]brumate\/(?:static-)?loader['"]/;
const SERVER = /['"]brumate\/server['"]/;
const SKIPPED = new Set(['node_modules', 'dist', '.git', '.output']);

export interface TraceScan {
  /** True when a script passes `onTrace` to the loader. */
  on: boolean;
  /** Scripts that name `onTrace` without the loader or the server, which a build cannot place. */
  hints: string[];
}

/** Reads the scripts under `dir`. `skip` is a file to leave out, such as the middleware of the server. */
export async function usesBrowserTrace(dir: string, skip?: string): Promise<TraceScan> {
  const result: TraceScan = { on: false, hints: [] };
  await walk(dir, skip === undefined ? undefined : path.normalize(skip), result);
  return result;
}

async function walk(dir: string, skip: string | undefined, result: TraceScan): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name)) {
        // oxlint-disable-next-line no-await-in-loop -- The result is shared, and the order does not matter.
        await walk(file, skip, result);
      }
    } else if (SCRIPT.test(entry.name) && path.normalize(file) !== skip) {
      // oxlint-disable-next-line no-await-in-loop -- The files are read one by one.
      const code = await readFile(file, 'utf8');
      if (!/\bonTrace\b/.test(code)) {
        continue;
      }
      if (LOADER.test(code)) {
        result.on = true;
      } else if (!SERVER.test(code)) {
        result.hints.push(path.basename(file));
      }
    }
  }
}
