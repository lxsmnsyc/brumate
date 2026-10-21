// Packages of components. A dependency of the app whose package.json has a
// `brumate` field ships `.brm` files, `.brm.ts` modules and `'use server'`
// files as source, and the plugin of the app compiles them with its own files.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

/** A dependency of the app that ships `.brm` files. */
export interface BrumatePackage {
  /** The name of the package, such as `@acme/ui`. */
  name: string;
  version: string;
  /** The real path of the directory of the package, with forward slashes. */
  root: string;
  /** The directories to search for files, as absolute paths with forward slashes. */
  directories: string[];
  /**
   * The prefix of the names of its files, which their IDs come from: the
   * name of the package, and its version when the app has two versions.
   */
  prefix: string;
  /** True when the package is not inside `node_modules`, such as a workspace package. */
  linked: boolean;
}

interface PackageJson {
  name?: string;
  version?: string;
  brumate?: unknown;
  exports?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const toPosix = (file: string): string => file.split(path.sep).join('/');

function readJson(file: string): PackageJson | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as PackageJson;
  } catch {
    return undefined;
  }
}

/** The real directory of a package that code in `from` can import, or undefined. */
export function findPackageDirectory(name: string, from: string): string | undefined {
  for (let directory = from; ; directory = path.dirname(directory)) {
    const candidate = path.join(directory, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) {
      return toPosix(realpathSync(candidate));
    }
    if (path.dirname(directory) === directory) {
      return undefined;
    }
  }
}

/** The directory of the nearest package.json at or above a directory. */
function packageRoot(directory: string): string | undefined {
  for (let current = directory; ; current = path.dirname(current)) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    if (path.dirname(current) === current) {
      return undefined;
    }
  }
}

/** The version of the `brumate` field that this version of brumate reads. */
export const PACKAGE_FORMAT = 1;

/** The directories that the `brumate` field names, or undefined when the package does not opt in. */
function directoriesOf(root: string, field: unknown, name: string): string[] | undefined {
  if (field === true) {
    return [root];
  }
  if (typeof field === 'object' && field !== null) {
    const { dir, version = PACKAGE_FORMAT } = field as {
      dir?: string | string[];
      version?: number;
    };
    if (version !== PACKAGE_FORMAT) {
      throw new Error(
        `The package ${name} has "brumate": { "version": ${version} }, but this version of brumate reads version ${PACKAGE_FORMAT}. Install a version of ${name} or of brumate that matches.`,
      );
    }
    if (dir === undefined) {
      return [root];
    }
    return (Array.isArray(dir) ? dir : [dir]).map((item) => toPosix(path.resolve(root, item)));
  }
  return undefined;
}

/**
 * Finds the dependencies of the app at `root` that ship `.brm` files, and
 * theirs. The app's dependencies come from its package.json: `dependencies`,
 * `devDependencies`, `optionalDependencies` and `peerDependencies`. A package
 * opts in with `"brumate": true`, or `"brumate": { "dir": "src" }` to search
 * only that directory. Symbolic links, such as those of pnpm, resolve to the
 * real directory.
 */
export function findPackages(root: string): BrumatePackage[] {
  const app = packageRoot(path.resolve(root));
  if (!app) {
    return [];
  }
  const found = new Map<string, Omit<BrumatePackage, 'prefix'>>();
  const visit = (directory: string, json: PackageJson, own: boolean): void => {
    const names = new Set([
      ...Object.keys(json.dependencies ?? {}),
      ...Object.keys(json.optionalDependencies ?? {}),
      ...Object.keys(json.peerDependencies ?? {}),
      // The dev dependencies of a package are its own tools, not part of what it ships.
      ...(own ? Object.keys(json.devDependencies ?? {}) : []),
    ]);
    for (const name of [...names].toSorted()) {
      const real = findPackageDirectory(name, directory);
      if (!real || found.has(real)) {
        continue;
      }
      const dependency = readJson(`${real}/package.json`);
      const directories = dependency && directoriesOf(real, dependency.brumate, name);
      if (!dependency || !directories) {
        continue;
      }
      found.set(real, {
        name: dependency.name ?? name,
        version: dependency.version ?? '0.0.0',
        root: real,
        directories,
        linked: !real.includes('/node_modules/'),
      });
      visit(real, dependency, false);
    }
  };
  visit(app, readJson(path.join(app, 'package.json')) ?? {}, true);
  const list = [...found.values()];
  // Two versions of one package get IDs apart. Copies of one version share theirs, as their files are the same.
  const versions = new Map<string, Set<string>>();
  for (const item of list) {
    versions.set(item.name, (versions.get(item.name) ?? new Set()).add(item.version));
  }
  return list.map((item): BrumatePackage =>
    Object.assign(item, {
      prefix: versions.get(item.name)!.size > 1 ? `${item.name}@${item.version}` : item.name,
    }),
  );
}

/** The package that a file belongs to, or undefined for a file of the app. */
export function packageOf(packages: BrumatePackage[], file: string): BrumatePackage | undefined {
  return packages.find((item) => file.startsWith(`${item.root}/`));
}

/**
 * The name of a file of a package, which its IDs come from: the prefix of
 * the package and the path of the file in it, such as `@acme/ui/src/Button.brm`.
 * It is the same wherever the package is installed.
 */
export function packageFileName(item: BrumatePackage, file: string): string {
  return `${item.prefix}/${file.slice(item.root.length + 1)}`;
}

/** The name and the subpath of a bare specifier, such as `@acme/ui` and `./Button.brm`. */
export function splitSpecifier(specifier: string): { name: string; subpath: string } | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/') || /^[a-z]+:/i.test(specifier)) {
    return undefined;
  }
  const parts = specifier.split('/');
  const count = specifier.startsWith('@') ? 2 : 1;
  if (parts.length < count || parts.slice(0, count).some((part) => part === '')) {
    return undefined;
  }
  const rest = parts.slice(count).join('/');
  return { name: parts.slice(0, count).join('/'), subpath: rest ? `./${rest}` : '.' };
}

/** The conditions of `exports` that a `.brm` file or a source module can be under. */
const CONDITIONS = new Set(['brumate', 'import', 'module', 'node', 'browser', 'default']);

function resolveTarget(target: unknown, star: string): string | undefined {
  if (typeof target === 'string') {
    return target.replaceAll('*', star);
  }
  if (Array.isArray(target)) {
    for (const item of target) {
      const result = resolveTarget(item, star);
      if (result) {
        return result;
      }
    }
    return undefined;
  }
  if (typeof target === 'object' && target !== null) {
    for (const [condition, value] of Object.entries(target)) {
      if (CONDITIONS.has(condition)) {
        const result = resolveTarget(value, star);
        if (result) {
          return result;
        }
      }
    }
  }
  return undefined;
}

/** Resolves a subpath through the `exports` of a package.json, or undefined if it does not export it. */
export function resolveExports(exports: unknown, subpath: string): string | undefined {
  const map =
    typeof exports === 'object' &&
    exports !== null &&
    !Array.isArray(exports) &&
    Object.keys(exports).some((key) => key.startsWith('.'))
      ? (exports as Record<string, unknown>)
      : { '.': exports };
  if (subpath in map) {
    return resolveTarget(map[subpath], '');
  }
  // The pattern with the longest prefix wins, as in Node.
  let best: { key: string; star: string } | undefined;
  for (const key of Object.keys(map)) {
    const index = key.indexOf('*');
    if (index === -1) {
      continue;
    }
    const before = key.slice(0, index);
    const after = key.slice(index + 1);
    if (
      subpath.startsWith(before) &&
      subpath.endsWith(after) &&
      subpath.length >= key.length - 1 &&
      (!best || before.length > best.key.indexOf('*'))
    ) {
      best = { key, star: subpath.slice(before.length, subpath.length - after.length) };
    }
  }
  return best && resolveTarget(map[best.key], best.star);
}

/**
 * Resolves a bare specifier, such as `@acme/ui/Button.brm`, to the real path
 * of the file, through the `exports` of the package. Returns undefined when
 * it is not a bare specifier or names no file.
 */
export function resolvePackageImport(specifier: string, importer: string): string | undefined {
  const split = splitSpecifier(specifier);
  if (!split) {
    return undefined;
  }
  const directory = findPackageDirectory(split.name, path.dirname(importer));
  if (!directory) {
    return undefined;
  }
  const json = readJson(`${directory}/package.json`);
  const target =
    json?.exports === undefined ? split.subpath : resolveExports(json.exports, split.subpath);
  if (!target) {
    return undefined;
  }
  const file = path.resolve(directory, target);
  return existsSync(file) ? toPosix(realpathSync(file)) : undefined;
}

/** The specifiers that a file imports or exports from, found by a pattern, so it can only find more. */
export function importSpecifiers(source: string): string[] {
  const result: string[] = [];
  for (const match of source.matchAll(/(?:\bfrom|\bimport\s*\(?)\s*(['"])([^'"\n]+)\1/g)) {
    result.push(match[2]!);
  }
  return result;
}

/** The extensions that an import without one can name. */
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js'];

/**
 * The files of packages that the app reaches: the files of packages that
 * files of the app import, and the files of packages that those import, and
 * so on. Only these become server functions of the app.
 */
export function reachableFiles(
  packages: BrumatePackage[],
  appFiles: string[],
  read: (file: string) => string | undefined,
): Set<string> {
  const reached = new Set<string>();
  const names = new Set(packages.map((item) => item.name));
  const pending: string[] = [];
  const add = (file: string | undefined): void => {
    if (file && !reached.has(file) && packageOf(packages, file)) {
      reached.add(file);
      pending.push(file);
    }
  };
  const resolve = (specifier: string, importer: string): string | undefined => {
    if (specifier.startsWith('.')) {
      const stem = path.resolve(path.dirname(importer), specifier.split('?')[0]!);
      const found = EXTENSIONS.map((extension) => stem + extension).find((candidate) =>
        statSync(candidate, { throwIfNoEntry: false })?.isFile(),
      );
      return found && toPosix(realpathSync(found));
    }
    const name = splitSpecifier(specifier)?.name;
    return name && names.has(name)
      ? resolvePackageImport(specifier.split('?')[0]!, importer)
      : undefined;
  };
  const visit = (file: string, own: boolean): void => {
    const source = read(file);
    if (source === undefined) {
      return;
    }
    for (const specifier of importSpecifiers(source)) {
      // A file of the app reaches a package only by its name.
      if (own && specifier.startsWith('.')) {
        continue;
      }
      try {
        add(resolve(specifier, file));
      } catch {
        // A path that is not a file, such as a directory, reaches nothing.
      }
    }
  };
  for (const file of appFiles) {
    visit(file, true);
  }
  while (pending.length > 0) {
    visit(pending.pop()!, false);
  }
  return reached;
}
