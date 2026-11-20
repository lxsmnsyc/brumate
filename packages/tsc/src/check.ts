import { createRequire } from 'node:module';
import path from 'node:path';
import { createBrumateLanguagePlugin } from '@brumate/language-core';

const require = createRequire(import.meta.url);

/** A place in a file. Lines and columns start at 1. */
export interface TscPosition {
  line: number;
  column: number;
}

/** One problem found by `checkProject`. */
export interface TscDiagnostic {
  /** The path of the file, relative to the root. Null for a problem of the whole project. */
  file: string | null;
  /** Where the problem is, null when it has no place. */
  range: { start: TscPosition; end: TscPosition } | null;
  severity: 'error' | 'warning';
  /** The message without its code or its place. Lines under the first are indented. */
  message: string;
  /** `TS2322` for TypeScript, `BRM031` for a syntax error of a `.brm` file. */
  code: string;
}

export interface CheckProjectOptions {
  /** The tsconfig file, relative to the root. Defaults to `tsconfig.json`. */
  project?: string;
}

// The slice of the TypeScript API that this file uses.
interface Ts {
  sys: unknown;
  DiagnosticCategory: { Warning: number; Error: number };
  findConfigFile(dir: string, exists: (file: string) => boolean, name: string): string | undefined;
  readConfigFile(
    file: string,
    read: (file: string) => string | undefined,
  ): { config?: unknown; error?: Diag };
  parseJsonConfigFileContent(
    json: unknown,
    host: unknown,
    base: string,
    existing: undefined,
    configFile: string,
    resolutionStack: undefined,
    extraFileExtensions: unknown[],
  ): { options: object; fileNames: string[]; errors: Diag[]; projectReferences?: unknown[] };
  createCompilerHost(options: object): unknown;
  createProgram: (options: unknown) => Program;
  sortAndDeduplicateDiagnostics(list: readonly Diag[]): readonly Diag[];
  flattenDiagnosticMessageText(text: unknown, newLine: string): string;
}

interface Diag {
  file?: {
    fileName: string;
    getLineAndCharacterOfPosition(pos: number): { line: number; character: number };
  };
  start?: number;
  length?: number;
  messageText: unknown;
  code: number;
  category: number;
}

interface Program {
  getConfigFileParsingDiagnostics(): readonly Diag[];
  getOptionsDiagnostics(): readonly Diag[];
  getGlobalDiagnostics(): readonly Diag[];
  getSyntacticDiagnostics(): readonly Diag[];
  getSemanticDiagnostics(): readonly Diag[];
}

/**
 * Type-checks the project of a tsconfig file, `.brm` files included, and returns
 * what it found. It does not print and does not end the process. It uses the
 * TypeScript 6 compiler, installed as `typescript-api`, like `run()` does.
 */
export function checkProject(root: string, options: CheckProjectOptions = {}): TscDiagnostic[] {
  const ts = require('typescript-api') as Ts;
  const { proxyCreateProgram } = require('@volar/typescript/lib/node/proxyCreateProgram') as {
    proxyCreateProgram(
      ts: Ts,
      original: Ts['createProgram'],
      create: () => unknown[],
    ): Ts['createProgram'];
  };
  const sys = ts.sys as {
    fileExists(file: string): boolean;
    readFile(file: string): string | undefined;
  };
  const diagnostics: TscDiagnostic[] = [];
  const syntaxErrors = new Map<string, TscDiagnostic>();

  // The program reads the language plugin when it is created, so the syntax
  // errors of `.brm` files are collected while it checks.
  function createPlugins(): unknown[] {
    return [
      createBrumateLanguagePlugin({
        onError(fileName, error) {
          // The message ends with the code of its catalog entry, such as `[BRM031]`.
          const text = error.message.replace(/ \([^()]*:\d+:\d+\)$/, '');
          const found = /^(.*) \[(BRM\d+)\]$/.exec(text);
          syntaxErrors.set(fileName, {
            file: toRelative(root, fileName),
            range: {
              start: { line: error.location.line, column: error.location.column },
              end: { line: error.location.line, column: error.location.column },
            },
            severity: 'error',
            message: found ? found[1]! : text,
            code: found ? found[2]! : 'BRM',
          });
        },
      }),
    ];
  }

  // Read the tsconfig file, with `.brm` as an extra file extension.
  const configPath = path.resolve(root, options.project ?? 'tsconfig.json');
  const config = ts.readConfigFile(configPath, (file) => sys.readFile(file));
  if (config.error) {
    return [fromTs(ts, root, config.error)];
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
    undefined,
    [{ extension: 'brm', isMixedContent: true, scriptKind: 7 }],
  );

  // Create the program with the language plugin, and read every kind of diagnostic.
  const createProgram = proxyCreateProgram(ts, ts.createProgram, createPlugins);
  const program = createProgram({
    rootNames: parsed.fileNames,
    // Without this, TypeScript refuses root files with an extension it does not know.
    options: { ...parsed.options, allowNonTsExtensions: true },
    projectReferences: parsed.projectReferences,
    host: ts.createCompilerHost(parsed.options),
    configFileParsingDiagnostics: parsed.errors,
  } as never);
  // Sorted by file and place, with duplicates dropped, like `tsc` prints them.
  const found = ts.sortAndDeduplicateDiagnostics([
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ]);
  for (const diagnostic of found) {
    if (
      diagnostic.category === ts.DiagnosticCategory.Error ||
      diagnostic.category === ts.DiagnosticCategory.Warning
    ) {
      diagnostics.push(fromTs(ts, root, diagnostic));
    }
  }
  diagnostics.push(...syntaxErrors.values());
  return diagnostics;
}

function toRelative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

function fromTs(ts: Ts, root: string, diagnostic: Diag): TscDiagnostic {
  const severity = diagnostic.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error';
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const code = `TS${diagnostic.code}`;
  const { file, start } = diagnostic;
  if (!file || start === undefined) {
    return { file: null, range: null, severity, message, code };
  }
  // TypeScript counts lines and characters from 0.
  const from = file.getLineAndCharacterOfPosition(start);
  const to = file.getLineAndCharacterOfPosition(start + (diagnostic.length ?? 0));
  return {
    file: toRelative(root, file.fileName),
    range: {
      start: { line: from.line + 1, column: from.character + 1 },
      end: { line: to.line + 1, column: to.character + 1 },
    },
    severity,
    message,
    code,
  };
}
