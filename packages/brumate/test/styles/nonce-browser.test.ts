// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { addStyle } from '../../src/runtime/client/page.ts';

describe('the nonce of styles that the browser adds', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('copies the nonce of an element that has one', () => {
    const script = document.createElement('script');
    script.nonce = 'n1';
    script.setAttribute('nonce', 'n1');
    document.body.append(script);
    addStyle('Card_1', 'p{color:red}');
    expect(document.head.querySelector<HTMLStyleElement>('style[b-style="Card_1"]')!.nonce).toBe(
      'n1',
    );
  });

  it('adds no nonce when the page has none', () => {
    addStyle('Card_1', 'p{color:red}');
    expect(document.head.querySelector('style[b-style="Card_1"]')!.hasAttribute('nonce')).toBe(
      false,
    );
  });
});
