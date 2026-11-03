// @vitest-environment happy-dom
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../src/index.ts';
import { render } from '../src/runtime/server.ts';
import { readParam, writeParam } from '../src/runtime/search-params.ts';

const output = resolve(import.meta.dirname, '.output/search-params');
const modules = new Map<string, string>();
const file = (name: string): string => pathToFileURL(join(output, name)).href;

const FILTER = `<script>
  import { $searchParam, $bind, $route } from 'brumate/signals';

  let query = $searchParam('q', { default: '' });
  let page = $searchParam('page', { default: 1, parse: Number });
  let tab = $searchParam('tab', { history: 'push' });
  let sort = $searchParam('sort', { default: 'new', server: true });
  const route = $route();

  function more() {
    page += 1;
    query = query + '!';
  }
</script>

<input class="query" value=$bind(query)>
<p class="page">{page}</p>
<p class="tab">{tab ?? 'none'}</p>
<p class="search">{route.search.toString()}</p>
<button class="more" onClick=more>More</button>
<button class="sort" onClick=(() => (sort = 'old'))>Old</button>
<button class="tab-b" onClick=(() => (tab = 'b'))>B</button>`;

/** Rewrites the imports of compiled modules to the files that the test writes. */
function toFile(code: string): string {
  return code
    .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
    .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"');
}

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const {
    server,
    client,
    parts,
    render: browser,
    plan,
  } = compile(FILTER, { filename: 'Filter.brm' });
  for (const [part, code] of Object.entries(parts)) {
    writeFileSync(join(output, `Filter.brm.client.${part}.ts`), toFile(code));
  }
  writeFileSync(join(output, 'Filter.brm.ts'), server.replace(/\.brm'/g, ".brm.ts'"));
  writeFileSync(join(output, 'Filter.brm.client.ts'), toFile(client));
  writeFileSync(join(output, 'Filter.brm.render.ts'), toFile(browser));
  modules.set(plan.id, file('Filter.brm.client.ts'));
});

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
  history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});

function text(selector: string): string {
  return document.querySelector(selector)!.textContent!;
}

/** Renders the page for a URL, shows it and starts the loader. */
async function resume(url: string): Promise<void> {
  const server = await import(file('Filter.brm.ts'));
  const { html, state } = await render(
    server.default,
    {},
    { request: new Request(`http://localhost${url}`) },
  );
  history.replaceState(null, '', url);
  document.body.innerHTML = html + state;
  for (const script of document.body.querySelectorAll('script[b-state]')) {
    Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
    // oxlint-disable-next-line no-eval -- The test DOM does not run scripts, so the state record runs here.
    (0, eval)(script.textContent!);
  }
  delete (document as { currentScript?: unknown }).currentScript;
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({ load: (id) => import(modules.get(id)!) });
}

describe('$searchParam', () => {
  it('reads and writes the text of a parameter', () => {
    const search = new URLSearchParams('page=3&q=a');
    expect(readParam(search, 'q', { default: '' })).toBe('a');
    expect(readParam(search, 'page', { default: 1, parse: Number })).toBe(3);
    expect(readParam(search, 'tab')).toBeNull();
    expect(readParam(search, 'tab', { default: 'a' })).toBe('a');
    // The default leaves the parameter out.
    expect(writeParam(1, { default: 1 })).toBeNull();
    expect(writeParam(2, { default: 1 })).toBe('2');
    expect(writeParam(null)).toBeNull();
    expect(writeParam([1, 2], { serialize: (value) => (value as number[]).join('-') })).toBe('1-2');
  });

  it('renders the value of the URL on the server', async () => {
    const server = await import(file('Filter.brm.ts'));
    const { html } = await render(
      server.default,
      {},
      { request: new Request('http://localhost/list?q=cats&page=4') },
    );
    expect(html).toContain('<p class="page"');
    expect(html).toContain('cats');
    expect(html).toMatch(/>4</);
    expect(html).toContain('none');
  });

  it('writes the URL with replaceState and asks the server nothing', async () => {
    await resume('/list?q=cats');
    const fetched = vi.fn<() => void>();
    vi.stubGlobal('fetch', fetched);
    const entries = history.length;
    const push = vi.spyOn(history, 'pushState');
    document
      .querySelector<HTMLButtonElement>('.more')!
      .dispatchEvent(new Event('click', { bubbles: true }));
    // Two writes of one handler make one change of the URL.
    const replace = vi.spyOn(history, 'replaceState');
    await vi.waitFor(() => expect(location.search).toBe('?q=cats%21&page=2'), { timeout: 5000 });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(history.length).toBe(entries);
    expect(fetched).not.toHaveBeenCalled();
    expect(text('.page')).toBe('2');
    // `$route().search` reads what `$searchParam` wrote.
    expect(text('.search')).toBe('q=cats%21&page=2');
  });

  it('adds an entry to the history with push, and leaves the default out', async () => {
    await resume('/list?page=2');
    const entries = history.length;
    document
      .querySelector<HTMLButtonElement>('.tab-b')!
      .dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(location.search).toBe('?page=2&tab=b'), { timeout: 5000 });
    expect(history.length).toBe(entries + 1);
    expect(text('.tab')).toBe('b');
  });

  it('writes the signal when the history moves', async () => {
    await resume('/list?q=cats');
    const fetched = vi.fn<() => void>();
    vi.stubGlobal('fetch', fetched);
    // Reading the page starts the core with the first event.
    document
      .querySelector<HTMLButtonElement>('.tab-b')!
      .dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(location.search).toBe('?q=cats&tab=b'), { timeout: 5000 });
    history.replaceState(null, '', '/list?q=dogs&page=5&tab=b');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect(text('.page')).toBe('5'), { timeout: 5000 });
    expect((document.querySelector('.query') as HTMLInputElement).value).toBe('dogs');
    expect(text('.search')).toBe('q=dogs&page=5&tab=b');
    expect(fetched).not.toHaveBeenCalled();
  });

  it('asks the server for the page when the parameter says so', async () => {
    await resume('/list');
    const fetched = vi.fn<() => Promise<Response>>(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetched);
    document
      .querySelector<HTMLButtonElement>('.sort')!
      .dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(fetched).toHaveBeenCalled(), { timeout: 5000 });
    expect(String((fetched.mock.calls[0] as unknown[])[0])).toContain('sort=old');
  });

  it('loads the page when the history moves another parameter', async () => {
    await resume('/list');
    const fetched = vi.fn<() => Promise<Response>>(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetched);
    history.replaceState(null, '', '/list?other=1');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect(fetched).toHaveBeenCalled(), { timeout: 5000 });
  });

  it('stays on the page for a change of the hash after a write', async () => {
    await resume('/list');
    const fetched = vi.fn<() => Promise<Response>>(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetched);
    document
      .querySelector<HTMLButtonElement>('.tab-b')!
      .dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(location.search).toBe('?tab=b'), { timeout: 5000 });
    history.replaceState(null, '', '/list?tab=b#top');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((done) => setTimeout(done, 50));
    expect(fetched).not.toHaveBeenCalled();
  });
});

describe('$searchParam declarations', () => {
  it.each([
    ['const', "const q = $searchParam('q');"],
    ['a name that is not a string', 'let q = $searchParam(name);'],
    ['a call in a function', "function f() { let q = $searchParam('q'); }"],
  ])('rejects %s', (_, line) => {
    const source = `<script>\n  import { $searchParam } from 'brumate/signals';\n  const name = 'q';\n  ${line}\n</script>\n<p>{typeof q}</p>`;
    expect(() => compile(source, { filename: 'Bad.brm' })).toThrow(/./);
  });
});
