// @vitest-environment happy-dom
// Raw HTML that the page printed is left out of the page state and read back from the page. Each
// way that the browser renders a block again from such a value must give the same HTML as a page
// whose state holds the value (`printed: false`).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { getFeatures } from '../src/features.ts';

const input = resolve(import.meta.dirname, 'state-dedupe');
const output = resolve(import.meta.dirname, '.output/state-dedupe');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();
const results = new Map<string, ReturnType<typeof compile>>();

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const sources = new Map<string, string>();
  for (const name of readdirSync(input)) {
    if (name.endsWith('.brm')) {
      sources.set(name, readFileSync(join(input, name), 'utf8'));
    } else {
      copyFileSync(join(input, name), join(output, name));
    }
  }
  const liveProps = analyzeProject(sources);
  for (const [name, source] of sources) {
    const result = compile(source, {
      filename: name,
      liveProps: liveProps.get(name),
      path: join(input, name),
    });
    results.set(name, result);
    const { server, client, parts, render, plan } = result;
    for (const [part, code] of Object.entries(parts)) {
      writeFileSync(join(output, `${name}.client.${part}.ts`), toRender(code));
    }
    writeFileSync(join(output, `${name}.ts`), server.replace(/\.brm'/g, ".brm.ts'"));
    writeFileSync(join(output, `${name}.client.ts`), toRender(client));
    writeFileSync(join(output, `${name}.render.ts`), toRender(render));
    modules.set(plan.id, file(`${name}.client.ts`));
  }
}, 60_000);

function toRender(code: string): string {
  return code
    .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
    .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"');
}

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function run(script: Element): void {
  Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
  try {
    // oxlint-disable-next-line no-eval -- The script is a state record from the server.
    (0, eval)(script.textContent!);
  } finally {
    delete (document as { currentScript?: unknown }).currentScript;
  }
}

/** Appends markup and runs its inline scripts in order, as a browser does while it parses. */
function append(html: string, parent: Element = document.body): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const node of Array.from(template.content.childNodes)) {
    parent.append(node);
    if (node.nodeName === 'SCRIPT' && !(node as Element).hasAttribute('type')) {
      run(node as Element);
    }
  }
}

interface Shown {
  state: string;
  html: string;
}

/** Renders a component, shows it with its records, and starts the loader. */
async function show(name: string, printed: boolean, dev = false): Promise<Shown> {
  const server = await import(file(`${name}.brm.ts`));
  const runtime = await import('../src/runtime/server.ts');
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) =>
    runtime.handleRequest(server.rpc ?? {}, new Request(`http://localhost${url}`, init)),
  );
  const { html, state, pending } = await runtime.render(server.default, {}, { printed, dev });
  append(html + state);
  for await (const chunk of pending) {
    append(chunk);
  }
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({ load: async (id) => import(modules.get(id)!) });
  return { state, html };
}

function click(selector: string): void {
  document.querySelector(selector)!.dispatchEvent(new Event('click', { bubbles: true }));
}

function waitFor(assertion: () => void): Promise<void> {
  return vi.waitFor(assertion, { timeout: 5000 });
}

function text(selector: string): string {
  return document.querySelector(selector)?.textContent ?? '';
}

/** The HTML of the page without its scripts, whose records differ by design. */
function markup(): string {
  return document.body.innerHTML.replace(/<script\b[\s\S]*?<\/script>/g, '');
}

/** The HTML of the page after each step, in a page with the dedupe and in one without. */
async function steps(
  name: string,
  printed: boolean,
  actions: [string, () => Promise<void> | void][],
): Promise<string[]> {
  (globalThis as { stamps?: number }).stamps = 0;
  await show(name, printed);
  const pages = [markup()];
  for (const [, action] of actions) {
    // oxlint-disable-next-line no-await-in-loop -- The steps run in order.
    await action();
    pages.push(markup());
  }
  stop?.();
  stop = undefined;
  document.body.innerHTML = '';
  return pages;
}

/** Waits until the client took the click: the text of a selector changed to `value`. */
function clickUntil(selector: string, target: string, value: string): () => Promise<void> {
  return async () => {
    click(selector);
    await waitFor(() => expect(text(target)).toBe(value));
  };
}

describe('raw HTML left out of the page state', () => {
  it('reads the HTML back from the page, and leaves no marker', async () => {
    const { state, html } = await show('Page', true);
    const full = await import(file('Page.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const before = await runtime.render(full.default, {}, { printed: false });
    expect(state).toContain('$b.d(');
    expect(before.state).not.toContain('$b.d(');
    expect(state.length).toBeLessThan(before.state.length - 800);
    expect(html).toMatch(/<!--d[\da-z]{4}\.0-->/);
    // The record removed the markers, so the page is the one without them.
    expect(document.body.innerHTML).not.toMatch(/<!--\/?d/);
  }, 30_000);

  it('renders the same HTML on each way a block renders again', async () => {
    const actions: [string, () => Promise<void>][] = [
      // A block that closes and opens again reads the value of its scope.
      ['#if closes', clickUntil('.show', '.if', '')],
      [
        '#if opens',
        async () => {
          click('.show');
          await waitFor(() => expect(text('.if')).toContain('alpha & more'));
        },
      ],
      ['#key', clickUntil('.key', '.k', '1')],
      // A prop of a child changes, and its `#key` renders the other prop again.
      // The same change loads a memo of a server function again, and its `#loading` body renders.
      [
        'prop, #loading reload',
        async () => {
          click('.count');
          await waitFor(() => {
            expect(text('.n')).toBe('1');
            expect(text('.t')).toBe('10');
          });
        },
      ],
      // A store from a context changes, and the reader renders the value of the context again.
      ['store from a context', clickUntil('.level', '.lv', '1')],
      // A server function refreshes the memo, and the `#loading` body renders again.
      ['refresh, #loading', clickUntil('.refresh', '.stamp', '2')],
    ];
    const deduped = await steps('Page', true, actions);
    const full = await steps('Page', false, actions);
    // One entry per step, with its name, so a failure names the step.
    const names = ['resumed'];
    for (const [name] of actions) {
      names.push(name);
    }
    const got: [string, string | undefined][] = [];
    const want: [string, string | undefined][] = [];
    for (const [step, name] of names.entries()) {
      got.push([name, deduped[step]]);
      want.push([name, full[step]]);
    }
    expect(got).toEqual(want);
    // Every block shows the HTML again.
    expect(full.at(-1)!.split('alpha &amp; more').length - 1).toBe(8 * 7);
  }, 30_000);

  it('keeps in the state the HTML that the parser would move, and renders it the same', async () => {
    const actions: [string, () => Promise<void>][] = [
      ['#if closes', clickUntil('.show', '.if', '')],
      [
        '#if opens',
        async () => {
          click('.show');
          await waitFor(() => expect(text('.if')).toContain('beta & more'));
        },
      ],
    ];
    const { state } = await show('Unclosed', true);
    // Printed in a `<span>` and a table cell first, then between markers in the `#if`.
    expect(state.match(/\$b\.d\(/g)).toHaveLength(1);
    // The unclosed `<section>` stays in the state.
    expect(state).toContain('$b.r("\\x3Csection>open');
    stop?.();
    document.body.innerHTML = '';
    const deduped = await steps('Unclosed', true, actions);
    const full = await steps('Unclosed', false, actions);
    expect(deduped).toEqual(full);
  }, 30_000);

  it('reads a later page from its own markup while the first one stays, as a navigation does', async () => {
    await show('Page', true);
    const first = document.body.innerHTML;
    const server = await import(file('Page.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    // A second root above the IDs of the page, as a navigation that keeps the layout renders.
    const region = document.createElement('main');
    document.body.append(region);
    const next = await runtime.render(server.default, {}, { base: 1000 });
    expect(next.state).toContain('$b.d(');
    append(next.html + next.state, region);
    expect(document.body.innerHTML).not.toMatch(/<!--\/?d/);
    // The kept part renders its value again, and so does the new one.
    click('.key');
    await waitFor(() => expect(text('.k')).toBe('1'));
    expect(document.body.innerHTML.startsWith(first.slice(0, 200))).toBe(true);
    const keyed = document.querySelectorAll('.keyed');
    expect(withoutIds(keyed[0]!.innerHTML).replace('>1<', '>0<')).toBe(
      withoutIds(keyed[1]!.innerHTML),
    );
    region.querySelector<HTMLElement>('.key')!.dispatchEvent(new Event('click', { bubbles: true }));
    await waitFor(() => expect(region.querySelector('.k')!.textContent).toBe('1'));
    expect(withoutIds(keyed[0]!.innerHTML)).toBe(withoutIds(keyed[1]!.innerHTML));
    expect(keyed[1]!.innerHTML.split('alpha &amp; more').length - 1).toBe(8);
  }, 30_000);
});

/** The HTML without the comments and the anchors of brumate, whose IDs differ between roots. */
function withoutIds(html: string): string {
  return html.replace(/<!--[^>]*-->/g, '').replace(/ b-b="[^"]*"/g, '');
}

describe('places where the parser may move raw HTML', () => {
  it('keeps children in the state where the component inserts them in an <a>', async () => {
    // `Link` renders `<a>{children}</a>`: the HTML in it may hold an `<a>`, which the parser moves.
    const { state, html } = await show('InChildren', true);
    expect(html).not.toContain('class="link"><!--d');
    expect(state.match(/\$b\.r\("\\x3Ch2 id=\\"alpha/g)?.length).toBeGreaterThan(0);
    stop?.();
    document.body.innerHTML = '';
    const actions: [string, () => Promise<void>][] = [
      ['#key', clickUntil('.key', '.k', '1')],
      ['#key again', clickUntil('.key', '.k', '2')],
    ];
    const deduped = await steps('InChildren', true, actions);
    const full = await steps('InChildren', false, actions);
    expect(deduped).toEqual(full);
    expect(full.at(-1)!.split('beta &amp; more').length - 1).toBe(8);
  }, 30_000);

  it('marks no raw HTML that a component prints inside a <template>', async () => {
    const { html } = await show('InTemplate', true);
    // The value prints in the template unmarked, and again in the page between markers.
    const template = /<template class="kept">([\s\S]*?)<\/template>/.exec(html)![1]!;
    expect(template).not.toContain('<!--d');
    expect(template).toContain('gamma &amp; more');
    expect(html.match(/<!--d[\da-z]{4}\.\d+-->/g)).toHaveLength(1);
    stop?.();
    document.body.innerHTML = '';
    const actions: [string, () => Promise<void>][] = [['#key', clickUntil('.key', '.k', '1')]];
    const deduped = await steps('InTemplate', true, actions);
    const full = await steps('InTemplate', false, actions);
    expect(deduped).toEqual(full);
  }, 30_000);

  it('marks no insert of a #head body, a template or an <a>, and prunes the reader then', () => {
    function features(source: string): boolean {
      return getFeatures(compile(source, { filename: 'Probe.brm' })).printed;
    }
    const script =
      "<script>\n  import { $props } from 'brumate/signals';\n  const { doc } = $props();\n</script>\n";
    expect(features(`${script}#head {\n  {doc}\n}\n<a href="/">{doc}</a>\n<p>{doc}</p>\n`)).toBe(
      false,
    );
    expect(
      features(`${script}#template show(value) {\n  {value}\n}\n<span>{show(doc)}</span>\n`),
    ).toBe(false);
    expect(features(`${script}<div>{doc}</div>\n`)).toBe(true);
    // A tag of the HTML would close these from inside the `<div>`: a `<button>`, an `<li>`.
    for (const around of [
      ['<button>', '</button>'],
      ['<ul><li>', '</li></ul>'],
      ['<dl><dd>', '</dd></dl>'],
      ['<dl><dt>', '</dt></dl>'],
      ['<nobr>', '</nobr>'],
    ]) {
      expect(features(`${script}${around[0]}<div>{doc}</div>${around[1]}\n`)).toBe(false);
    }
    expect(getFeatures(results.get('Refused.brm')!).printed).toBe(true);
    // The todos app of the benchmark prints text in a `<p>`, a `<button>` and a `<li>` only.
    const todos = resolve(import.meta.dirname, '../../../benchmarks/brumate/src');
    for (const name of ['App.brm', 'Counter.brm']) {
      expect(features(readFileSync(join(todos, name), 'utf8'))).toBe(false);
    }
  });

  it('keeps in the state the HTML whose read-back would differ', async () => {
    const { state, html } = await show('Refused', true);
    expect(html).not.toMatch(/<!--\/?d/);
    expect(state).not.toContain('$b.d(');
    expect(state).not.toContain('$bP');
    expect(state).toContain('$b.r("\\x3Cpre>\\n');
    expect(state).toContain('$b.r("\\x3Ctextarea>\\n');
    expect(state).toContain('$b.r("\\x3Clisting>\\n');
    expect(state).toContain('shadowrootmode');
    expect(state).toContain('$b.r("\\x3Cpre>\\r');
    expect(state).toContain('$b.r("\\x3Chtml>\\x3Chead>');
    expect(state).toContain('\\x3Cscript>q.textContent');
  }, 30_000);

  it('keeps the HTML in the state of a render in order, whose #catch replaces markup', async () => {
    const server = await import(file('TryCatch.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const full = await runtime.render(server.default, {}, { inOrder: true, printed: false });
    const page = await runtime.render(server.default, {}, { inOrder: true });
    expect(full.html).toMatch(/<!--b[\d.]+:\d+--><p class="caught">caught<\/p><!--\/b-->/);
    expect(page.html).toBe(full.html);
    expect(page.state).not.toContain('$b.d(');
    // Streamed, the page reads the range before the browser swaps the `#catch` body in.
    const streamed = await runtime.render(server.default, {});
    expect(streamed.html).toMatch(/<!--d[\da-z]{4}\.0-->/);
  }, 30_000);

  it('leaves no marker in a page whose state holds none of the printed values', async () => {
    const { state, html } = await show('Unused', true);
    expect(html).toContain('alpha &amp; more');
    expect(html).not.toMatch(/<!--\/?d/);
    expect(state).not.toContain('$bP');
    expect(document.body.innerHTML).not.toMatch(/<!--\/?d/);
  }, 30_000);
});

describe('tokens of printed raw HTML', () => {
  it('gives the same page the same markers, so a static build is the same each time', async () => {
    const server = await import(file('Page.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const first = await runtime.render(server.default, {}, { route: '/docs/[page] {}' });
    const second = await runtime.render(server.default, {}, { route: '/docs/[page] {}' });
    const other = await runtime.render(server.default, {}, { route: '/ui/[part] {}' });
    expect(first.html).toBe(second.html);
    expect(first.state).toBe(second.state);
    const token = /<!--d([\da-z]{4})\.0-->/;
    expect(token.exec(other.html)![1]).not.toBe(token.exec(first.html)![1]);
  });

  it('names the component in development when a range has no end', async () => {
    const server = await import(file('Page.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const { state } = await runtime.render(server.default, {}, { dev: true });
    expect(state).toMatch(/\$b\.d\("[\da-z]{4}\.0","Page_\w+"\)/);
    const { stateValues } = await import('../src/runtime/shared.ts');
    (globalThis as { $bP?: Record<string, string> }).$bP = {};
    expect(() => stateValues.d!('abcd.0', 'Page_x1')).toThrow(
      /The raw HTML that Page_x1 printed \(abcd\.0\) has no end in the page/,
    );
    expect(() => stateValues.d!('abcd.0')).toThrow('The page has no printed HTML abcd.0');
  });

  it('reads no range past the start of another, in the record and in navigation', async () => {
    const server = await import(file('Page.brm.ts'));
    const runtime = await import('../src/runtime/server.ts');
    const { state } = await runtime.render(server.default, {});
    const reader = /(\(function\(\)\{var w=document[\s\S]*?\)\(\);)\$bR\(/.exec(state)![1]!;
    const { readPrinted } = await import('../src/runtime/html.ts');
    const global = globalThis as { $bP?: Record<string, string> };
    // A start without an end, then a range. Then raw HTML that copies the range's marker.
    const page =
      '<div><!--dabcd.0--><p>lost end</p><!--dabcd.1--><p>one</p><!--/d--></div>' +
      '<div><!--dabcd.1--><p>fake</p><!--/d--></div>';
    for (const read of [
      // oxlint-disable-next-line no-eval -- The reader of a state record from the server.
      () => (0, eval)(reader),
      () => readPrinted(document.body),
    ]) {
      document.body.innerHTML = page;
      global.$bP = {};
      read();
      // The first range of a token counts.
      expect(global.$bP).toEqual({ 'abcd.1': '<p>one</p>' });
      // The start without an end stays, and `$b.d` throws for it.
      expect(document.body.innerHTML).toBe(
        '<div><!--dabcd.0--><p>lost end</p><p>one</p></div><div><p>fake</p></div>',
      );
    }
  });
});

describe('a navigation that keeps a layout', () => {
  it('reads the raw HTML of the new route from the page it fetched', async () => {
    history.replaceState(null, '', '/');
    const runtime = await import('../src/runtime/server.ts');
    const load = (name: string) => () => import(file(`${name}.brm.ts`));
    const tree = {
      layout: load('NavLayout'),
      page: load('NavA'),
      static: { b: { page: load('NavB') } },
    };
    async function answer(url: string, init?: RequestInit): Promise<Response> {
      const response = await runtime.handleRoute(
        tree as never,
        new Request(new URL(url, 'http://localhost'), init),
      );
      return response!;
    }
    const first = await (await answer('/')).text();
    // Both the layout and the route print raw HTML that their state reads back.
    expect(first.match(/<!--d[\da-z]{4}\.\d+-->/g)).toHaveLength(2);
    vi.stubGlobal('fetch', vi.fn(answer));
    append(/<body>([\s\S]*)<\/body>/.exec(first)![1]!);
    expect(document.body.innerHTML).not.toMatch(/<!--\/?d/);
    const layout = withoutIds(document.querySelector('.layout')!.innerHTML);
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: async (id) => import(modules.get(id)!) });
    document.querySelector<HTMLAnchorElement>('.go')!.click();
    await waitFor(() => expect(document.querySelector('.route.b')).not.toBeNull());
    // The test DOM does not run the state records that navigation added.
    for (const script of document.querySelectorAll('script[b-roots]')) {
      run(script);
    }
    expect(document.body.innerHTML).not.toMatch(/<!--\/?d/);
    expect(document.querySelectorAll('.layout')).toHaveLength(1);
    // The new route renders its value again, and the kept layout its own.
    click('.route-key');
    await waitFor(() => expect(text('.rk')).toBe('1'));
    expect(document.querySelector('.route')!.innerHTML.split('beta &amp; more').length - 1).toBe(8);
    click('.layout-key');
    await waitFor(() => expect(text('.lk')).toBe('1'));
    expect(withoutIds(document.querySelector('.layout')!.innerHTML).replace('>1<', '>0<')).toBe(
      layout,
    );
  }, 30_000);
});
