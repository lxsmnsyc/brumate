import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { attribute } from '../src/runtime/html.ts';
import { insert, render as renderParts, renderToStream } from '../src/runtime/server.ts';
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
  retry: {},
  search: {},
  doubler: {},
  themes: {},
  Themed: {},
  fields: {},
  'uses-counter': {},
  'template-update': {},
  offscreen: {},
  clientElse: {},
  deferred: {},
  memos: {},
  compact: {
    initial: [
      { id: '1', label: 'One', note: '' },
      { id: '2', label: 'Two', note: 2 },
    ],
  },
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
        // The class of the serial entry of the tests, `render/money.ts`.
        sendableClasses: ['Money'],
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

describe('#offscreen', () => {
  it('renders a visible body as usual, and leaves out one that is hidden', async () => {
    const module = await import(new URL('offscreen.brm.ts', output).href);
    const shown = (await renderParts(module.default, { first: 'a' })).html;
    const hidden = (await renderParts(module.default, { first: 'b' })).html;
    // The marker of the block says whether the body rendered: 1 when it did, -1 when it did not.
    expect(shown).toContain('<!--b0:6:1--><template');
    expect(shown).toContain('<section b-c-1oupne3 class="panel-a flex">');
    expect(shown).toContain('<!--b0:7:-1--><!--/b-->');
    expect(shown).toContain('<aside b-c-1oupne3 class="portal-a">');
    // Nothing of the hidden body is in the page, not even its portal or its components.
    expect(hidden).toContain('<!--b0:6:-1--><!--/b-->');
    expect(hidden).not.toContain('panel-a');
    expect(hidden).not.toContain('portal-a');
    expect(hidden).not.toContain('class="child"');
    expect(hidden).toContain('<!--b0:7:1--><section b-c-1oupne3 class="panel-b">');
    // Neither has a hidden element: the server renders only what shows.
    expect(shown).not.toContain('display: none');
    expect(hidden).not.toContain('display: none');
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
      /^<body><p>Hi<\/p><script b-state b-scopes b-next="1">function \$bR[^]*<\/script>/,
    );
    // `end` is part of the first render too.
    expect(first.value!.endsWith(`${scripts}</body>`)).toBe(true);

    settle('later');
    const second = await reader.read();
    expect(second.value).toMatch(/^<script b-state>\$bR\([^]*later/);
    expect((await reader.read()).done).toBe(true);
  });

  it('has nothing pending for a page without promises or #loading bodies, and closes the stream', async () => {
    const module = await import(new URL('counter.brm.ts', output).href);
    const { pending } = await renderParts(module.default, {});
    expect(await pending[Symbol.asyncIterator]().next()).toEqual({ done: true, value: undefined });
    const reader = renderToStream(module.default, {}).getReader();
    expect((await reader.read()).value).toContain('b-state');
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

  it('inserts values that are ready without a promise', async () => {
    expect(insert('<a>')).toBe('&lt;a&gt;');
    expect(insert(['a', 1, null])).toBe('a1');
    expect(await insert(['a', Promise.resolve('b')])).toBe('ab');
  });

  it('renders a complete document', async () => {
    const module = await import(`${new URL('document.brm.ts', output).href}?string`);
    module.release('Ada');
    const page = (await readAll(renderToStream(module.default, {}, { scripts }))).join('');
    expect(page.startsWith('<!doctype html><html')).toBe(true);
    // The tag names its attributes, so client navigation can tell them from those of scripts.
    expect(page).toMatch(/^<!doctype html><html [^>]*lang="en" b-html="[^"]*\blang\b[^"]*">/);
    // The stylesheet and the title go into the head.
    const head = page.slice(page.indexOf('<head'), page.indexOf('</head>'));
    expect(head).toContain('<style b-style=');
    expect(head).toContain('<title>Count 0</title>');
    // The state, the scripts and the portal are part of the first render, before </body>.
    const body = page.slice(page.indexOf('<body'), page.indexOf('</body>'));
    expect(body).toMatch(/<script b-state b-scopes b-next="\d+">/);
    expect(body).toContain(scripts);
    expect(body).toMatch(/<p [^>]*class="note">Portal<\/p>/);
    // The #loading body resolves later, so it follows the document.
    const later = page.slice(page.indexOf('</html>'));
    expect(later).toMatch(/<template b-l="0"><p [^>]*class="greeting">Hello Ada<\/p>/);
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
    expect(rest).toMatch(/^<template b-l="0"><p class="greeting">Hello Ada<\/p>/);
    // The body moves in first, then its record runs, and the core reads its scopes.
    expect(rest).toMatch(
      /<script>function \$bS\(i\)\{.*\$bS\(0\)<\/script><script b-state b-scopes b-next="\d+">\$bR\([^]*<\/script>$/,
    );
  });

  it('puts a nonce on the swap scripts and the state records', async () => {
    const module = await import(new URL('loading.brm.ts', output).href);
    module.release('Ada');
    const { pending } = await renderParts(module.default, {}, { nonce: 'a"b' });
    let rest = '';
    for await (const chunk of pending) {
      rest += chunk;
    }
    expect(rest).toContain('<script nonce="a&quot;b">function $bS(i)');
    expect(rest).toContain('<script nonce="a&quot;b" b-state b-scopes');
  });

  it('puts the nonce on the page state', async () => {
    const module = await import(new URL('loading.brm.ts', output).href);
    const { state } = await renderParts(module.default, {}, { nonce: 'n1' });
    expect(state).toMatch(/^<script nonce="n1" b-state b-scopes b-next="\d+">function \$bR/);
  });
});

/** Renders a page whose #try body adds to the page before it throws. */
async function renderRollback(): Promise<{ html: string; head: string; rest: string }> {
  const module = await import(new URL('tryRollback.brm.ts', output).href);
  const { html, head, pending } = await renderParts(module.default, {});
  let rest = '';
  for await (const chunk of pending) {
    rest += chunk;
  }
  return { html, head, rest };
}

describe('#try', () => {
  it('leaves the scopes of a body that threw out of the state', async () => {
    const module = await import(new URL('tryChild.brm.ts', output).href);
    const { html, state } = await renderParts(module.default, {});
    expect(html).toContain('<p class="gone"');
    expect(html).not.toContain('broken');
    // The client would resume the component, and update markup that was never sent.
    expect(state).not.toContain('Broken_');
  });

  it('sends a stylesheet of a body that threw with the next component that needs it', async () => {
    const { html } = await renderRollback();
    // The body counted the stylesheet as sent, so the #catch and the sibling left it out.
    expect(html.match(/<style/g)).toHaveLength(1);
    expect(html.indexOf('<style')).toBeLessThan(html.indexOf('class="shout"'));
  });

  it('leaves out the #portal markup of a body that threw', async () => {
    const { html } = await renderRollback();
    expect(html).not.toContain('portaled');
  });

  it('leaves out the #head markup and the title of a body that threw', async () => {
    const { head } = await renderRollback();
    expect(head).not.toContain('failed');
    expect(head).not.toContain('<title>');
  });

  it('does not stream the #loading bodies of a body that threw', async () => {
    const { html, rest } = await renderRollback();
    expect(html).not.toContain('<!--l');
    // The boundary has no markers in the page, so nothing would swap it in.
    expect(rest).not.toContain('late');
    expect(rest).not.toContain('$bS');
  });
});

describe('await', () => {
  it('starts every memo of a run before it waits, and renders a #loading body in place', async () => {
    const module = await import(new URL('awaited.brm.ts', output).href);
    const render = renderParts(module.default, {});
    let done = false;
    void render.then(() => {
      done = true;
    });
    await Promise.resolve();
    // The two memos of the run load at the same time. The third, without the keyword, waits for the run.
    expect(module.calls).toEqual(['first', 'second']);
    module.release('second', 'Grace');
    module.release('first', 'Ada');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(module.calls).toEqual(['first', 'second', 'third']);
    expect(done).toBe(false);
    module.release('third', 'Alan');
    const { html, state, pending } = await render;
    expect(html).toContain('<p class="names">Ada Grace</p>');
    // The body is in the page, in the ID space of its boundary, with no fallback and no markers.
    expect(html).toContain('<p class="third">Alan <!--t0.0:0-->0 users<!--/t--></p>');
    expect(html).not.toContain('<!--l');
    expect(html).not.toContain('fallback');
    // Its scopes are in the page state, which is the only record.
    expect(state).toContain('"0.0":');
    expect(await pending[Symbol.asyncIterator]().next()).toEqual({ done: true, value: undefined });
  });

  it('streams a #loading body whose other memos are not ready', async () => {
    const module = await import(new URL('awaitedStream.brm.ts', output).href);
    const { html, state, pending } = await renderParts(module.default, {});
    expect(html).toContain('<p class="name">Ada</p>');
    expect(html).toContain('<!--l0--><p class="fallback">Loading</p><!--/l-->');
    // The page state is one record: nothing in it loads.
    expect(state).toContain('b-next="1"');
    module.release(['one', 'two']);
    let rest = '';
    for await (const chunk of pending) {
      rest += chunk;
    }
    expect(rest).toContain('<template b-l="0"><p class="tags">Ada: one, two</p></template>');
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

  it('gives a function that the markup calls the memos that only it reads', async () => {
    const module = await import(new URL('memoInFunction.brm.ts', output).href);
    const { html } = await renderParts(module.default, {});
    expect(html).toContain('data-sends');
    const pending = await renderParts(module.default, { isPending: true });
    expect(pending.html).toContain('data-plain');
  });
});

// The values of the elements in classes.brm, in order, as the runtime gets them.
function classValues(a: unknown, b: unknown, c: unknown): unknown[] {
  return [
    { one: a },
    { one: a, 'two-x': b, three: c },
    { '&<"x>': a, y: b },
    ['base', { on: a, off: !a }, 'tail'],
    // oxlint-disable-next-line no-sparse-arrays -- A hole renders nothing.
    [{ on: a }, 'a&b', [{ deep: b }, ''], , 'x  y'],
    {},
    { on: a, off: !a },
    { on: a, off: !a, c },
    { 1: a, z: b },
    { z: b },
  ];
}

describe('literal class values', () => {
  it.each([
    [true, true, true],
    [false, 0, ''],
    ['yes', null, 1],
    [0, 'b', undefined],
  ])('renders as the runtime renders the value, for %j %j %j', async (a, b, c) => {
    const module = await import(new URL('classes.brm.ts', output).href);
    const { html } = await renderParts(module.default, { a, b, c });
    const classes = [...html.matchAll(/<(?:i|button)( class="[^"]*")?/g)].map(
      (match) => match[1] ?? '',
    );
    expect(classes).toEqual(classValues(a, b, c).map((value) => attribute('class', value)));
  });
});
