import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { toJSON } from 'seroval';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../src/index.ts';
import { routeFiles, routeModule } from '../src/routes.ts';
import { ServerError } from '../src/runtime/request.ts';
import { handleRequest, handleRoute } from '../src/runtime/server.ts';
import type { ServerErrorHandler, ServerErrorInfo } from '../src/runtime/server.ts';

const input = new URL('./render/', import.meta.url);
const output = new URL('./.output/server-on-error/', import.meta.url);

beforeAll(() => {
  mkdirSync(output, { recursive: true });
  for (const name of ['failing-defer', 'failing-loading']) {
    const { server } = compile(readFileSync(new URL(`${name}.brm`, input), 'utf8'), {
      filename: `${name}.brm`,
    });
    writeFileSync(new URL(`${name}.brm.ts`, output), server);
  }
});

// oxlint-disable-next-line typescript/no-explicit-any -- The compiled modules are loaded at runtime.
const load = (name: string): Promise<any> => import(new URL(`${name}.brm.ts`, output).href);

const logged = vi.spyOn(console, 'error');

afterEach(() => {
  logged.mockReset();
  logged.mockImplementation(() => {});
});

/** A promise that settles when `open` runs. */
function latch(): { promise: Promise<void>; open: () => void } {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

/** A server with one function, which fails with `error` once `wait` settles. */
function app(error: Error, wait?: Promise<void>) {
  return {
    async save() {
      await wait;
      throw error;
    },
  };
}

/** Posts to `save`, and answers with the status and text, with the hook of the app. */
async function answer(boom: Error, onError: ServerErrorHandler | undefined) {
  const response = await handleRequest(
    {
      save() {
        throw boom;
      },
    },
    new Request('http://localhost/_brumate/save', {
      method: 'POST',
      body: JSON.stringify(toJSON([])),
    }),
    '/_brumate',
    { onError },
  );
  return [response?.status, await response?.text()];
}

/** An `onError` that records what it gets. */
function recorder(): { onError: ServerErrorHandler; seen: [unknown, ServerErrorInfo][] } {
  const seen: [unknown, ServerErrorInfo][] = [];
  return {
    seen,
    onError(error, info) {
      seen.push([error, info]);
    },
  };
}

/** Components are plain functions with an ID, as the compiler writes them. */
function component(render: () => string | Promise<string>, id: string) {
  return Object.assign(async () => render(), { brumateId: id });
}

function failing(error: unknown, id = 'Page_1') {
  return component(() => {
    throw error;
  }, id);
}

describe('onError of the server', () => {
  it('gets a page error before _error.brm renders, and the answer stays', async () => {
    const order: string[] = [];
    const { seen } = recorder();
    const boom = new Error('page failed');
    const tree = {
      page: async () => ({ default: failing(boom) }),
      error: async () => ({
        default: component(() => {
          order.push('error page');
          return '<p>Sorry</p>';
        }, 'Error_1'),
      }),
    };
    const response = await handleRoute(tree as never, new Request('http://localhost/'), {
      onError(error, info) {
        order.push('hook');
        seen.push([error, info]);
      },
    });
    expect(response?.status).toBe(500);
    expect(await response?.text()).toContain('Sorry');
    expect(order).toEqual(['hook', 'error page']);
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]).toBe(boom);
    expect(seen[0]![1].kind).toBe('page');
    expect(seen[0]![1].event?.request.url).toBe('http://localhost/');
    expect(logged).not.toHaveBeenCalled();
  });

  it('gets an error of an endpoint, which still reaches the host', async () => {
    const { onError, seen } = recorder();
    const boom = new Error('endpoint failed');
    const tree = {
      endpoint: async () => ({
        GET() {
          throw boom;
        },
      }),
    };
    await expect(
      handleRoute(tree as never, new Request('http://localhost/'), { onError }),
    ).rejects.toBe(boom);
    expect(seen).toHaveLength(1);
    expect(seen[0]![1].kind).toBe('endpoint');
    expect(logged).not.toHaveBeenCalled();
  });

  it('gets an error of a server function call, and the client gets the generic message', async () => {
    const { onError, seen } = recorder();
    const boom = new Error('call failed');
    const response = await handleRequest(
      {
        save() {
          throw boom;
        },
      },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        body: JSON.stringify(toJSON([])),
      }),
      '/_brumate',
      { onError },
    );
    expect(response?.status).toBe(500);
    expect(await response?.json()).toEqual({ error: 'The server function failed' });
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]).toBe(boom);
    expect(seen[0]![1].kind).toBe('call');
    expect(logged).not.toHaveBeenCalled();
  });

  it('gets an error of a form post', async () => {
    const { onError, seen } = recorder();
    const boom = new Error('form failed');
    const response = await handleRequest(
      {
        save() {
          throw boom;
        },
      },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        body: new URLSearchParams({ a: 'b' }),
      }),
      '/_brumate',
      { onError },
    );
    expect(response?.status).toBe(500);
    expect(await response?.text()).toBe('The server function failed');
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]).toBe(boom);
    expect(seen[0]![1].kind).toBe('call');
  });

  it('gets an error of a form that posts to a page', async () => {
    const { onError, seen } = recorder();
    const boom = new Error('action failed');
    const tree = { page: async () => ({ default: component(() => '<p>ok</p>', 'Page_2') }) };
    const response = await handleRoute(
      tree as never,
      new Request('http://localhost/?__action=save', {
        method: 'POST',
        body: new URLSearchParams({ a: 'b' }),
      }),
      {
        onError,
        functions: {
          save() {
            throw boom;
          },
        },
      },
    );
    expect(response?.status).toBe(500);
    expect(seen).toHaveLength(1);
    expect(seen[0]![1].kind).toBe('call');
  });

  it('gets an error of a #defer body', async () => {
    const { onError, seen } = recorder();
    const module = await load('failing-defer');
    const tree = { page: async () => module };
    const ask = (at: string) =>
      handleRoute(
        tree as never,
        new Request('http://localhost/', { headers: { 'x-brumate-defer': `0 ${at}` } }),
        { onError },
      );
    const response = await ask('0:0');
    await response?.text();
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]).toEqual(new Error('defer failed'));
    expect(seen[0]![1].kind).toBe('defer');
    expect(logged).not.toHaveBeenCalled();
  });

  it('gets an error of a #loading body that fails after the response started, once', async () => {
    const { onError, seen } = recorder();
    const module = await load('failing-loading');
    const response = await handleRoute(
      { page: async () => module } as never,
      new Request('http://localhost/'),
      { onError },
    );
    expect(response?.status).toBe(200);
    expect(await response?.text()).toContain('Page');
    const errors = seen.filter(([error]) => String(error).includes('stream failed'));
    expect(errors).toHaveLength(1);
    expect(errors[0]![1].kind).toBe('stream');
    expect(logged).not.toHaveBeenCalled();
  });

  it('does not get a ServerError, which is an answer', async () => {
    const { onError, seen } = recorder();
    const tree = {
      page: async () => ({ default: failing(new ServerError('Nope', { status: 403 })) }),
      error: async () => ({ default: component(() => '<p>Sorry</p>', 'Error_1') }),
    };
    const page = await handleRoute(tree as never, new Request('http://localhost/'), { onError });
    expect(page?.status).toBe(403);
    const call = await handleRequest(
      {
        save() {
          throw new ServerError('Nope', { status: 409 });
        },
      },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        body: JSON.stringify(toJSON([])),
      }),
      '/_brumate',
      { onError },
    );
    expect(call?.status).toBe(409);
    expect(seen).toEqual([]);
    expect(logged).not.toHaveBeenCalled();
  });

  it('logs both errors when the hook throws or rejects, and answers the same', async () => {
    const hook = new Error('hook failed');
    const first = new Error('first');
    const plain = await answer(first, undefined);
    expect(logged.mock.calls).toEqual([[first]]);
    logged.mockClear();
    const second = new Error('second');
    const thrown = await answer(second, () => {
      throw hook;
    });
    expect(thrown).toEqual(plain);
    expect(logged.mock.calls).toEqual([[hook], [second]]);
    logged.mockClear();
    const third = new Error('third');
    const rejected = await answer(third, () => Promise.reject(hook));
    expect(rejected).toEqual(plain);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logged.mock.calls).toEqual([[hook], [third]]);
  });

  it('logs as before when the app has no hook', async () => {
    const boom = new Error('call failed');
    await handleRequest(
      {
        save() {
          throw boom;
        },
      },
      new Request('http://localhost/_brumate/save', {
        method: 'POST',
        body: JSON.stringify(toJSON([])),
      }),
    );
    expect(logged).toHaveBeenCalledWith(boom);
  });
});

describe('the route module', () => {
  it('reads the middleware and onError from the namespace of the entry file', () => {
    const code = routeModule(
      routeFiles(['index.brm']),
      (file) => `/r/${file}`,
      '/_brumate',
      [],
      false,
      '/src/middleware.ts',
    );
    expect(code).toContain('import * as entry from "/src/middleware.ts";');
    expect(code).toContain('const { default: middleware, onError } = { ...entry };');
  });

  it('works with a file that only exports onError, or exports it under another name', async () => {
    const only = await import('./server-on-error/only-on-error.ts');
    const renamed = await import('./server-on-error/renamed.ts');
    for (const entry of [only, renamed] as {
      default?: never;
      onError: ServerErrorHandler;
      seen: unknown[];
    }[]) {
      const boom = new Error('call failed');
      // oxlint-disable-next-line no-await-in-loop -- The requests run one after the other.
      await handleRequest(
        {
          save() {
            throw boom;
          },
        },
        new Request('http://localhost/_brumate/save', {
          method: 'POST',
          body: JSON.stringify(toJSON([])),
        }),
        '/_brumate',
        { middleware: entry.default, onError: entry.onError },
      );
      expect(entry.seen).toEqual([boom]);
    }
    expect(logged).not.toHaveBeenCalled();
  });
});

describe('apps in one process', () => {
  it('sends the errors of overlapping requests to the hook of their own app', async () => {
    const first = recorder();
    const second = recorder();
    const { promise: gate, open: release } = latch();
    const slow = new Error('slow');
    const quick = new Error('quick');
    const post = (functions: ReturnType<typeof app>, onError: ServerErrorHandler) =>
      handleRequest(
        functions,
        new Request('http://localhost/_brumate/save', {
          method: 'POST',
          body: JSON.stringify(toJSON([])),
        }),
        '/_brumate',
        { onError },
      );
    // The first request starts, the second app answers its own, and then the first fails.
    const waiting = post(app(slow, gate), first.onError);
    await post(app(quick), second.onError);
    release();
    await waiting;
    expect(first.seen.map(([error]) => error)).toEqual([slow]);
    expect(second.seen.map(([error]) => error)).toEqual([quick]);
  });

  it('counts an error again in another request', async () => {
    const { onError, seen } = recorder();
    const boom = new Error('again');
    for (let round = 0; round < 2; round++) {
      // oxlint-disable-next-line no-await-in-loop -- The requests run one after the other.
      await handleRequest(
        {
          save() {
            throw boom;
          },
        },
        new Request('http://localhost/_brumate/save', {
          method: 'POST',
          body: JSON.stringify(toJSON([])),
        }),
        '/_brumate',
        { onError },
      );
    }
    expect(seen).toHaveLength(2);
  });

  it('sends the error of a render without a request to the onError option', async () => {
    const { onError, seen } = recorder();
    const module = await load('failing-loading');
    const { render } = await import('../src/runtime/server.ts');
    const parts = await render(module.default, {}, { onError });
    for await (const chunk of parts.pending) {
      void chunk;
    }
    expect(seen.filter(([error]) => String(error).includes('stream failed'))).toHaveLength(1);
  });

  it('rethrows an endpoint error without logging it when there is no hook', async () => {
    const boom = new Error('endpoint failed');
    const tree = {
      endpoint: async () => ({
        GET() {
          throw boom;
        },
      }),
    };
    await expect(handleRoute(tree as never, new Request('http://localhost/'))).rejects.toBe(boom);
    expect(logged).not.toHaveBeenCalled();
  });
});
