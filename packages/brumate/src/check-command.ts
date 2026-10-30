import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { CompileError, compile } from './compile.ts';
import type { Diagnostic } from './model.ts';
import { findError } from './error-catalog.ts';
import { BrumateError, getLocation } from './error.ts';
import { collectSources } from './files.ts';
import { resolveFromDisk } from './modules.ts';
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
  /** The `brumate-tsc` script to run. Defaults to the one of the installed @brumate/tsc. */
  tscBin?: string;
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
  const entry = diagnostic.severity === 'error' ? findError(diagnostic.message) : undefined;
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

const TS_LINE = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+|BRM\d*): (.*)$/;
const TS_GLOBAL = /^(error|warning) (TS\d+): (.*)$/;

/** Reads the lines that `tsc` prints without colors. */
export function parseTypeOutput(output: string, root: string): CheckRecord[] {
  const records: CheckRecord[] = [];
  let last: CheckRecord | undefined;
  for (const line of output.split('\n')) {
    const match = TS_LINE.exec(line);
    if (match) {
      last = undefined;
      // Syntax errors of `.brm` files are reported by the compiler, with their codes.
      if (match[5]!.startsWith('BRM')) {
        continue;
      }
      const position = { line: Number(match[2]), column: Number(match[3]) };
      last = {
        file: toPosix(path.relative(root, path.resolve(root, match[1]!))),
        range: { start: position, end: position },
        severity: match[4] === 'warning' ? 'warning' : 'error',
        message: match[6]!,
        code: match[5]!,
        link: null,
        source: 'typescript',
      };
      records.push(last);
      continue;
    }
    const global = TS_GLOBAL.exec(line);
    if (global) {
      last = {
        file: null,
        range: null,
        severity: global[1] === 'warning' ? 'warning' : 'error',
        message: global[3]!,
        code: global[2]!,
        link: null,
        source: 'typescript',
      };
      records.push(last);
      continue;
    }
    // The lines under a message, indented, belong to it.
    if (last && /^\s+\S/.test(line)) {
      last.message += `\n${line}`;
    }
  }
  return records;
}

/**
 * Runs `brumate-tsc`, the type checker of `.brm` files. It has no API that
 * gives its errors, so its output is read. Without the package, it gives a
 * note and no records.
 */
function typeCheck(root: string, tscBin?: string): { records: CheckRecord[]; note?: string } {
  if (!existsSync(path.join(root, 'tsconfig.json'))) {
    return {
      records: [],
      note: 'The type check was skipped: there is no tsconfig.json in the current directory.',
    };
  }
  let bin: string;
  try {
    const require = createRequire(path.join(root, 'noop.js'));
    bin =
      tscBin ??
      path.join(path.dirname(require.resolve('@brumate/tsc/package.json')), 'bin/brumate-tsc.js');
  } catch {
    return {
      records: [],
      note: 'The type check was skipped: install @brumate/tsc to run it, or pass --no-types.',
    };
  }
  const result = spawnSync(process.execPath, [bin, '--noEmit', '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const records = parseTypeOutput(`${result.stdout}\n${result.stderr}`, root);
  function fail(message: string): void {
    records.push({
      file: null,
      range: null,
      severity: 'error',
      message,
      code: null,
      link: null,
      source: 'typescript',
    });
  }
  if (result.error) {
    // The process did not start, ran too long for a timeout, or printed more than maxBuffer.
    fail(`The type check did not finish: ${result.error.message}`);
  } else if (result.signal) {
    fail(`The type check was stopped by ${result.signal}`);
  } else if (result.status !== 0 && errorCount(records) === 0) {
    // A failure that has no error line of TypeScript, such as an unreadable tsconfig.json. A
    // failure of syntax errors only is reported by the compiler.
    const text = `${result.stdout}${result.stderr}`.trim();
    if (!/error BRM\d*:/.test(text)) {
      fail(text || `The type check ended with status ${result.status}`);
    }
  }
  return { records };
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

  const notes: string[] = [];
  if (options.types !== false) {
    const types = typeCheck(root, options.tscBin);
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
