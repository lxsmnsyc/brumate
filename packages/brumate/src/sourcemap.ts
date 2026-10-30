// Source maps from generated modules back to the `.brm` file.
//
// Code generation builds modules from strings, and copies code of the file
// into them in many places. Instead of tracking positions through every
// string, each copy carries markers: a character of the private use area,
// the offset in the file in base 36, and another such character. A marker
// goes before each copied piece and after each line break in it. When the
// module is done, `finish` removes the markers and writes where each one
// was as a mapping.

const OPEN = '';
const CLOSE = '';
const MARKER = /([0-9a-z]+)/g;

/** The marker of an offset in the file. */
function marker(offset: number): string {
  return `${OPEN}${offset.toString(36)}${CLOSE}`;
}

/**
 * Copies a range of the file, with a marker before it and before the first
 * character of each line after it, so the source map points each line at its
 * place in the file. The marker of a line goes after its indentation, so
 * code that changes indentation still finds it, and blank lines get none.
 */
export function copy(source: string, start: number, end: number): string {
  if (end <= start) {
    return '';
  }
  let result = marker(start);
  let position = start;
  for (;;) {
    const lineBreak = source.indexOf('\n', position);
    if (lineBreak === -1 || lineBreak >= end - 1) {
      break;
    }
    let first = lineBreak + 1;
    while (first < end && (source[first] === ' ' || source[first] === '\t')) {
      first++;
    }
    result += source.slice(position, first);
    if (first < end && source[first] !== '\n' && source[first] !== '\r') {
      result += marker(first);
    }
    position = first;
  }
  return result + source.slice(position, end);
}

/** Removes the markers of a text, for code that checks what a copy holds. */
export function unmarked(text: string): string {
  return text.replace(MARKER, '');
}

/** A source map, version 3. */
export interface SourceMap {
  version: 3;
  file: string;
  sources: string[];
  sourcesContent: string[];
  names: string[];
  mappings: string;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function vlq(value: number): string {
  let rest = value < 0 ? (-value << 1) | 1 : value << 1;
  let result = '';
  do {
    let digit = rest & 31;
    rest >>>= 5;
    if (rest > 0) {
      digit |= 32;
    }
    result += BASE64[digit];
  } while (rest > 0);
  return result;
}

/** A file that code comes from. */
export interface SourceFile {
  name: string;
  content: string;
}

/** The line and column of each offset of a text, both from 0. */
function lineIndex(text: string): (offset: number) => [line: number, column: number] {
  const lineStarts = [0];
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
    lineStarts.push(index + 1);
  }
  return (offset) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (lineStarts[middle]! <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return [low, offset - lineStarts[low]!];
  };
}

/**
 * Removes the markers of a generated module, and returns the module with a
 * source map that points the code that came from the files back to them.
 * The markers hold offsets of the code that was compiled. `place` turns one
 * into the index of its file in `files` and the offset in that file, for
 * code that a component copied from a module.
 */
export function finish(
  code: string,
  files: SourceFile[],
  place: (offset: number) => { index: number; offset: number } = (offset) => ({ index: 0, offset }),
): { code: string; map: SourceMap } {
  const indexes: ReturnType<typeof lineIndex>[] = [];
  for (const file of files) {
    indexes.push(lineIndex(file.content));
  }
  let previousSource = 0;

  let output = '';
  const lines: string[] = [''];
  let column = 0;
  let previousColumn = 0;
  let previousLine = 0;
  let previousSourceColumn = 0;
  let position = 0;
  // The segments of the current line, so two markers at one column write one segment.
  let lastColumn = -1;
  for (const match of code.matchAll(MARKER)) {
    const text = code.slice(position, match.index);
    output += text;
    for (const char of text) {
      if (char === '\n') {
        lines.push('');
        column = 0;
        previousColumn = 0;
        lastColumn = -1;
      } else {
        column += char.length;
      }
    }
    position = match.index + match[0].length;
    if (column === lastColumn) {
      continue;
    }
    lastColumn = column;
    const placed = place(Number.parseInt(match[1]!, 36));
    const [line, sourceColumn] = indexes[placed.index]!(placed.offset);
    const segment =
      vlq(column - previousColumn) +
      vlq(placed.index - previousSource) +
      vlq(line - previousLine) +
      vlq(sourceColumn - previousSourceColumn);
    previousSource = placed.index;
    const current = lines.length - 1;
    lines[current] = lines[current] ? `${lines[current]},${segment}` : segment;
    previousColumn = column;
    previousLine = line;
    previousSourceColumn = sourceColumn;
  }
  output += code.slice(position);
  const sources: string[] = [];
  const sourcesContent: string[] = [];
  for (const file of files) {
    sources.push(file.name);
    sourcesContent.push(file.content);
  }
  return {
    code: output,
    map: {
      version: 3,
      file: files[0]!.name,
      sources,
      sourcesContent,
      names: [],
      mappings: lines.join(';'),
    },
  };
}

/**
 * The place in a source that a position of generated code came from, by a
 * source map. Lines and columns count from 1. Undefined when the map has no
 * mapping on that line at or before the column.
 */
export function originalPosition(
  map: { sources: (string | null)[]; mappings: string },
  line: number,
  column: number,
): { source: string; line: number; column: number } | undefined {
  // The fields of a segment are relative to the segment before, across lines but the column.
  const state = [0, 0, 0, 0];
  let found: number[] | undefined;
  const lines = map.mappings.split(';');
  for (let index = 0; index < line && index < lines.length; index++) {
    let generated = 0;
    for (const segment of lines[index]!.split(',')) {
      if (!segment) {
        continue;
      }
      const fields: number[] = [];
      let value = 0;
      let shift = 0;
      for (const char of segment) {
        const digit = BASE64.indexOf(char);
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
        } else {
          fields.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = 0;
          shift = 0;
        }
      }
      generated += fields[0]!;
      if (fields.length >= 4) {
        state[1]! += fields[1]!;
        state[2]! += fields[2]!;
        state[3]! += fields[3]!;
      }
      if (index === line - 1 && fields.length >= 4 && generated <= column - 1) {
        found = [state[1]!, state[2]!, state[3]!];
      }
    }
  }
  const source = found && map.sources[found[0]!];
  return found && source ? { source, line: found[1]! + 1, column: found[2]! + 1 } : undefined;
}
