import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { hasUseServer, isScriptFile } from './server-files.ts';

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

/**
 * Finds every file of server functions under a directory: a script whose
 * first statement is `'use server'`.
 */
export async function findServerFiles(
  root: string,
  exclude: (directory: string) => boolean,
): Promise<string[]> {
  const result: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const pending: Promise<void>[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!exclude(entry.name)) {
          pending.push(visit(file));
        }
      } else if (isScriptFile(entry.name)) {
        pending.push(
          readFile(file, 'utf8').then((source) => {
            if (hasUseServer(source)) {
              result.push(file.split(path.sep).join('/'));
            }
          }),
        );
      }
    }
    await Promise.all(pending);
  };
  await visit(root);
  return result.toSorted();
}

/**
 * Finds every script under a directory, such as `.ts` and `.brm.ts` files, as
 * absolute paths with forward slashes, without reading them.
 */
export async function findScripts(
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
      } else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        result.push(file.split(path.sep).join('/'));
      }
    }
    await Promise.all(directories);
  };
  await visit(root);
  return result.toSorted();
}

/**
 * Reads every `.brm` file under a root, and finds the files that the paths
 * name: a file, or the files under a directory. Without paths, the targets are
 * the whole project. A file outside the root is read too. A path that does not
 * exist throws.
 */
export async function collectSources(
  root: string,
  paths: string[],
): Promise<{ sources: Map<string, string>; targets: string[] }> {
  const project = await findFiles(root, defaultExclude);
  const sources = new Map<string, string>();
  const reads: Promise<string>[] = [];
  for (const file of project) {
    reads.push(readFile(file, 'utf8'));
  }
  const texts = await Promise.all(reads);
  for (const [index, file] of project.entries()) {
    sources.set(file, texts[index]!);
  }

  const targets: string[] = paths.length === 0 ? [...project] : [];
  const lookups: Promise<string[]>[] = [];
  for (const target of paths) {
    const absolute = path.resolve(root, target);
    lookups.push(
      stat(absolute).then((info) =>
        info.isDirectory()
          ? findFiles(absolute, defaultExclude)
          : [absolute.split(path.sep).join('/')],
      ),
    );
  }
  for (const found of await Promise.all(lookups)) {
    targets.push(...found);
  }
  const extra: string[] = [];
  const extraReads: Promise<string>[] = [];
  for (const file of targets) {
    if (!sources.has(file)) {
      extra.push(file);
      extraReads.push(readFile(file, 'utf8'));
    }
  }
  const extraTexts = await Promise.all(extraReads);
  for (const [index, file] of extra.entries()) {
    sources.set(file, extraTexts[index]!);
  }
  return { sources, targets };
}
