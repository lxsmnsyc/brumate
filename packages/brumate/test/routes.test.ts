import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { findFiles, defaultExclude } from '../src/files.ts';
import { routeFiles, routeModule } from '../src/routes.ts';
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

/** Turns the file tree into loaders of the compiled modules. */
function loaders(node: RouteFiles): RouteNode {
  const map = (children: Record<string, RouteFiles> | undefined) =>
    children &&
    Object.fromEntries(Object.entries(children).map(([name, value]) => [name, loaders(value)]));
  return {
    layout: load(node.layout),
    page: load(node.page),
    fallback: load(node.fallback),
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
      rest: { name: 'rest', node: { page: '[...rest].brm' } },
      static: {
        old: { page: 'old.brm' },
        todos: {
          layout: 'todos/_layout.brm',
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
    expect(code).toContain('page: () => import("/r/index.brm")');
    expect(code).toContain(
      'dynamic: { name: "id", node: { page: () => import("/r/todos/[id].brm") } }',
    );
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
