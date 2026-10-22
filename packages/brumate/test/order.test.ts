import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { toJSON } from 'seroval';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../src/index.ts';
import {
  RequestEvent,
  getEvent,
  handleRequest,
  inlineBodies,
  render,
  renderToStream,
} from '../src/runtime/server.ts';

const input = new URL('./render/', import.meta.url);
const output = new URL('./.output/order/', import.meta.url);

beforeAll(() => {
  mkdirSync(output, { recursive: true });
  for (const name of ['loading', 'deferred']) {
    const { server } = compile(readFileSync(new URL(`${name}.brm`, input), 'utf8'), {
      filename: `${name}.brm`,
    });
    writeFileSync(new URL(`${name}.brm.ts`, output), server);
  }
});

// oxlint-disable-next-line typescript/no-explicit-any -- The compiled modules are loaded at runtime.
const load = (name: string): Promise<any> => import(new URL(`${name}.brm.ts`, output).href);

describe('rendering in order', () => {
  it('writes a #loading body in place of its fallback, with no template and no swap', async () => {
    const module = await load('loading');
    const rendered = render(module.default, {}, { inOrder: true });
    module.release('Ada');
    const { html, state, pending } = await rendered;
    expect(html).toContain('<p class="greeting">Hello Ada</p>');
    expect(html).not.toContain('fallback');
    expect(html).not.toContain('<!--l');
    expect(html).not.toContain('<template');
    // The state of the body follows the page state, as when it streams.
    expect(state.match(/<script b-state b-scopes/g)).toHaveLength(2);
    expect(state).not.toContain('$bS');
    expect(await pending[Symbol.asyncIterator]().next()).toEqual({ done: true, value: undefined });
  });

  it('does it for a crawler by default, and streams for a browser', async () => {
    const module = await load('loading');
    module.release('Ada');
    const crawler = new Request('http://localhost/', {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    });
    expect((await render(module.default, {}, { request: crawler })).html).toContain('Hello Ada');
    const browser = new Request('http://localhost/', {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Firefox/140.0' },
    });
    const streamed = await render(module.default, {}, { request: browser });
    expect(streamed.html).toContain('class="fallback"');
    // A function decides for each request.
    const chosen = await render(module.default, {}, { request: browser, inOrder: () => true });
    expect(chosen.html).toContain('Hello Ada');
  });

  it('renders a #defer body with the page, and drops its template', async () => {
    const module = await load('deferred');
    const request = new Request('http://localhost/', { headers: { 'x-user': 'Ada' } });
    const { html } = await render(module.default, {}, { request, inOrder: true });
    expect(html).toContain('<p class="greeting">Hello Ada</p>');
    expect(html).not.toContain('b-defer');
    expect(html).not.toContain('fallback');
  });

  it('keeps the fallback of a body that fails, and puts nested bodies in place', () => {
    const html = '<a></a><!--l0-->wait<!--l0.0-->inner<!--/l--><!--/l--><!--l1-->kept<!--/l-->';
    const bodies = new Map([
      ['0', '<b><!--l0.1-->x<!--/l--></b>'],
      ['0.1', '<i>deep</i>'],
    ]);
    expect(inlineBodies(html, bodies)).toBe('<a></a><b><i>deep</i></b><!--l1-->kept<!--/l-->');
  });
});

describe('cancelled work', () => {
  it('aborts the signal of the event when the request aborts', () => {
    const controller = new AbortController();
    const event = new RequestEvent(new Request('http://localhost/', { signal: controller.signal }));
    expect(event.signal.aborted).toBe(false);
    controller.abort();
    expect(event.signal.aborted).toBe(true);
  });

  it('aborts the signal when the reader of a page leaves while it streams', async () => {
    const module = await load('loading');
    const event = new RequestEvent(new Request('http://localhost/'));
    const reader = renderToStream(module.default, {}, { event, inOrder: false }).getReader();
    expect((await reader.read()).value).toContain('class="fallback"');
    await reader.cancel();
    expect(event.signal.aborted).toBe(true);
    // The body that was still loading is not sent.
    module.release('Ada');
  });

  it('aborts the signal of a call when its reader leaves', async () => {
    let signal: AbortSignal | undefined;
    let finish!: (value: string) => void;
    const response = await handleRequest(
      {
        stream: () => {
          signal = getEvent().signal;
          return {
            done: new Promise<string>((resolve) => {
              finish = resolve;
            }),
          };
        },
      },
      new Request('http://localhost/_brumate/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toJSON([])),
      }),
    );
    const reader = response!.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(signal?.aborted).toBe(true);
    finish('late');
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
  });
});
