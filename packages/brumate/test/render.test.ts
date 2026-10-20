import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { renderToStream, renderToString } from '../src/runtime/server.ts';
import type { Context } from '../src/runtime/server.ts';

const input = new URL('./render/', import.meta.url);
const output = new URL('./.output/render/', import.meta.url);

const props: Record<string, unknown> = {
  counter: {},
  todos: {
    initial: [
      { id: '1', title: 'Write the docs', done: true, at: new Date('2026-10-01T00:00:00Z') },
      { id: '2', title: 'Build <the> compiler', done: false, at: new Date('2026-10-20T00:00:00Z') },
    ],
  },
  parent: {},
  blocks: { items: ['one', 'two'], tab: 'b' },
  list: {},
  loading: {},
  shared: {},
  styled: {},
  portal: {},
  produce: {},
  prefetch: {},
  retry: {},
  search: {},
  doubler: {},
};

// Compiled as the Vite plugin does, with the props that parents can change.
const sources = new Map(
  readdirSync(input)
    .filter((name) => name.endsWith('.brm'))
    .map((name) => [name, readFileSync(new URL(name, input), 'utf8')]),
);
const liveProps = analyzeProject(sources);

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const name of readdirSync(input)) {
    if (name.endsWith('.brm')) {
      const { server } = compile(sources.get(name)!, {
        filename: name,
        liveProps: liveProps.get(name),
      });
      writeFileSync(new URL(`${name}.ts`, output), server.replace(/\.brm'/g, ".brm.ts'"));
    } else {
      copyFileSync(new URL(name, input), new URL(name, output));
    }
  }
});

describe('server render', () => {
  it.each(Object.keys(props))('%s', async (name) => {
    const source = readFileSync(new URL(`${name}.brm`, input), 'utf8');
    const filename = `${name}.brm`;
    const { server, client, parts, render } = compile(source, {
      filename,
      liveProps: liveProps.get(filename),
    });
    const module = await import(new URL(`${name}.brm.ts`, output).href);
    const { html, state } = await renderToString(module.default, props[name]);
    const text = [
      '# Server module',
      server,
      '# Client entry',
      client,
      ...Object.entries(parts).flatMap(([part, code]) => [`# Client part: ${part}`, code]),
      '# Render module',
      render,
      '# HTML',
      html.replace(/></g, '>\n<'),
      '',
      '# State',
      state,
      '',
    ].join('\n');
    await expect(text).toMatchFileSnapshot(`./__snapshots__/render/${name}.txt`);
  });
});

describe('streaming', () => {
  it('does not wait for promises in the state', async () => {
    let settle!: (value: string) => void;
    const promise = new Promise<string>((done) => {
      settle = done;
    });
    const Root = async (_props: unknown, ctx: Context): Promise<string> => {
      const scope = ctx.scope(1, undefined, 'Test');
      ctx.slots(scope, [promise]);
      return '<p>Hi</p>';
    };
    const scripts = '<script type="module" async src="/client.js"></script>';
    const reader = renderToStream(
      Root,
      {},
      { start: '<body>', scripts, end: '</body>' },
    ).getReader();

    const first = await reader.read();
    expect(first.value).toMatch(
      /^<body><p>Hi<\/p><script type="brumate\/state" data-scopes>.*<\/script>/,
    );
    expect(first.value!.endsWith(scripts)).toBe(true);

    settle('later');
    const second = await reader.read();
    expect(second.value).toMatch(/^<script type="brumate\/state">.*later/);
    expect((await reader.read()).value).toBe('</body>');
    expect((await reader.read()).done).toBe(true);
  });

  it('returns from renderToString before promises settle', async () => {
    const promise = new Promise<string>(() => {});
    const Root = async (_props: unknown, ctx: Context): Promise<string> => {
      ctx.slots(ctx.scope(1, undefined, 'Test'), [promise]);
      return '<p>Hi</p>';
    };
    const result = await renderToString(Root, {});
    expect(result.html).toBe('<p>Hi</p>');
    expect(result.state).toBeDefined();
  });
});

describe('#loading', () => {
  it('streams the body after the fallback', async () => {
    const module = await import(new URL('loading.brm.ts', output).href);
    const reader = renderToStream(module.default, {}).getReader();

    const first = (await reader.read()).value!;
    expect(first).toContain('<p class="fallback">Loading</p>');
    expect(first).not.toContain('greeting');

    module.release('Ada');
    let rest = '';
    // oxlint-disable-next-line no-await-in-loop -- Chunks arrive in order.
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      rest += chunk.value;
    }
    expect(rest).toMatch(/^<template data-l="0"><p class="greeting">Hello Ada<\/p>/);
    expect(rest).toContain('<script type="brumate/state" data-scopes>');
    expect(rest).toMatch(/<script>function \$bS\(i\)\{.*\$bS\(0\)<\/script>$/);
  });

  it('puts a nonce on the swap scripts', async () => {
    const module = await import(new URL('loading.brm.ts', output).href);
    module.release('Ada');
    const { pending } = await renderToString(module.default, {}, { nonce: 'a"b' });
    let rest = '';
    for await (const chunk of pending) {
      rest += chunk;
    }
    expect(rest).toContain('<script nonce="a&quot;b">function $bS(i)');
  });
});
