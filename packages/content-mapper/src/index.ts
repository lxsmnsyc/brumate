import { toTypeScript } from 'brumate';
import { SpanMapKind } from './protocol.ts';
import type { PositionEncoding, SpanMapping, TransformResult } from './protocol.ts';

export type * from './protocol.ts';
export { SpanMapKind };

export const EXTENSION = '.brm';

/** The prefix of the codes of the mapper's diagnostics. */
export const DIAGNOSTIC_SOURCE = 'BRM';

/** The code of a syntax error in a `.brm` file. */
export const SYNTAX_ERROR = 1;

/** The UTF-8 bytes of a UTF-16 unit. A surrogate pair takes 4 bytes, counted at its first unit. */
function utf8Size(unit: number): number {
  if (unit < 0x80) {
    return 1;
  }
  if (unit < 0x800) {
    return 2;
  }
  if (unit >= 0xd800 && unit < 0xdc00) {
    return 4;
  }
  return unit >= 0xdc00 && unit < 0xe000 ? 0 : 3;
}

/** Converts string indices of a text to offsets in an encoding. */
function offsets(text: string, encoding: PositionEncoding): (index: number) => number {
  if (encoding === 'utf-16' || !/[\u0080-\uffff]/.test(text)) {
    return (index) => index;
  }
  const bytes = new Uint32Array(text.length + 1);
  for (let index = 0; index < text.length; index++) {
    bytes[index + 1] = bytes[index]! + utf8Size(text.charCodeAt(index));
  }
  return (index) => bytes[index]!;
}

/**
 * Turns a `.brm` file into the TypeScript that checks it, with the spans
 * that map it back to the file. A file with a syntax error gives only its
 * scripts, and the error as a diagnostic.
 */
export function mapBrm(
  fileName: string,
  content: string,
  encoding: PositionEncoding = 'utf-16',
): TransformResult {
  const { code, mappings, error } = toTypeScript(content, fileName);
  const original = offsets(content, encoding);
  const generated = offsets(code, encoding);
  const result: TransformResult = {
    text: code,
    extension: '.ts',
    mappings: mappings.map((mapping): SpanMapping => {
      const generatedEnd = mapping.generated + mapping.length;
      const originalEnd = mapping.source + mapping.length;
      // Copied code is the same text. Other code stands for the range, such as a brace for a tag.
      const kind =
        content.slice(mapping.source, originalEnd) === code.slice(mapping.generated, generatedEnd)
          ? SpanMapKind.Verbatim
          : SpanMapKind.Atom;
      const virtualStart = generated(mapping.generated);
      const originalStart = original(mapping.source);
      return [
        virtualStart,
        generated(generatedEnd) - virtualStart,
        originalStart,
        original(originalEnd) - originalStart,
        kind,
      ];
    }),
  };
  if (error) {
    const start = Math.min(error.offset, content.length);
    const end = Math.min(start + 1, content.length);
    result.diagnostics = [
      {
        messageText: error.message.replace(/ \([^()]*:\d+:\d+\)$/, ''),
        start: original(start),
        length: original(end) - original(start),
        code: SYNTAX_ERROR,
      },
    ];
  }
  return result;
}
