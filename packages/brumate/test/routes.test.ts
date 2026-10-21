import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { findFiles, defaultExclude } from '../src/files.ts';
import { routeFiles, routeModule, routePaths, routeTypes } from '../src/routes.ts';
import { href as typedHref } from '../src/runtime/routes.ts';

// routes.check.ts declares a few routes for the whole test program. These tests use others.
const href = typedHref as (path: string, params?: Record<string, string>) => string;
import type { RouteFiles } from '../src/routes.ts';
import { handleRoute, matchRoute } from '../src/runtime/server.ts';
import type { Loader, RouteNode } from '../src/runtime/server.ts';

const input = new URL('./routes/', import.meta.url);
const output = new URL('./.output/routes/', import.meta.url);

let tree: RouteNode;

/** Imports the compiled module of a route file. */
function load(file: string | undefined): Loader | undefined {
  return file ? () => import(new URL(`${file}.ts`, output).href) : undefined;
}

/** Imports a `.ts` route file, such as an endpoint or middleware, as it is. */
function plain<T>(file: string | undefined): (() => Promise<T>) | undefined {
  return file ? () => import(new URL(file, output).href) as Promise<T> : undefined;
}

/** Turns the file tree into loaders of the compiled modules. */
function loaders(node: RouteFiles): RouteNode {
  const map = (children: Record<string, RouteFiles> | undefined) =>
    children &&
    Object.fromEntries(Object.entries(children).map(([name, value]) => [name, loaders(value)]));
  return {
    layout: load(node.layout),
    page: load(node.page),
    fallback: load(node.fallback),
    error: load(node.error),
    loading: load(node.loading),
    middleware: plain(node.middleware),
    endpoint: plain(node.endpoint),
    static: map(node.static),
    slots: map(node.slots),
    dynamic: node.dynamic && { name: node.dynamic.name, node: loaders(node.dynamic.node) },
    rest: node.rest && { name: node.rest.name, node: loaders(node.rest.node) },
  };
}

let paths: string[];

beforeAll(async () => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(input, output, { recursive: true });
  const root = new URL('.', input).pathname.replace(/\/$/, '');
  paths = (await findFiles(root, defaultExclude)).map((file) => file.slice(root.length + 1));
  const sources = new Map(paths.map((file) => [file, readFileSync(new URL(file, input), 'utf8')]));
  // Endpoints and middleware are `.ts` files, imported as they are.
  for (const file of readdirSync(input, { recursive: true, encoding: 'utf8' })) {
    if (file.endsWith('.ts') && file !== 'theme.ts') {
      paths.push(file);
    }
  }
  // No parent passes props to a route, so `children`, the slots and `params` do not change.
  const liveProps = analyzeProject(sources);
  for (const [file, source] of sources) {
    const { server } = compile(source, { filename: file, liveProps: liveProps.get(file) });
    writeFileSync(new URL(`${file}.ts`, output), server.replace(/\.brm'/g, ".brm.ts'"));
  }
  tree = loaders(routeFiles(paths));
});

async function raw(
  path: string,
  status = 200,
  headers: Record<string, string> = {},
): Promise<string> {
  const response = await handleRoute(tree, new Request(`http://localhost${path}`, { headers }));
  expect(response?.status).toBe(status);
  expect(response?.headers.get('content-type')).toBe('text/html; charset=utf-8');
  return response!.text();
}

/** The page without the comments that mark route slots. */
async function page(path: string, status = 200): Promise<string> {
  return (await raw(path, status)).replace(/<!--\/?R[^>]*-->/g, '');
}

describe('route files', () => {
  it('builds the tree from the file names', () => {
    expect(routeFiles(paths)).toEqual({
      layout: '_layout.brm',
      page: 'index.brm',
      error: '_error.brm',
      middleware: '_middleware.ts',
      rest: { name: 'rest', node: { page: '[...rest].brm' } },
      static: {
        api: {
          middleware: 'api/_middleware.ts',
          dynamic: { name: 'name', node: { endpoint: 'api/[name].ts' } },
          static: { time: { endpoint: 'api/time.ts' } },
        },
        old: { page: 'old.brm' },
        private: { page: 'private/index.brm' },
        slow: { loading: 'slow/_loading.brm', page: 'slow/index.brm' },
        todos: {
          layout: 'todos/_layout.brm',
          error: 'todos/_error.brm',
          static: { broken: { page: 'todos/broken.brm' } },
          dynamic: { name: 'id', node: { page: 'todos/[id].brm' } },
        },
      },
      slots: {
        sidebar: {
          fallback: '@sidebar/_default.brm',
          static: { todos: { dynamic: { name: 'id', node: { page: '@sidebar/todos/[id].brm' } } } },
        },
      },
    });
  });

  it('writes the tree as a module', () => {
    const code = routeModule(routeFiles(['index.brm', 'todos/[id].brm']), (file) => `/r/${file}`);
    expect(code).toContain('import * as m0 from "/r/index.brm";');
    expect(code).toContain('import * as m1 from "/r/todos/[id].brm";');
    expect(code).toContain('page: () => Promise.resolve(m0)');
    expect(code).toContain('dynamic: { name: "id", node: { page: () => Promise.resolve(m1) } }');
  });

  it('rejects two dynamic segments in one folder', () => {
    expect(() => routeFiles(['[a].brm', '[b].brm'])).toThrow(/\[a\] and \[b\]/);
  });
});

describe('matching', () => {
  it('prefers a fixed segment over a dynamic one, and a dynamic one over the rest', () => {
    expect(matchRoute(tree, '/')?.params).toEqual({});
    expect(matchRoute(tree, '/todos/3')?.params).toEqual({ id: '3' });
    expect(matchRoute(tree, '/todos/3/edit')?.params).toEqual({ rest: 'todos/3/edit' });
    expect(matchRoute(tree, '/a%20b')?.params).toEqual({ rest: 'a b' });
  });

  it('does not match without a page', () => {
    expect(matchRoute({ static: { a: {} } }, '/a')).toBeUndefined();
  });
});

describe('rendering', () => {
  it('renders a page inside its layouts, with the slots of the same path', async () => {
    const html = await page('/todos/3');
    expect(html.startsWith('<!doctype html><html')).toBe(true);
    expect(html).toContain('<nav><p>Editing 3</p></nav>');
    // The layout of the folder wraps the page, and the root layout provides the theme to it.
    expect(html).toMatch(
      /<main><section class="todos"><h1 class="dark"[^>]*>Todo 3<\/h1><\/section><\/main>/,
    );
    expect(html).toContain('<title>Todo 3</title>');
  });

  it('renders the default of a slot when its routes do not match', async () => {
    const html = await page('/');
    expect(html).toContain('<nav><p>Menu</p></nav><main><h1>Home</h1></main>');
  });

  it('matches the rest of the path, with the status that the page sets', async () => {
    expect(await page('/a/b', 404)).toContain('<h1>No page at a/b</h1>');
  });

  it('answers with a redirect that a page throws', async () => {
    const response = await handleRoute(tree, new Request('http://localhost/old'));
    expect(response?.status).toBe(303);
    expect(response?.headers.get('location')).toBe('http://localhost/todos/1');
  });

  it('marks each slot with its layout scope, its route scope and its route key', async () => {
    const html = await raw('/todos/3');
    const key = encodeURIComponent;
    // The root layout is scope 0, so its slots name it.
    expect(html).toContain(
      `<nav><!--R0:sidebar:1:${key('/@sidebar/todos/[id]/index {"id":"3"}')}--><p>`,
    );
    expect(html).toMatch(
      new RegExp(`<main><!--R0:children:\\d+:${key('/todos/_layout {}')}--><section`),
    );
    // The route of the page is on the state, so the client can compare it with the next page.
    expect(html).toContain(`data-route="/_layout {}"`);
  });

  it('starts IDs above the base that the client sends', async () => {
    const html = await raw('/todos/3', 200, { 'x-brumate-base': '40' });
    expect(html).toContain('<!--R40:sidebar:41:');
  });

  it('returns undefined when no route matches', async () => {
    expect(
      await handleRoute({ page: tree.page }, new Request('http://localhost/x')),
    ).toBeUndefined();
  });
});

describe('error and loading files', () => {
  it('renders the nearest error file inside the layouts above it', async () => {
    const html = await page('/todos/broken', 410);
    expect(html).toContain(
      '<section class="todos"><p class="todos-error">Todos failed: Gone for good</p></section>',
    );
    // The root layout still renders around it.
    expect(html).toContain('<nav>');
  });

  it('renders the root error file with 404 when no route matches', async () => {
    const response = await handleRoute(
      { layout: tree.layout, error: tree.error, page: tree.page },
      new Request('http://localhost/nothing/here'),
    );
    expect(response?.status).toBe(404);
    expect(await response!.text()).toContain('<h1 class="root-error">Error 404: Not found</h1>');
  });

  it('answers 404 to a path with a malformed escape', async () => {
    const response = await handleRoute(
      { layout: tree.layout, error: tree.error, page: tree.page },
      new Request('http://localhost/%E0'),
    );
    expect(response?.status).toBe(404);
  });

  it('streams a route in after its loading file', async () => {
    const module = await import(new URL('slow/index.brm.ts', output).href);
    const response = await handleRoute(tree, new Request('http://localhost/slow'));
    const reader = response!.body!.pipeThrough(new TextDecoderStream()).getReader();
    const first = (await reader.read()).value!;
    expect(first).toContain('<p class="loading">Loading slow</p>');
    expect(first).not.toContain('Slow content');
    module.release();
    let rest = '';
    // oxlint-disable-next-line no-await-in-loop -- Chunks arrive in order.
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      rest += chunk.value;
    }
    expect(rest).toMatch(/<template data-l="\d+"><p class="slow">Slow content<\/p><\/template>/);
  });
});

describe('endpoints and middleware', () => {
  it('answers with the handler of the method', async () => {
    const response = await handleRoute(tree, new Request('http://localhost/api/time'));
    expect(await response!.json()).toEqual({ time: 42 });
    const posted = await handleRoute(
      tree,
      new Request('http://localhost/api/time', { method: 'POST' }),
    );
    expect(await posted!.text()).toBe('posted from /api/time');
  });

  it('passes the params of the path', async () => {
    const response = await handleRoute(tree, new Request('http://localhost/api/ada'));
    expect(await response!.text()).toBe('hello ada');
  });

  it('answers 405 to a method that the endpoint does not export', async () => {
    const response = await handleRoute(
      tree,
      new Request('http://localhost/api/time', { method: 'DELETE' }),
    );
    expect(response?.status).toBe(405);
    expect(response?.headers.get('allow')).toBe('GET, POST');
  });

  it('runs the middleware of each folder on the path, from the outside in', async () => {
    const api = await handleRoute(tree, new Request('http://localhost/api/time'));
    expect(api?.headers.get('x-api')).toBe('yes');
    const blocked = await handleRoute(tree, new Request('http://localhost/private'));
    expect(blocked?.status).toBe(401);
    expect(await blocked!.text()).toBe('Sign in first');
  });
});

describe('typed routes', () => {
  const files = routeFiles([
    '_layout.brm',
    'index.brm',
    '_error.brm',
    'todos/index.brm',
    'todos/[id].brm',
    'todos/[id]/edit.brm',
    'docs/[...path].brm',
    'api/hello.ts',
    '@aside/index.brm',
    'todos/_middleware.ts',
  ]);

  it('lists the paths of pages and endpoints, with their params', () => {
    expect(routePaths(files)).toEqual([
      { path: '/', params: [] },
      { path: '/api/hello', params: [] },
      { path: '/docs/[...path]', params: ['path'] },
      { path: '/todos', params: [] },
      { path: '/todos/[id]', params: ['id'] },
      { path: '/todos/[id]/edit', params: ['id'] },
    ]);
  });

  it('writes them into Routes of brumate/routes', () => {
    expect(routeTypes(files)).toContain(
      "declare module 'brumate/routes' {\n  interface Routes {\n    '/': {};",
    );
    expect(routeTypes(files)).toContain("    '/todos/[id]/edit': { id: string };");
  });

  it('puts params into a path, and keeps the slashes of a rest param', () => {
    expect(href('/todos/[id]/edit', { id: 'a b' })).toBe('/todos/a%20b/edit');
    expect(href('/docs/[...path]', { path: 'guide/routing' })).toBe('/docs/guide/routing');
    expect(href('/')).toBe('/');
    expect(() => href('/todos/[id]', {})).toThrow('The param id of /todos/[id] is missing');
  });
});
