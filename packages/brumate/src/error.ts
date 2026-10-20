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

/** A syntax error. Parsing stops at the first one. */
export class BrumateError extends Error {
  readonly filename: string;
  readonly offset: number;
  readonly location: Location;

  constructor(message: string, source: string, offset: number, filename: string) {
    const location = getLocation(source, offset);
    super(`${message} (${filename}:${location.line}:${location.column})`);
    this.name = 'BrumateError';
    this.filename = filename;
    this.offset = offset;
    this.location = location;
  }
}

/** Throws a syntax error at an offset of the file. */
export type Fail = (message: string, offset: number) => never;

export function createFail(source: string, filename: string): Fail {
  return (message, offset) => {
    throw new BrumateError(message, source, offset, filename);
  };
}
