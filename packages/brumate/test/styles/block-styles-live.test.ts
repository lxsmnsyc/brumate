// @vitest-environment happy-dom
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../src/index.ts';
import { render as renderParts } from '../../src/runtime/server.ts';

const output = resolve(import.meta.dirname, '../.output/block-styles-live');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();
let stop: (() => void) | undefined;

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
});

afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

/** Points imports of client parts at the files that the tests write. */
function toRender(code: string): string {
  return code
    .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
    .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"');
}

function build(name: string, source: string): void {
  const { server, client, parts, render, plan } = compile(source, {
    filename: name,
    path: join(output, name),
  });
  for (const [part, code] of Object.entries(parts)) {
    writeFileSync(join(output, `${name}.client.${part}.ts`), toRender(code));
  }
  writeFileSync(join(output, `${name}.ts`), server.replace(/\.brm'/g, ".brm.ts'"));
  writeFileSync(join(output, `${name}.client.ts`), toRender(client));
  writeFileSync(join(output, `${name}.render.ts`), toRender(render));
  modules.set(plan.id, file(`${name}.client.ts`));
}

/** Runs an inline script as a browser does, with the script as `document.currentScript`. */
function run(script: Element): void {
  Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
  try {
    // oxlint-disable-next-line no-eval -- The script is a state record from the server.
    (0, eval)(script.textContent!);
  } finally {
    delete (document as { currentScript?: unknown }).currentScript;
  }
}

/** Renders on the server, shows the page and starts the loader, which resumes it. */
async function resume(name: string, source: string, props: unknown = {}): Promise<void> {
  build(name, source);
  const server = await import(file(`${name}.ts`));
  const { html, state } = await renderParts(server.default, props);
  document.body.innerHTML = html + state;
  document.body.querySelectorAll('script[b-state]').forEach(run);
  vi.resetModules();
  const { start } = await import('../../src/runtime/loader.ts');
  stop = start({
    load: async (id) => import(modules.get(id)!),
  });
}

function waitFor(assertion: () => void): Promise<void> {
  return vi.waitFor(assertion, { timeout: 4000 });
}

function click(element: Element): void {
  element.dispatchEvent(new Event('click', { bubbles: true }));
}

/** The value of the block custom property of each `.tag`, in document order. */
function values(): string[] {
  const found: string[] = [];
  for (const element of document.querySelectorAll('.tag')) {
    const match = /--s-[\w-]+:\s*([^;]*)/.exec(element.getAttribute('style') ?? '');
    found.push(match ? match[1]!.trim() : '');
  }
  return found;
}

const list = `<script>
  import { $signal } from 'brumate/signals';
  const tags = [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
    { id: 3, name: 'c' },
  ];
</script>
#for (tag of tags by tag.id) {
  <script>
    let hovered = $signal(false);
  </script>
  <button class="tag" onClick=(() => (hovered = !hovered))>{tag.name}</button>
  <style>
    .tag { outline: \${hovered ? '2px solid' : 'none'}; }
  </style>
}`;

const rows = `<script>
  import { $signal } from 'brumate/signals';
  let tags = $signal([
    { id: 1, name: 'a', color: 'red' },
    { id: 2, name: 'b', color: 'green' },
    { id: 3, name: 'c', color: 'blue' },
  ]);
  let count = 3;
</script>
<button class="reverse" onClick=(() => (tags = [...tags].reverse()))>reverse</button>
<button class="recolor" onClick=(() => (tags = tags.map((tag) => (tag.id === 2 ? { ...tag, color: 'pink' } : tag))))>recolor</button>
<button class="add" onClick=(() => (tags = [...tags, { id: ++count, name: 'n', color: 'gold' }]))>add</button>
#for (tag of tags by tag.id) {
  <script>
    let hovered = $signal(false);
  </script>
  <button class="tag" onClick=(() => (hovered = !hovered))>{tag.name}</button>
  <style>
    .tag { color: \${tag.color}; outline: \${hovered ? '2px solid' : 'none'}; }
  </style>
}`;

/** The custom properties of each `.tag` as `name=value`, ordered by name, in document order. */
function rowVariables(): string[][] {
  const found: string[][] = [];
  for (const element of document.querySelectorAll('.tag')) {
    const own: string[] = [];
    for (const [, k, value] of (element.getAttribute('style') ?? '').matchAll(
      /--s-[\w]+-1-(\d+):\s*([^;]*)/g,
    )) {
      own.push(`${k}=${value!.trim()}`);
    }
    found.push(own.sort());
  }
  return found;
}

function names(): string[] {
  return [...document.querySelectorAll('.tag')].map((element) => element.textContent!);
}

describe('live style of a block', { timeout: 10000 }, () => {
  it('changes the variable of one row after resume, not the others', async () => {
    await resume('rowSignal.brm', list);
    expect(values()).toEqual(['none', 'none', 'none']);
    click(document.querySelectorAll('.tag')[1]!);
    await waitFor(() => expect(values()).toEqual(['none', '2px solid', 'none']));
    click(document.querySelectorAll('.tag')[1]!);
    await waitFor(() => expect(values()).toEqual(['none', 'none', 'none']));
  });

  it('keeps the value of each row when a keyed reorder moves it', async () => {
    await resume('rowReorder.brm', rows);
    click(document.querySelectorAll('.tag')[0]!);
    await waitFor(() => expect(rowVariables()[0]).toContain('1=2px solid'));
    click(document.querySelector('.reverse')!);
    await waitFor(() => expect(names()).toEqual(['c', 'b', 'a']));
    expect(rowVariables()).toEqual([
      ['0=blue', '1=none'],
      ['0=green', '1=none'],
      ['0=red', '1=2px solid'],
    ]);
    // The moved row still follows its own signal.
    click(document.querySelectorAll('.tag')[2]!);
    await waitFor(() => expect(rowVariables()[2]).toContain('1=none'));
    expect(rowVariables()[0]).toContain('1=none');
  });

  it('updates the row when a field of its item changes', async () => {
    await resume('rowItem.brm', rows);
    click(document.querySelector('.recolor')!);
    await waitFor(() =>
      expect(rowVariables()).toEqual([
        ['0=red', '1=none'],
        ['0=pink', '1=none'],
        ['0=blue', '1=none'],
      ]),
    );
  });

  it('writes the variables of a row that the browser renders, and updates it', async () => {
    await resume('rowAdded.brm', rows);
    click(document.querySelector('.add')!);
    await waitFor(() => expect(names()).toEqual(['a', 'b', 'c', 'n']));
    expect(rowVariables()[3]).toEqual(['0=gold', '1=none']);
    click(document.querySelectorAll('.tag')[3]!);
    await waitFor(() => expect(rowVariables()[3]).toEqual(['0=gold', '1=2px solid']));
    expect(rowVariables()[0]).toEqual(['0=red', '1=none']);
  });

  it('writes the variables of a branch that opens, and follows the component', async () => {
    await resume(
      'branchOpens.brm',
      `<script>
  import { $signal } from 'brumate/signals';
  let open = $signal(false);
  let color = $signal('red');
</script>
<button class="open" onClick=(() => (open = true))>open</button>
<button class="paint" onClick=(() => (color = 'blue'))>paint</button>
#if (open) {
  <p class="tag">shown</p>
  <style>
    .tag { color: \${color}; }
  </style>
}`,
    );
    expect(document.querySelector('.tag')).toBeNull();
    click(document.querySelector('.open')!);
    await waitFor(() => expect(rowVariables()).toEqual([['0=red']]));
    click(document.querySelector('.paint')!);
    await waitFor(() => expect(rowVariables()).toEqual([['0=blue']]));
  });

  it('updates the variables of two blocks on one element separately', async () => {
    await resume(
      'nested.brm',
      `<script>
  import { $signal } from 'brumate/signals';
  const tags = [{ id: 1 }, { id: 2 }];
  let color = $signal('red');
</script>
<button class="paint" onClick=(() => (color = 'blue'))>paint</button>
#for (tag of tags by tag.id) {
  <script>
    let hovered = $signal(false);
  </script>
  #if (true) {
    <style>
      .tag { color: \${color}; }
    </style>
    <button class="tag" onClick=(() => (hovered = !hovered))>x</button>
  }
  <style>
    .tag { outline: \${hovered ? '2px solid' : 'none'}; }
  </style>
}`,
    );
    const states = (): string[] =>
      [...document.querySelectorAll('.tag')].map((element) =>
        [...(element.getAttribute('style') ?? '').matchAll(/--s-\w+-\d-\d:\s*([^;]*)/g)]
          .map((match) => match[1]!.trim())
          .sort()
          .join(','),
      );
    expect(states()).toEqual(['none,red', 'none,red']);
    expect(document.querySelector('.tag')!.getAttribute('b-v')).toMatch(/^[\d.]+ [\d.]+$/);
    click(document.querySelectorAll('.tag')[0]!);
    await waitFor(() => expect(states()).toEqual(['2px solid,red', 'none,red']));
    click(document.querySelector('.paint')!);
    await waitFor(() => expect(states()).toEqual(['2px solid,blue', 'blue,none']));
  });

  it('updates 1000 rows that share one value without a document query for each', async () => {
    await resume(
      'many.brm',
      `<script>
  import { $signal } from 'brumate/signals';
  const rows = Array.from({ length: 1000 }, (_, id) => ({ id }));
  let color = $signal('red');
</script>
<button class="paint" onClick=(() => (color = 'blue'))>paint</button>
#for (row of rows by row.id) {
  <p class="tag"><b>{row.id}</b><i>a</i><i>b</i><i>c</i><i>d</i></p>
  <style>
    .tag { color: \${color}; }
  </style>
}`,
    );
    expect(document.querySelectorAll('.tag')).toHaveLength(1000);
    // Count the document queries for `b-v` carriers, so the check does not depend on load.
    const query = vi.spyOn(document, 'querySelectorAll');
    click(document.querySelector('.paint')!);
    await waitFor(() => expect(values().every((value) => value === 'blue')).toBe(true));
    let carrierQueries = 0;
    for (const [selector] of query.mock.calls) {
      if (String(selector).includes('b-v')) {
        carrierQueries++;
      }
    }
    query.mockRestore();
    expect(carrierQueries).toBeLessThanOrEqual(1);
  }, 30_000);

  it('updates an element that is the root of the component and the top level of a block', async () => {
    await resume(
      'both.brm',
      `<script>
  import { $signal } from 'brumate/signals';
  let size = $signal(1);
  let color = $signal('red');
</script>
<button class="grow" onClick=(() => (size = 2))>grow</button>
<button class="paint" onClick=(() => (color = 'blue'))>paint</button>
#if (true) {
  <p class="tag">x</p>
  <style>
    .tag { color: \${color}; }
  </style>
}
<style>
  p { margin: \${size}px; }
</style>`,
    );
    const tag = document.querySelector('.tag')!;
    const own = (): string[] =>
      [...(tag.getAttribute('style') ?? '').matchAll(/--s-\w+(-\d)?-\d:\s*([^;]*)/g)].map(
        (match) => `${match[1] ? 'block' : 'component'}=${match[2]!.trim()}`,
      );
    expect(own()).toEqual(['component=1px', 'block=red']);
    const ids = tag.getAttribute('b-v')!.split(' ');
    // The component first, then the block.
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(document.querySelector('.grow')!.getAttribute('b-v'));
    click(document.querySelector('.grow')!);
    await waitFor(() => expect(own()).toEqual(['component=2px', 'block=red']));
    click(document.querySelector('.paint')!);
    await waitFor(() => expect(own()).toEqual(['component=2px', 'block=blue']));
  });

  it('keeps the variable of the file style on every carrier when rows in an element come and go', async () => {
    await resume(
      'rowsInElement.brm',
      `<script>
  import { $signal } from 'brumate/signals';
  let w = $signal(1);
  let rows = $signal([{ id: 1 }, { id: 2 }]);
  let count = 2;
</script>
<button class="wide" onClick=(() => (w += 1))>wide</button>
<button class="add" onClick=(() => (rows = [...rows, { id: ++count }]))>add</button>
<button class="reverse" onClick=(() => (rows = [...rows].reverse()))>reverse</button>
<div class="box">
  #for (row of rows by row.id) {
    <p class="row">{row.id}</p>
  }
</div>
<style>
  .box { width: \${w}px; }
</style>`,
    );
    // Every element that carries the variable, the box and any row, shows the current value.
    const widths = (): string[] => {
      const found: string[] = [];
      for (const element of document.querySelectorAll('[style*="--s-"]')) {
        found.push(/--s-[\w-]+:\s*([^;]*)/.exec(element.getAttribute('style')!)![1]!.trim());
      }
      return found;
    };
    click(document.querySelector('.add')!);
    await waitFor(() => expect(document.querySelectorAll('.row')).toHaveLength(3));
    click(document.querySelector('.wide')!);
    await waitFor(() => expect(new Set(widths())).toEqual(new Set(['2px'])));
    click(document.querySelector('.reverse')!);
    await waitFor(() => expect(document.querySelector('.row')!.textContent).toBe('3'));
    click(document.querySelector('.wide')!);
    await waitFor(() => expect(new Set(widths())).toEqual(new Set(['3px'])));
    expect(widths().length).toBeGreaterThan(0);
  });
});
