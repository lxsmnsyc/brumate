import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const benchDir = fileURLToPath(new URL('..', import.meta.url));
export const repoDir = path.dirname(benchDir);

// Every folder in benchmarks/ with an adapter.js is a framework. brumate comes first.
export function discover() {
  const names = [];
  for (const entry of readdirSync(benchDir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(path.join(benchDir, entry.name, 'adapter.js'))) {
      names.push(entry.name);
    }
  }
  return names.toSorted((a, b) => {
    if (a === 'brumate') {
      return -1;
    }
    if (b === 'brumate') {
      return 1;
    }
    return a.localeCompare(b);
  });
}

export function appDir(name) {
  return path.join(benchDir, name);
}

export async function loadAdapter(name) {
  return import(path.join(appDir(name), 'adapter.js'));
}

export const SCENARIOS = ['todos', 'dashboard', 'rows'];

// The app of a scenario: `load()` of the adapter for todos, `loadDashboard()` for the
// dashboard and `loadRows()` for the rows.
export async function loadApp(name, scenario = 'todos') {
  const adapter = await loadAdapter(name);
  if (scenario === 'dashboard') return adapter.loadDashboard();
  if (scenario === 'rows') return adapter.loadRows();
  return adapter.load();
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
