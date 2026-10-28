import { describe, expect, it } from 'vitest';
import { BLOCK_KEYWORDS as highlighted } from '../src/highlight.ts';
import { BLOCK_KEYWORDS, BRANCH_KEYWORDS } from '../src/parser.ts';

describe('the block keywords of the highlighter', () => {
  it('are the keywords of the parser', () => {
    // `else if` is one keyword for the highlighter, and `else` of the parser covers it.
    const expected = [...BLOCK_KEYWORDS, ...BRANCH_KEYWORDS, 'else if'].toSorted();
    expect([...highlighted].toSorted()).toEqual(expected);
  });

  it('include reveal and defer', () => {
    expect(highlighted).toContain('reveal');
    expect(highlighted).toContain('defer');
  });
});
