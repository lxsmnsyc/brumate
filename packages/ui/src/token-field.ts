// The value of a TokenField: text and tokens in order, after TokenFieldValue of React Aria. It is
// an array of plain objects, so the page state holds it.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** A piece of the value of a TokenField: text, or a token whose text is its own. */
export interface TokenSegment {
  type: 'text' | 'token';
  text: string;
}

/** The text of a value, with each token as its text, as `toString` of React Aria gives it. */
export function segmentsText(segments: readonly TokenSegment[]): string {
  return segments.map((segment) => segment.text).join('');
}

/** The value with text next to text joined, and no empty text. */
export function normalize(segments: readonly TokenSegment[]): TokenSegment[] {
  const result: TokenSegment[] = [];
  for (const segment of segments) {
    if (segment.type === 'text') {
      if (segment.text === '') {
        continue;
      }
      const last = result.at(-1);
      if (last?.type === 'text') {
        result[result.length - 1] = { type: 'text', text: last.text + segment.text };
        continue;
      }
    }
    result.push({ ...segment });
  }
  return result;
}

/**
 * The value with the text that matches `pattern` made into tokens. A match becomes a token only
 * when whitespace follows it, so a word that the user is still typing stays text, as the
 * tokenizing values of React Aria do.
 */
export function tokenize(
  segments: readonly TokenSegment[],
  pattern: string | undefined,
): TokenSegment[] {
  if (!pattern) {
    return normalize(segments);
  }
  const result: TokenSegment[] = [];
  for (const segment of segments) {
    if (segment.type === 'token') {
      result.push(segment);
      continue;
    }
    const matcher = new RegExp(`(?<=^|\\s)(?:${pattern})(?=\\s)`, 'g');
    let at = 0;
    for (const match of segment.text.matchAll(matcher)) {
      result.push({ type: 'text', text: segment.text.slice(at, match.index) });
      result.push({ type: 'token', text: match[0] });
      at = match.index! + match[0].length;
    }
    result.push({ type: 'text', text: segment.text.slice(at) });
  }
  return normalize(result);
}

/** Whether two values have the same text and tokens. */
export function sameSegments(a: readonly TokenSegment[], b: readonly TokenSegment[]): boolean {
  return (
    a.length === b.length &&
    a.every((segment, index) => segment.type === b[index]!.type && segment.text === b[index]!.text)
  );
}

/** What a TokenField gives its TokenInput and its Tokens. */
export interface TokenFieldState {
  value: TokenSegment[];
  setValue: (value: TokenSegment[]) => void;
  pattern: string | undefined;
  placeholder: string | undefined;
  allowsNewlines: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  role: string;
  labelId: string;
  descriptionId: string | undefined;
}

export const TokenFieldContext: Context<TokenFieldState | null> =
  createContext<TokenFieldState | null>('brumate-ui:token-field', null);

/** What a TokenInput gives a Token: whether the selection covers it. */
export const TokenContext: Context<{ isDisabled: boolean } | null> = createContext<{
  isDisabled: boolean;
} | null>('brumate-ui:token', null);

/** The zero-width space that a TokenInput puts around each token, so the caret can sit there. */
export const EDGE = '​';

/**
 * The value that the nodes of a TokenInput hold: text nodes are text, an element with
 * `data-token` is a token whose text is in it, and a line break is a newline.
 */
export function readSegments(root: Node): TokenSegment[] {
  const segments: TokenSegment[] = [];
  const visit = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        segments.push({ type: 'text', text: (child as Text).data.replaceAll(EDGE, '') });
      } else if (child.nodeType === 1) {
        const element = child as HTMLElement;
        const token = element.getAttribute('data-token');
        if (token !== null) {
          segments.push({ type: 'token', text: token });
        } else if (element.tagName === 'BR') {
          segments.push({ type: 'text', text: '\n' });
        } else {
          // A block that the browser adds for a new line, such as a `div`.
          if (element.tagName === 'DIV' && segments.length > 0) {
            segments.push({ type: 'text', text: '\n' });
          }
          visit(element);
        }
      }
    }
  };
  visit(root);
  return normalize(segments);
}

/** Where the caret is, as the count of the characters of the value before it, or undefined. */
export function caretOffset(root: Node): number | undefined {
  const selection = root.ownerDocument?.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return undefined;
  }
  const range = selection.getRangeAt(0);
  if (!root.contains(range.endContainer)) {
    return undefined;
  }
  const before = range.cloneRange();
  before.selectNodeContents(root);
  before.setEnd(range.endContainer, range.endOffset);
  const holder = root.ownerDocument!.createElement('div');
  holder.append(before.cloneContents());
  return segmentsText(readSegments(holder)).length;
}

/** Puts the caret after `offset` characters of the value, past any token that it would split. */
export function placeCaret(root: Node, offset: number): void {
  const document = root.ownerDocument!;
  const selection = document.getSelection();
  if (!selection) {
    return;
  }
  let left = offset;
  const range = document.createRange();
  const walk = (node: Node): boolean => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const text = (child as Text).data;
        const visible = text.replaceAll(EDGE, '').length;
        if (left <= visible) {
          // The position in the node, counting the zero-width spaces before it.
          let index = 0;
          let seen = 0;
          while (index < text.length && seen < left) {
            if (text[index] !== EDGE) {
              seen++;
            }
            index++;
          }
          range.setStart(child, index);
          return true;
        }
        left -= visible;
      } else if (child.nodeType === 1) {
        const element = child as HTMLElement;
        const token = element.getAttribute('data-token');
        if (token !== null) {
          if (left < token.length) {
            range.setStartAfter(element);
            return true;
          }
          left -= token.length;
        } else if (walk(element)) {
          return true;
        }
      }
    }
    return false;
  };
  if (!walk(root)) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
