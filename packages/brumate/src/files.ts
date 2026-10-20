import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** Skips `node_modules`, `dist` and hidden directories when looking for `.brm` files. */
export function defaultExclude(directory: string): boolean {
  return directory === 'node_modules' || directory === 'dist' || directory.startsWith('.');
}

/** Finds every `.brm` file under a directory, as absolute paths with forward slashes. */
export async function findFiles(
  root: string,
  exclude: (directory: string) => boolean,
): Promise<string[]> {
  const result: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const directories: Promise<void>[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!exclude(entry.name)) {
          directories.push(visit(file));
        }
      } else if (entry.name.endsWith('.brm')) {
        result.push(file.split(path.sep).join('/'));
      }
    }
    await Promise.all(directories);
  };
  await visit(root);
  return result.toSorted();
}
