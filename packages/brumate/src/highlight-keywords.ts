// Sorted longest first by the compiler, so `else if` beats `else`.
// It lives in its own file, so the public entry does not export it. A test checks
// the list against the keywords of the parser.
export const BLOCK_KEYWORDS: string[] = [
  'if',
  'else if',
  'else',
  'for',
  'repeat',
  'switch',
  'case',
  'default',
  'try',
  'catch',
  'loading',
  'portal',
  'head',
  'client',
  'offscreen',
  'reveal',
  'defer',
  'key',
  'template',
];
