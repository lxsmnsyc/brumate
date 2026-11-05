// @vitest-environment happy-dom
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../src/index.ts';
import { render } from '../src/runtime/server.ts';

const input = resolve(import.meta.dirname, 'render');
const output = resolve(import.meta.dirname, '.output/client-order');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();
const names = ['clientOrder', 'ClientOrderPart'];

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const name of names) {
    const filename = `${name}.brm`;
    const {
      server,
      client,
      parts,
      render: renderCode,
      plan,
    } = compile(readFileSync(join(input, filename), 'utf8'), {
      filename,
      path: join(input, filename),
    });
    const toRender = (code: string): string =>
      code
        .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
        .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
        .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"');
    for (const [part, code] of Object.entries(parts)) {
      writeFileSync(join(output, `${filename}.client.${part}.ts`), toRender(code));
    }
    writeFileSync(join(output, `${filename}.ts`), server.replace(/\.brm'/g, ".brm.ts'"));
    writeFileSync(join(output, `${filename}.client.ts`), toRender(client));
    writeFileSync(join(output, `${filename}.render.ts`), toRender(renderCode));
    modules.set(plan.id, file(`${filename}.client.ts`));
  }
});

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
  delete (globalThis as { orderLog?: string[] }).orderLog;
  vi.unstubAllGlobals();
});

/** Runs a state record, as a browser does while it parses the page. */
function run(script: Element): void {
  Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
  try {
    // oxlint-disable-next-line no-eval -- The script is a state record from the server.
    (0, eval)(script.textContent!);
  } finally {
    delete (document as { currentScript?: unknown }).currentScript;
  }
}

function log(): string[] {
  return (globalThis as { orderLog?: string[] }).orderLog!;
}

describe('$client in markup that the browser renders', () => {
  it('runs after the markup is in the page, in the order of the markup', async () => {
    const server = await import(file('clientOrder.brm.ts'));
    const { html, state } = await render(server.default, {});
    document.body.innerHTML = html + state;
    document.body.querySelectorAll('script[b-state]').forEach(run);
    (globalThis as { orderLog?: string[] }).orderLog = [];
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: async (id) => import(modules.get(id)!) });

    // The page is idle: its own callback runs, and the closed #if has no parts yet.
    await vi.waitFor(() => expect(log()).toEqual(['client page']), { timeout: 5000 });
    expect(document.querySelector('.part')).toBeNull();

    // The #if opens: each part runs after its markup is in the page.
    document.querySelector('.toggle')!.dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(
      () =>
        expect(log()).toEqual([
          'client page',
          'client first in the page',
          'client second in the page',
        ]),
      { timeout: 5000 },
    );

    // The #if closes: the cleanups run, in the order of the markup.
    document.querySelector('.toggle')!.dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(log().slice(3)).toEqual(['cleanup first', 'cleanup second']), {
      timeout: 5000,
    });

    // It opens again: fresh parts run again.
    document.querySelector('.toggle')!.dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(
      () =>
        expect(log().slice(5)).toEqual(['client first in the page', 'client second in the page']),
      {
        timeout: 5000,
      },
    );
  });
});
