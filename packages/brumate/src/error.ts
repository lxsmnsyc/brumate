export interface Location {
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
}

export function getLocation(source: string, offset: number): Location {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

/**
 * The lines around an offset, with line numbers and a caret under the
 * column, as Vite shows in its error overlay.
 */
export function codeFrame(source: string, offset: number): string {
  const { line, column } = getLocation(source, offset);
  const lines = source.split('\n');
  const first = Math.max(1, line - 2);
  const last = Math.min(lines.length, line + 2);
  const width = String(last).length;
  const result: string[] = [];
  for (let number = first; number <= last; number++) {
    const marker = number === line ? '>' : ' ';
    result.push(`${marker} ${String(number).padStart(width)} | ${lines[number - 1]}`);
    if (number === line) {
      result.push(`  ${' '.repeat(width)} | ${' '.repeat(column - 1)}^`);
    }
  }
  return result.join('\n');
}

/** A syntax error. Parsing stops at the first one. */
export class BrumateError extends Error {
  readonly filename: string;
  readonly offset: number;
  readonly location: Location;
  /** The lines around the error. */
  readonly frame: string;

  constructor(message: string, source: string, offset: number, filename: string) {
    const location = getLocation(source, offset);
    super(`${message} (${filename}:${location.line}:${location.column})`);
    this.name = 'BrumateError';
    this.filename = filename;
    this.offset = offset;
    this.location = location;
    this.frame = codeFrame(source, offset);
  }
}

/** Throws a syntax error at an offset of the file. */
export type Fail = (message: string, offset: number) => never;

export function createFail(source: string, filename: string): Fail {
  return (message, offset) => {
    throw new BrumateError(message, source, offset, filename);
  };
}
