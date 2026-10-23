// The server functions that a project ever refreshes. A memo that calls one
// loads again in the browser after a call that refreshes it, so its value goes
// to the browser with update code. A memo of a function that nothing refreshes
// renders on the server only.

/** Every name, as `*` in the set, for a call of `refresh` that the scan cannot read. */
export const ANY = '*';

const NAME = '[A-Za-z_$][\\w$]*';
// `.refresh(fn)` and `.refresh(module.fn)`, such as `event.refresh(listNotes)`.
const REFRESH = new RegExp(`\\.refresh\\(\\s*(${NAME}(?:\\s*\\.\\s*${NAME})*)?\\s*([,)])`, 'g');
const IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from/g;

/**
 * The names of the server functions that the sources pass to `refresh`, by
 * the name that their file exports. A local name of an import, such as `ln`
 * of `import { listNotes as ln }`, counts as the name that it imports. A
 * call that the scan cannot read, such as `refresh(pick())`, adds `ANY`.
 */
export function refreshedNames(sources: Iterable<string>): Set<string> {
  const names = new Set<string>();
  for (const source of sources) {
    if (!source.includes('.refresh(')) {
      continue;
    }
    const aliases = new Map<string, string>();
    for (const [, list] of source.matchAll(IMPORT)) {
      for (const item of list!.split(',')) {
        const [imported, local] = item
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/);
        if (imported && local) {
          aliases.set(local.trim(), imported.trim());
        }
      }
    }
    for (const match of source.matchAll(REFRESH)) {
      const target = match[1];
      if (target === undefined) {
        // `refresh()` names no function.
        continue;
      }
      const last = target.split('.').at(-1)!.trim();
      names.add(aliases.get(last) ?? last);
    }
    // A `refresh(` that the pattern did not read, such as `refresh(fns[0])`.
    const calls = source.split('.refresh(').length - 1;
    const read = [...source.matchAll(REFRESH)].length;
    if (calls > read) {
      names.add(ANY);
    }
  }
  return names;
}
