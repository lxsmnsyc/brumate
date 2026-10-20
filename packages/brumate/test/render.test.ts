import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { renderToString, stateScript } from '../src/runtime/server.ts';

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
    const { server, client } = compile(source, { filename: `${name}.brm` });
    const module = await import(new URL(`${name}.brm.ts`, output).href);
    const { html, state } = await renderToString(module.default, props[name]);
    const text = [
      '# Server module',
      server,
      '# Client module',
      client,
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
