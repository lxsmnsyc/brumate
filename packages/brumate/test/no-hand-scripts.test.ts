import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const repo = fileURLToPath(new URL('../../..', import.meta.url));

/** Folders of the repository that an app never writes the Vite client tag in. */
const ROOTS = ['examples', 'website/docs', 'benchmarks', 'website/scripts'];
/** Folders that hold no source, and the benchmark that is pinned to brumate 0.3.0. */
const SKIPPED = new Set(['node_modules', 'dist', '.output', '.vite', 'brumate-0.3']);
function listFiles(directory: string, found: string[]): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) {
      continue;
    }
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      listFiles(file, found);
    } else {
      found.push(file);
    }
  }
  return found;
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

it('writes no /@vite/client tag in the examples, the docs, the benchmarks or the website scripts', () => {
  const found = new Map<string, number>();
  for (const root of ROOTS) {
    for (const file of listFiles(path.join(repo, root), [])) {
      const name = path.relative(repo, file).split(path.sep).join('/');
      if (!/\.(?:[cm]?[jt]sx?|brm|md|html|json)$/.test(name)) {
        continue;
      }
      const times = count(readFileSync(file, 'utf8'), '@vite/client');
      if (times > 0) {
        found.set(name, times);
      }
    }
  }
  expect(Object.fromEntries(found)).toEqual({});
});

it('writes no entry script tag and reads no client manifest in the code of the examples', () => {
  const offenders: string[] = [];
  for (const file of listFiles(path.join(repo, 'examples'), [])) {
    const name = path.relative(repo, file).split(path.sep).join('/');
    // Tests may check the tag that the build wrote. The config of a suite names no tag.
    if (!/\.(?:[cm]?[jt]sx?|brm)$/.test(name) || name.includes('/test/')) {
      continue;
    }
    const text = readFileSync(file, 'utf8');
    if (/<script\s+type="module"|\.vite\/manifest\.json/.test(text)) {
      offenders.push(name);
    }
  }
  expect(offenders).toEqual([]);
});
