import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const benchDir = fileURLToPath(new URL('..', import.meta.url));
export const repoDir = path.dirname(benchDir);

// Every folder in benchmarks/ with an adapter.js is a framework. brumate comes first.
export function discover() {
  return readdirSync(benchDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(path.join(benchDir, entry.name, 'adapter.js')),
    )
    .map((entry) => entry.name)
    .toSorted((a, b) => (a === 'brumate' ? -1 : b === 'brumate' ? 1 : a.localeCompare(b)));
}

export function appDir(name) {
  return path.join(benchDir, name);
}

export async function loadAdapter(name) {
  return import(path.join(appDir(name), 'adapter.js'));
}

// The versions of the dependencies that each app has installed.
export async function versions(name) {
  const dir = appDir(name);
  const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  const out = {};
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    try {
      // pnpm links each dependency into the app's own node_modules.
      const file = path.join(dir, 'node_modules', dep, 'package.json');
      out[dep] = JSON.parse(await readFile(file, 'utf8')).version;
    } catch {
      out[dep] = 'unknown';
    }
  }
  return out;
}
