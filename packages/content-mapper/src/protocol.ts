// The messages of the content mapper protocol of TypeScript 7.1. TypeScript
// sends each request over the standard input, and the mapper answers on the
// standard output. Offsets count in the encoding that `initialize` picks.

export type PositionEncoding = 'utf-8' | 'utf-16';

export interface InitializeParams {
  positionEncodings: PositionEncoding[];
  locale?: string;
}

export interface InitializeResult {
  positionEncoding: PositionEncoding;
  /** The prefix of the codes of the mapper's diagnostics, as in `BRM1`. */
  diagnosticSource: string;
}

export interface TransformParams {
  fileName: string;
  content: string;
  projectHandle: string;
}

/** How the positions in a span of the TypeScript map to the span of the file. */
export const SpanMapKind = {
  /** The same text, so each position maps to the same position. */
  Verbatim: 0,
  /** Other text, which maps to the span as a whole. */
  Atom: 1,
} as const;

/** `[virtualStart, virtualLength, originalStart, originalLength, kind]`. */
export type SpanMapping = [number, number, number, number, number];

export interface MapperDiagnostic {
  messageText: string;
  start: number;
  length: number;
  code: number;
}

export interface TransformResult {
  text: string;
  extension: '.ts';
  mappings: SpanMapping[];
  diagnostics?: MapperDiagnostic[];
}
