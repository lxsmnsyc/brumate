import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { CompileError, compile } from './compile.ts';
import type { Diagnostic } from './model.ts';
import { findError } from './error-catalog.ts';
import { BrumateError, getLocation } from './error.ts';
import { defaultExclude, findFiles } from './files.ts';
import { analyzeProjectProps } from './project.ts';

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
  const start = getLocation(source, diagnostic.range.start);
  const end = getLocation(source, Math.max(diagnostic.range.start, diagnostic.range.end));
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
): CheckRecord[] {
  try {
    const result = compile(source, { filename: file, path: absolute, liveProps });
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
          range: { start, end: getLocation(source, error.offset + 1) },
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

const TS_LINE = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+|BRM): (.*)$/;
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
      if (match[5] === 'BRM') {
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
      last.message += `\n${line.trim()}`;
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
    return { records: [], note: 'The type check was skipped: there is no tsconfig.json here.' };
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
  if (result.status !== 0 && errorCount(records) === 0) {
    // A failure that has no error line of TypeScript, such as a missing tsconfig.json. A failure
    // of syntax errors only is reported by the compiler.
    const text = `${result.stdout}${result.stderr}`.trim();
    if (text && !/error BRM:/.test(text)) {
      records.push({
        file: null,
        range: null,
        severity: 'error',
        message: text,
        code: null,
        link: null,
        source: 'typescript',
      });
    }
  }
  return { records };
}

/** Compiles every `.brm` file under the root, and runs the type checker. */
export async function check(root: string, options: CheckOptions = {}): Promise<CheckResult> {
  const project = await findFiles(root, defaultExclude);
  const sources = new Map<string, string>();
  const texts = await Promise.all(project.map((file) => readFile(file, 'utf8')));
  for (const [index, file] of project.entries()) {
    sources.set(file, texts[index]!);
  }
  const props = analyzeProjectProps(sources);

  const targets: string[] = [];
  const paths = options.paths ?? [];
  if (paths.length === 0) {
    targets.push(...project);
  }
  const found = await Promise.all(
    paths.map(async (target) => {
      const absolute = path.resolve(root, target);
      return (await stat(absolute)).isDirectory()
        ? findFiles(absolute, defaultExclude)
        : [toPosix(absolute)];
    }),
  );
  for (const files of found) {
    targets.push(...files);
  }
  // Files outside the project are read here.
  const extra: string[] = [];
  for (const file of targets) {
    if (!sources.has(file)) {
      extra.push(file);
    }
  }
  const extraTexts = await Promise.all(extra.map((file) => readFile(file, 'utf8')));
  for (const [index, file] of extra.entries()) {
    sources.set(file, extraTexts[index]!);
  }

  const records: CheckRecord[] = [];
  for (const file of targets) {
    const parents = props.get(file);
    records.push(
      ...checkFile(
        sources.get(file)!,
        toPosix(path.relative(root, file)),
        file,
        parents && new Set(parents.keys()),
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
