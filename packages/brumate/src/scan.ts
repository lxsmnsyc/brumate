import type { Fail } from './error.ts';

export function isWhitespace(char: string | undefined): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}

export function isIdentifierStart(char: string | undefined): boolean {
  if (char === undefined) {
    return false;
  }
  return /[A-Za-z_$]/.test(char) || char.charCodeAt(0) > 127;
}

export function isIdentifierPart(char: string | undefined): boolean {
  if (char === undefined) {
    return false;
  }
  return /[\w$]/.test(char) || char.charCodeAt(0) > 127;
}

/** Reads an identifier at `start`. Returns an empty string if there is none. */
export function readIdentifier(source: string, start: number): string {
  if (!isIdentifierStart(source[start])) {
    return '';
  }
  let end = start + 1;
  while (isIdentifierPart(source[end])) {
    end++;
  }
  return source.slice(start, end);
}

const CLOSERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

// Keywords after which a `/` starts a regular expression, not a division.
const REGEXP_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);

/** Returns the offset after the quote that closes the string at `start`. */
export function skipString(source: string, start: number, fail: Fail): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') {
      i += 2;
    } else if (char === quote) {
      return i + 1;
    } else if (char === '\n') {
      break;
    } else {
      i++;
    }
  }
  return fail('Unterminated string', start);
}

/** Returns the offset after the backtick that closes the template literal at `start`. */
export function skipTemplate(source: string, start: number, fail: Fail): number {
  let i = start + 1;
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') {
      i += 2;
    } else if (char === '`') {
      return i + 1;
    } else if (char === '$' && source[i + 1] === '{') {
      i = skipBalanced(source, i + 1, fail);
    } else {
      i++;
    }
  }
  return fail('Unterminated template literal', start);
}

/** Returns the offset after the flags of the regular expression at `start`. */
export function skipRegExp(source: string, start: number, fail: Fail): number {
  let i = start + 1;
  let inClass = false;
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') {
      i += 2;
      continue;
    }
    if (char === '\n') {
      break;
    }
    if (char === '[') {
      inClass = true;
    } else if (char === ']') {
      inClass = false;
    } else if (char === '/' && !inClass) {
      i++;
      while (isIdentifierPart(source[i])) {
        i++;
      }
      return i;
    }
    i++;
  }
  return fail('Unterminated regular expression', start);
}

/**
 * Returns the offset after a comment at `start`, or `start` if there is no
 * comment there.
 */
export function skipComment(source: string, start: number, fail: Fail): number {
  if (source[start] !== '/') {
    return start;
  }
  if (source[start + 1] === '/') {
    const end = source.indexOf('\n', start);
    return end === -1 ? source.length : end;
  }
  if (source[start + 1] === '*') {
    const end = source.indexOf('*/', start + 2);
    if (end === -1) {
      fail('Unterminated comment', start);
    }
    return end + 2;
  }
  return start;
}

/**
 * Returns the offset after the bracket that closes the one at `start`. Skips
 * strings, template literals, regular expressions and comments.
 */
export function skipBalanced(source: string, start: number, fail: Fail): number {
  const stack: string[] = [];
  let i = start;
  let regExpAllowed = true;
  while (i < source.length) {
    const char = source[i];
    if (char === '"' || char === "'") {
      i = skipString(source, i, fail);
      regExpAllowed = false;
    } else if (char === '`') {
      i = skipTemplate(source, i, fail);
      regExpAllowed = false;
    } else if (char === '/') {
      const end = skipComment(source, i, fail);
      if (end !== i) {
        i = end;
      } else if (regExpAllowed) {
        i = skipRegExp(source, i, fail);
        regExpAllowed = false;
      } else {
        i++;
        regExpAllowed = true;
      }
    } else if (char in CLOSERS) {
      stack.push(CLOSERS[char]);
      i++;
      regExpAllowed = true;
    } else if (char === ')' || char === ']' || char === '}') {
      if (stack.pop() !== char) {
        fail(`Unexpected "${char}"`, i);
      }
      i++;
      if (stack.length === 0) {
        return i;
      }
      regExpAllowed = char === '}';
    } else if (isIdentifierPart(char)) {
      let end = i + 1;
      while (isIdentifierPart(source[end])) {
        end++;
      }
      regExpAllowed = REGEXP_KEYWORDS.has(source.slice(i, end));
      i = end;
    } else if (isWhitespace(char)) {
      i++;
    } else {
      regExpAllowed = true;
      i++;
    }
  }
  return fail(`Expected "${stack.at(-1) ?? ''}"`, start);
}

/**
 * Finds `word` in `code` outside brackets, strings and comments. Returns its
 * offset, or -1.
 */
export function findTopLevel(code: string, word: string, fail: Fail): number {
  let i = 0;
  while (i < code.length) {
    const char = code[i];
    if (char === '"' || char === "'") {
      i = skipString(code, i, fail);
    } else if (char === '`') {
      i = skipTemplate(code, i, fail);
    } else if (char === '/' && skipComment(code, i, fail) !== i) {
      i = skipComment(code, i, fail);
    } else if (char in CLOSERS) {
      i = skipBalanced(code, i, fail);
    } else if (code.startsWith(word, i)) {
      const isWord = isIdentifierPart(word[0]);
      if (!isWord || (!isIdentifierPart(code[i - 1]) && !isIdentifierPart(code[i + word.length]))) {
        return i;
      }
      i += word.length;
    } else if (isIdentifierPart(char)) {
      while (isIdentifierPart(code[i])) {
        i++;
      }
    } else {
      i++;
    }
  }
  return -1;
}
