import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'oxc-parser';
import { CompileError, compile } from './compile.ts';
import type { Diagnostic } from './model.ts';
import { findError } from './error-catalog.ts';
import { BrumateError, getLocation } from './error.ts';
import { BRIDGE_EXPORT, scriptBridges } from './bridges.ts';
import { collectSources, defaultExclude, findScripts } from './files.ts';
import { ModuleError, isReactiveModule, resolveFromDisk } from './modules.ts';
import { findSignalImports, planModuleSignals } from './module-signals.ts';
import type { BrumatePackage } from './packages.ts';
import { findPackages, resolveComponentPackage } from './packages.ts';
import { analyzeProjectProps } from './project.ts';
import { findPackageServerFile, findServerImport } from './server-files.ts';

/** A place in a file. Lines and columns start at 1. */
export interface CheckPosition {
  line: number;
  column: number;
}

/** One problem, as `brumate check --json` prints it. */
export interface CheckRecord {
  /** The file, relative to the current directory. Null for a problem of the whole project. */
  file: string | null;
  /** Where the problem is. The type checker gives a start only, so its end is the start. */
  range: { start: CheckPosition; end: CheckPosition } | null;
  severity: 'error' | 'warning';
  /** The message without its code or its place. */
  message: string;
  /** `BRM012` for an error of the compiler, `TS2322` for one of TypeScript, null for a warning. */
  code: string | null;
  /** The page of the docs that explains the code, null when there is none. */
  link: string | null;
  /** Who found it. */
  source: 'brumate' | 'typescript';
}

export interface CheckOptions {
  /** Files or directories to check. Defaults to the root. */
  paths?: string[];
  /** Runs the type checker too. Defaults to true. */
  types?: boolean;
  /** The module that exports `checkProject`. Defaults to the @brumate/tsc of the project. */
  tscModule?: string;
}

export interface CheckResult {
  records: CheckRecord[];
  /** Why the type check did not run, such as a missing package. */
  notes: string[];
}

/** How many records are errors. Warnings do not count. */
export function errorCount(records: CheckRecord[]): number {
  let count = 0;
  for (const record of records) {
    if (record.severity === 'error') {
      count++;
    }
  }
  return count;
}

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}

function fromDiagnostic(source: string, file: string, diagnostic: Diagnostic): CheckRecord {
  const entry = findError(diagnostic.message);
  // A range at the end of the file stays in the file.
  const first = Math.min(diagnostic.range.start, source.length);
  const start = getLocation(source, first);
  const end = getLocation(source, Math.min(Math.max(first, diagnostic.range.end), source.length));
  return {
    file,
    range: { start, end },
    severity: diagnostic.severity === 'error' ? 'error' : 'warning',
    message: diagnostic.message,
    code: entry?.code ?? null,
    link: entry?.link ?? null,
    source: 'brumate',
  };
}

/** Compiles one file and gives its errors and warnings. */
function checkFile(
  source: string,
  file: string,
  absolute: string,
  liveProps: Set<string> | undefined,
  packages: BrumatePackage[],
): CheckRecord[] {
  try {
    const result = compile(source, {
      filename: file,
      path: absolute,
      liveProps,
      serverImport: (specifier) =>
        specifier.startsWith('.')
          ? findServerImport(absolute, specifier)
          : findPackageServerFile(packages, absolute, specifier),
      resolveModule: (specifier, importer) => {
        const local = resolveFromDisk(specifier, importer);
        const found =
          local === undefined ? resolveComponentPackage(packages, specifier, importer) : undefined;
        return found ? { path: found, source: readFileSync(found, 'utf8') } : local;
      },
    });
    const records: CheckRecord[] = [];
    for (const warning of result.warnings) {
      records.push(fromDiagnostic(source, file, warning));
    }
    return records;
  } catch (error) {
    if (error instanceof CompileError) {
      const records: CheckRecord[] = [];
      for (const diagnostic of error.diagnostics) {
        records.push(fromDiagnostic(source, file, diagnostic));
      }
      return records;
    }
    if (error instanceof BrumateError) {
      // The message holds the code and the place. The parts are in the entry and the location.
      const message = error.message.replace(/ \([^()]*:\d+:\d+\)$/, '').replace(/ \[BRM\d+\]$/, '');
      const entry = findError(message);
      const start = error.location;
      return [
        {
          file,
          range: { start, end: getLocation(source, Math.min(error.offset + 1, source.length)) },
          severity: 'error',
          message,
          code: entry?.code ?? null,
          link: entry?.link ?? null,
          source: 'brumate',
        },
      ];
    }
    throw error;
  }
}

/** The part of `@brumate/tsc` that `check` uses. */
interface TscModule {
  checkProject(root: string): Array<{
    file: string | null;
    range: { start: CheckPosition; end: CheckPosition } | null;
    severity: 'error' | 'warning';
    message: string;
    code: string;
  }>;
}

/**
 * Type-checks the project with `@brumate/tsc`, which the project installs. Without the package
 * or a tsconfig.json, it gives a note and no records.
 */
async function typeCheck(
  root: string,
  tscModule?: string,
): Promise<{ records: CheckRecord[]; note?: string }> {
  if (!existsSync(path.join(root, 'tsconfig.json'))) {
    return {
      records: [],
      note: 'The type check was skipped: there is no tsconfig.json in the current directory.',
    };
  }

  // Find the package from the project, since brumate does not depend on it.
  let file: string;
  try {
    const require = createRequire(path.join(root, 'noop.js'));
    file = tscModule ?? require.resolve('@brumate/tsc');
  } catch {
    return {
      records: [],
      note: 'The type check was skipped: install @brumate/tsc to run it, or pass --no-types.',
    };
  }

  // Run it. A failure to load or run is an error of the check, not a crash.
  const records: CheckRecord[] = [];
  try {
    const tsc = (await import(pathToFileURL(file).href)) as Partial<TscModule>;
    // A @brumate/tsc from before checkProject cannot run the check.
    if (typeof tsc.checkProject !== 'function') {
      return {
        records: [],
        note: 'The type check was skipped: update @brumate/tsc to a version with checkProject, or pass --no-types.',
      };
    }
    for (const item of tsc.checkProject(root)) {
      // Syntax errors of `.brm` files are reported by the compiler, with their codes.
      if (item.code.startsWith('BRM')) {
        continue;
      }
      records.push({ ...item, link: null, source: 'typescript' });
    }
  } catch (error) {
    records.push({
      file: null,
      range: null,
      severity: 'error',
      message: `The type check did not finish: ${error instanceof Error ? error.message : String(error)}`,
      code: null,
      link: null,
      source: 'typescript',
    });
  }
  return { records };
}

/** The message of BRM208, for a signal that a plain file imports. */
function signalImportMessage(name: string, specifier: string): string {
  return `"${name}" is a signal of ${specifier}, and a file of plain code gets its store, not its value. Import it in a component, or read it in a function that the module exports`;
}

/**
 * Finds the problems of module signals in a script file: a form that the top level of a module
 * cannot take, and a signal that a plain file imports.
 */
function checkModuleSignals(source: string, file: string, root: string): CheckRecord[] {
  const records: CheckRecord[] = [];
  const name = toPosix(path.relative(root, file));
  if (isReactiveModule(file)) {
    if (!source.includes('brumate/signals')) {
      return records;
    }
    try {
      const program = parseSync(file, source, { lang: 'ts', preserveParens: false }).program;
      planModuleSignals(program, source, false, file);
    } catch (error) {
      if (!(error instanceof ModuleError)) {
        throw error;
      }
      const entry = findError(error.message);
      const start = getLocation(source, error.offset);
      records.push({
        file: name,
        range: { start, end: start },
        severity: 'error',
        message: error.message,
        code: entry?.code ?? null,
        link: entry?.link ?? null,
        source: 'brumate',
      });
    }
    return records;
  }
  for (const item of findSignalImports(source, file, resolveFromDisk)) {
    const message = signalImportMessage(item.name, item.specifier);
    const entry = findError(message);
    records.push({
      file: name,
      range: { start: getLocation(source, item.start), end: getLocation(source, item.end) },
      severity: 'error',
      message,
      code: entry?.code ?? null,
      link: entry?.link ?? null,
      source: 'brumate',
    });
  }
  return records;
}

/** Finds the calls of `bridge` in scripts that are not module-level exports, and module signal problems. */
async function checkScripts(root: string, paths: string[]): Promise<CheckRecord[]> {
  const files = new Set<string>();
  if (paths.length === 0) {
    for (const file of await findScripts(root, defaultExclude)) {
      files.add(file);
    }
  }
  for (const target of paths) {
    const absolute = path.resolve(root, target);
    if (statSync(absolute).isDirectory()) {
      for (const file of await findScripts(absolute, defaultExclude)) {
        files.add(file);
      }
    } else if (/\.[cm]?[jt]sx?$/.test(absolute)) {
      files.add(toPosix(absolute));
    }
  }
  const entry = findError(BRIDGE_EXPORT);
  const records: CheckRecord[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    records.push(...checkModuleSignals(source, file, root));
    for (const { call, exported } of scriptBridges(source, file)) {
      if (exported === undefined) {
        const start = getLocation(source, call.start);
        records.push({
          file: toPosix(path.relative(root, file)),
          range: { start, end: getLocation(source, call.end) },
          severity: 'error',
          message: BRIDGE_EXPORT,
          code: entry?.code ?? null,
          link: entry?.link ?? null,
          source: 'brumate',
        });
      }
    }
  }
  return records;
}

/** Compiles every `.brm` file under the root, and runs the type checker. */
export async function check(root: string, options: CheckOptions = {}): Promise<CheckResult> {
  const records: CheckRecord[] = [];
  // A path that does not exist is a problem of its own. The others are still checked.
  const paths: string[] = [];
  for (const target of options.paths ?? []) {
    if (existsSync(path.resolve(root, target))) {
      paths.push(target);
    } else {
      records.push({
        file: toPosix(target),
        range: null,
        severity: 'error',
        message: 'This file or directory does not exist',
        code: null,
        link: null,
        source: 'brumate',
      });
    }
  }
  const missingOnly = paths.length === 0 && (options.paths?.length ?? 0) > 0;
  const { sources, targets } = missingOnly
    ? { sources: new Map<string, string>(), targets: [] }
    : await collectSources(root, paths);
  const props = analyzeProjectProps(sources);

  const packages = findPackages(root);
  for (const file of targets) {
    const parents = props.get(file);
    records.push(
      ...checkFile(
        sources.get(file)!,
        toPosix(path.relative(root, file)),
        file,
        parents && new Set(parents.keys()),
        packages,
      ),
    );
  }

  if (!missingOnly) {
    records.push(...(await checkScripts(root, paths)));
  }

  const notes: string[] = [];
  if (options.types !== false) {
    const types = await typeCheck(root, options.tscModule);
    records.push(...types.records);
    if (types.note) {
      notes.push(types.note);
    }
  }
  return { records, notes };
}

/** One line for a person: `file:line:column: error BRM012: message`. */
export function formatRecord(record: CheckRecord): string {
  const place = record.file
    ? `${record.file}${record.range ? `:${record.range.start.line}:${record.range.start.column}` : ''}: `
    : '';
  const code = record.code ? ` ${record.code}` : '';
  const link = record.link ? `\n  ${record.link}` : '';
  return `${place}${record.severity}${code}: ${record.message}${link}`;
}
