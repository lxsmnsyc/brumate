import { describe, expect, it } from 'vitest';
import { render } from '../../src/runtime/server.ts';
import type { Context } from '../../src/runtime/server.ts';

async function Styled(_props: object, ctx: Context): Promise<string> {
  return `${ctx.style('Card_1', 'p{color:red}')}<p>Hi</p>`;
}

describe('the nonce of component styles', () => {
  it('puts the render nonce on the style element', async () => {
    const { html } = await render(Styled, {}, { nonce: 'a"b' });
    expect(html).toContain('<style nonce="a&quot;b" b-style="Card_1">');
  });

  it('writes no nonce attribute without a nonce', async () => {
    const { html } = await render(Styled, {}, {});
    expect(html).toContain('<style b-style="Card_1">');
    expect(html).not.toContain('nonce');
  });
});
