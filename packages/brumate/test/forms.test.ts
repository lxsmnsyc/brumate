import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../src/index.ts';
import { handleRequest, render } from '../src/runtime/server.ts';

const source = readFileSync(new URL('./forms/guestbook.brm', import.meta.url), 'utf8');
const output = new URL('./.output/forms/', import.meta.url);
// oxlint-disable-next-line typescript/no-explicit-any -- The compiled module is loaded at runtime.
let guestbook: any;
let compiled: ReturnType<typeof compile>;

beforeAll(async () => {
  mkdirSync(output, { recursive: true });
  compiled = compile(source, { filename: 'guestbook.brm' });
  writeFileSync(new URL('guestbook.brm.ts', output), compiled.server);
  guestbook = await import(new URL('guestbook.brm.ts', output).href);
});

const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
afterAll(() => errors.mockRestore());

/** Posts a form to a server function, as a browser without client code does. */
function post(name: string, data: Record<string, string>): Promise<Response | undefined> {
  const fn = Object.keys(guestbook.rpc).find((key) => key.endsWith(`#${name}`))!;
  return handleRequest(
    guestbook.rpc,
    new Request(`http://localhost/_brumate/${encodeURIComponent(fn)}`, {
      method: 'POST',
      headers: { referer: 'http://localhost/guestbook' },
      body: new URLSearchParams(data),
    }),
  );
}

describe('forms', () => {
  it('posts a form to a server function', async () => {
    const { html } = await render(guestbook.default, {});
    const fn = (name: string) =>
      encodeURIComponent(Object.keys(guestbook.rpc).find((key) => key.endsWith(`#${name}`))!);
    expect(html).toContain(`<form class="sign" action="/_brumate/${fn('sign')}" method="post">`);
    // A button can post to another server function.
    expect(html).toContain(
      `<button class="clear" formaction="/_brumate/${fn('clear')}" formmethod="post">`,
    );
    // A method on the element is kept.
    expect(html).toContain(`<form class="get" action="/_brumate/${fn('sign')}" method="get">`);
  });

  it('uses the prefix of the render', async () => {
    const { html } = await render(guestbook.default, {}, { rpc: '/api' });
    expect(html).toMatch(/<form class="sign" action="\/api\//);
  });

  it('renders the action in a form that the client renders', () => {
    expect(compiled.render).toMatch(/\$\$b\.action\("action", "Guestbook_\w+#sign", "method"\)/);
  });

  it('calls the function with the form data and sends the browser back', async () => {
    const response = await post('sign', { name: 'Ada' });
    expect(response?.status).toBe(303);
    expect(response?.headers.get('location')).toBe('http://localhost/guestbook');
    expect(guestbook.entries).toEqual(['Ada']);
  });

  it('follows a redirect in the function', async () => {
    const response = await post('clear', {});
    expect(response?.status).toBe(303);
    expect(response?.headers.get('location')).toBe('/cleared');
    expect(guestbook.entries).toEqual([]);
  });

  it('answers with the message of a ServerError', async () => {
    const response = await post('sign', {});
    expect(response?.status).toBe(422);
    expect(await response?.text()).toBe('A name is needed');
  });
});
