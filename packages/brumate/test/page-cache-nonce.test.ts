import { afterEach, describe, expect, it } from 'vitest';
import { memoryStore, setCacheStore } from '../src/runtime/cache.ts';
import { getEvent } from '../src/runtime/request.ts';
import { handleRoute } from '../src/runtime/server.ts';

let renders = 0;

/** What a page writes with the nonce of its render, and where. */
type Leak = 'none' | 'meta' | 'text' | 'header';

/** A page that writes an inline script with the nonce of its render, as a component does. */
function page(leak: Leak) {
  return Object.assign(
    async () => {
      renders++;
      const event = getEvent();
      const { nonce } = event;
      // Written as the render writes it: escaped for an attribute.
      const attribute = nonce === undefined ? '' : ` nonce="${nonce.replaceAll('&', '&amp;')}"`;
      let extra = '';
      if (nonce !== undefined && leak === 'meta') {
        extra = `<meta http-equiv="content-security-policy" content="script-src 'nonce-${nonce}'">`;
      } else if (nonce !== undefined && leak === 'text') {
        extra = `<script${attribute}>var n = "${nonce}"</script>`;
      } else if (nonce !== undefined && leak === 'header') {
        event.headers.set('x-nonce', nonce);
      }
      return `<h1>Hi</h1>${extra}<script${attribute}>1</script>`;
    },
    { brumateId: `Page_nonce_${leak}` },
  );
}

async function html(
  leak: Leak,
  nonce?: string,
): Promise<{ body: string; hit: boolean; headers: Headers }> {
  const routes = { page: async () => ({ default: page(leak), cache: { maxAge: 60 } }) };
  const response = await handleRoute(routes as never, new Request('https://example.com/'), {
    nonce,
  });
  return {
    body: await response!.text(),
    hit: response!.headers.get('x-brumate-cache') === 'hit',
    headers: response!.headers,
  };
}

afterEach(() => {
  renders = 0;
  setCacheStore(memoryStore());
});

describe('a page that the server kept', () => {
  it('gets the nonce of the request that it is served to', async () => {
    const first = await html('none', 'one');
    expect(first.hit).toBe(false);
    expect(first.body).toContain('<script nonce="one">1</script>');

    const second = await html('none', 'two');
    // The page is served from the store, not rendered again.
    expect(second.hit).toBe(true);
    expect(renders).toBe(1);
    expect(second.body).toContain('<script nonce="two">1</script>');
    expect(second.body).toContain(' nonce="two" b-state');
    expect(second.body).not.toContain('one');
  });

  it('loses the nonce when the request has none', async () => {
    await html('none', 'one');
    const second = await html('none');
    expect(second.hit).toBe(true);
    expect(second.body).toContain('<script>1</script>');
    expect(second.body).not.toContain('nonce=');
    expect(second.body).not.toContain('one');
  });

  it('is rendered again for a request with a nonce when it was kept without one', async () => {
    await html('none');
    const second = await html('none', 'two');
    expect(second.hit).toBe(false);
    expect(renders).toBe(2);
    expect(second.body).toContain('<script nonce="two">1</script>');
  });

  it('takes a nonce with a dollar sign as text', async () => {
    const odd = ['n$&x', "a$'b", 'c$`d', 'e$$f', '$1'];
    await html('none', odd[0]);
    for (const nonce of odd) {
      const answer = await html('none', nonce);
      expect(answer.hit).toBe(true);
      // The page is not duplicated, and the old nonce is gone.
      expect(answer.body.match(/<h1>/g)).toHaveLength(1);
      expect(answer.body).toContain(`<script nonce="${nonce.replaceAll('&', '&amp;')}">1</script>`);
    }
    expect(renders).toBe(1);
    // The first nonce does not stay on a request with another.
    const last = await html('none', 'plain');
    expect(last.body).not.toContain('n$');
  });
});

describe('a page with its nonce outside a nonce attribute', () => {
  it.each(['meta', 'text', 'header'] as const)(
    'is not kept when the nonce is in %s',
    async (leak) => {
      await html(leak, 'one');
      const second = await html(leak, 'two');
      // A copy of the first nonce would stay, so the page renders again.
      expect(second.hit).toBe(false);
      expect(renders).toBe(2);
      expect(second.body).not.toContain('one');
      expect(second.headers.get('x-nonce') ?? 'two').toBe('two');
    },
  );
});
