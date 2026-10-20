import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { renderToStream, renderToString, stateScript } from '../src/runtime/server.ts';
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
};

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const name of readdirSync(input)) {
    if (name.endsWith('.brm')) {
      const source = readFileSync(new URL(name, input), 'utf8');
      const { server } = compile(source, { filename: name });
      writeFileSync(new URL(`${name}.ts`, output), server.replace(/\.brm'/g, ".brm.ts'"));
    } else {
      copyFileSync(new URL(name, input), new URL(name, output));
    }
  }
});

describe('server render', () => {
  it.each(Object.keys(props))('%s', async (name) => {
    const source = readFileSync(new URL(`${name}.brm`, input), 'utf8');
    const { server, client, render } = compile(source, { filename: `${name}.brm` });
    const module = await import(new URL(`${name}.brm.ts`, output).href);
    const { html, state } = await renderToString(module.default, props[name]);
    const text = [
      '# Server module',
      server,
      '# Client module',
      client,
      '# Render module',
      render,
      '# HTML',
      html.replace(/></g, '>\n<'),
      '',
      '# State',
      stateScript(state),
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
    expect(first.value).toMatch(/^<body><p>Hi<\/p><script type="brumate\/state">.*<\/script>/);
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
