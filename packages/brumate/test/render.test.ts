import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { render as renderParts, renderToStream } from '../src/runtime/server.ts';
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
  themes: {},
  Themed: {},
  fields: {},
  'uses-counter': {},
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
        path: fileURLToPath(new URL(name, input)),
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
      path: fileURLToPath(new URL(filename, input)),
    });
    const module = await import(new URL(`${name}.brm.ts`, output).href);
    const { html, state } = await renderParts(module.default, props[name]);
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
      /^<body><p>Hi<\/p><script type="brumate\/state" data-scopes data-next="1">.*<\/script>/,
    );
    // `end` is part of the first render too.
    expect(first.value!.endsWith(`${scripts}</body>`)).toBe(true);

    settle('later');
    const second = await reader.read();
    expect(second.value).toMatch(/^<script type="brumate\/state">.*later/);
    expect((await reader.read()).done).toBe(true);
  });

  it('returns from render before promises settle', async () => {
    const promise = new Promise<string>(() => {});
    const Root = async (_props: unknown, ctx: Context): Promise<string> => {
      ctx.slots(ctx.scope(1, undefined, 'Test'), [promise]);
      return '<p>Hi</p>';
    };
    const result = await renderParts(Root, {});
    expect(result.html).toBe('<p>Hi</p>');
    expect(result.state).toBeDefined();
  });
});

/** Reads the rest of a stream, chunk by chunk. */
async function readAll(
  source: ReadableStream<string> | ReadableStreamDefaultReader<string>,
): Promise<string[]> {
  const reader = 'getReader' in source ? source.getReader() : source;
  const chunks: string[] = [];
  // oxlint-disable-next-line no-await-in-loop -- Chunks arrive in order.
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    chunks.push(chunk.value);
  }
  return chunks;
}

describe('documents', () => {
  const scripts = '<script type="module" async src="/client.js"></script>';

  it('renders a complete document', async () => {
    const module = await import(`${new URL('document.brm.ts', output).href}?string`);
    module.release('Ada');
    const page = (await readAll(renderToStream(module.default, {}, { scripts }))).join('');
    expect(page.startsWith('<!doctype html><html')).toBe(true);
    // The stylesheet and the title go into the head.
    const head = page.slice(page.indexOf('<head'), page.indexOf('</head>'));
    expect(head).toContain('<style data-brm=');
    expect(head).toContain('<title>Count 0</title>');
    // The state, the scripts and the portal are part of the first render, before </body>.
    const body = page.slice(page.indexOf('<body'), page.indexOf('</body>'));
    expect(body).toMatch(/<script type="brumate\/state" data-scopes data-next="\d+">/);
    expect(body).toContain(scripts);
    expect(body).toMatch(/<p [^>]*class="note">Portal<\/p>/);
    // The #loading body resolves later, so it follows the document.
    const later = page.slice(page.indexOf('</html>'));
    expect(later).toMatch(/<template data-l="0"><p [^>]*class="greeting">Hello Ada<\/p>/);
  });

  it('streams a complete document with renderToStream', async () => {
    const module = await import(`${new URL('document.brm.ts', output).href}?stream`);
    const reader = renderToStream(module.default, {}, { scripts }).getReader();
    const first = (await reader.read()).value!;
    // The first render is a whole document, sent before anything resolves.
    expect(first.startsWith('<!doctype html><html')).toBe(true);
    expect(first).toMatch(/<p [^>]*class="fallback">Loading<\/p>/);
    expect(first.endsWith(`${scripts}</body></html>`)).toBe(true);
    module.release('Ada');
    const chunks = await readAll(reader);
    // The body follows when it resolves.
    expect(chunks[0]).toMatch(/<p [^>]*class="greeting">Hello Ada<\/p>/);
  });
});

describe('head', () => {
  it('collects the title and #head blocks', async () => {
    const module = await import(new URL('page.brm.ts', output).href);
    const { head, html } = await renderParts(module.default, {});
    expect(head).toMatch(
      /^<title>Count 0 &lt;<\/title><!--P\d+--><meta name="description" content="Clicked 0 times"/,
    );
    expect(html).not.toContain('<meta');

    const reader = renderToStream(
      module.default,
      {},
      { start: (markup) => `<head>${markup}</head><body>` },
    ).getReader();
    expect((await reader.read()).value).toMatch(/^<head><title>Count 0 &lt;<\/title>/);
  });
});

describe('#loading', () => {
  it('streams the body after the fallback', async () => {
    const module = await import(new URL('loading.brm.ts', output).href);
    const reader = renderToStream(module.default, {}).getReader();

    const first = (await reader.read()).value!;
    expect(first).toMatch(/<p [^>]*class="fallback">Loading<\/p>/);
    expect(first).not.toContain('greeting');

    module.release('Ada');
    let rest = '';
    // oxlint-disable-next-line no-await-in-loop -- Chunks arrive in order.
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      rest += chunk.value;
    }
    expect(rest).toMatch(/^<template data-l="0"><p class="greeting">Hello Ada<\/p>/);
    expect(rest).toMatch(/<script type="brumate\/state" data-scopes data-next="\d+">/);
    expect(rest).toMatch(/<script>function \$bS\(i\)\{.*\$bS\(0\)<\/script>$/);
  });

  it('puts a nonce on the swap scripts', async () => {
    const module = await import(new URL('loading.brm.ts', output).href);
    module.release('Ada');
    const { pending } = await renderParts(module.default, {}, { nonce: 'a"b' });
    let rest = '';
    for await (const chunk of pending) {
      rest += chunk;
    }
    expect(rest).toContain('<script nonce="a&quot;b">function $bS(i)');
  });
});

describe('memos that read memos', () => {
  it('does not wait for a memo that only a #loading body reads, through another memo', async () => {
    const module = await import(new URL('loadingChain.brm.ts', output).href);
    // render resolves while the user is still loading.
    const { html, pending } = await renderParts(module.default, {});
    expect(html).toMatch(/<p class="fallback">Loading<\/p>/);
    expect(html).not.toContain('ADA');
    module.release('Ada');
    let rest = '';
    for await (const chunk of pending) {
      rest += chunk;
    }
    expect(rest).toMatch(/<p class="label">(<!--t\d+:0-->)?ADA(<!--\/t-->)?<\/p>/);
  });
});
