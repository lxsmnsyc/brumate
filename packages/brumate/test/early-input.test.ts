// @vitest-environment happy-dom
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { render } from '../src/runtime/server.ts';

// Text that the user types, or a box that they check, before the code loads is in the DOM and not
// in the signal. The core reads each bound field when it starts.

const output = resolve(import.meta.dirname, '.output/early-input');
const file = (name: string): string => pathToFileURL(join(output, name)).href;

const sources = new Map<string, string>([
  [
    'fields.brm',
    `<script>
  import { $bind, $signal } from 'brumate/signals';

  let text = $signal('server');
  let note = $signal('server note');
  let done = $signal(false);
  let checked = $signal(true);
  let choice = $signal('b');
  let first = $signal('');
  let many = $signal('a');
  let writes = $signal(0);
</script>

<input class="text" aria-label="Text" value=$bind(text)>
<textarea class="note" aria-label="Note" value=$bind(note)>{note}</textarea>
<input class="box" aria-label="Box" type="checkbox" checked=$bind(done)>
<input class="on" aria-label="On" type="checkbox" checked=$bind(checked)>
<select class="pick" aria-label="Pick" value=$bind(choice)>
  <option value="a">A</option>
  <option value="b">B</option>
  <option value="c">C</option>
</select>
<select class="first" aria-label="First" value=$bind(first)>
  <option value="">None</option>
  <option value="x">X</option>
</select>
<input class="count" aria-label="Count" value=$bind(text, (next: string) => (writes = writes + 1))>
<p class="out">{text}|{note}|{String(done)}|{String(checked)}|{choice}|{first}|{writes}</p>
`,
  ],
]);

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const liveProps = analyzeProject(sources);
  for (const [name, source] of sources) {
    const {
      server,
      client,
      parts,
      render: rendered,
      plan,
    } = compile(source, {
      filename: name,
      liveProps: liveProps.get(name),
      path: join(output, name),
    });
    const fix = (code: string): string =>
      code
        .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
        .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
        .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"');
    for (const [part, code] of Object.entries(parts)) {
      writeFileSync(join(output, `${name}.client.${part}.ts`), fix(code));
    }
    writeFileSync(join(output, `${name}.ts`), server.replace(/\.brm'/g, ".brm.ts'"));
    writeFileSync(join(output, `${name}.client.ts`), fix(client));
    writeFileSync(join(output, `${name}.render.ts`), fix(rendered));
    modules.set(plan.id, file(`${name}.client.ts`));
  }
});

const modules = new Map<string, string>();
let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
});

/** Shows the page the server renders, and runs its state records, as a browser does. */
async function show(): Promise<void> {
  const server = await import(file('fields.brm.ts'));
  const { html, state } = await render(server.default, {});
  document.body.innerHTML = html + state;
  for (const script of document.body.querySelectorAll('script[b-state]')) {
    Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
    try {
      // oxlint-disable-next-line no-eval -- The script is a state record from the server.
      (0, eval)(script.textContent!);
    } finally {
      delete (document as { currentScript?: unknown }).currentScript;
    }
  }
}

/** Starts the loader, as the page's script does after the user typed. `ready` runs before the core starts. */
async function start(ready?: (hooks: { field?: unknown }) => void): Promise<void> {
  vi.resetModules();
  const { hooks } = await import('../src/runtime/client/state.ts');
  ready?.(hooks);
  const { start: boot } = await import('../src/runtime/loader.ts');
  stop = boot({
    load: async (id) => import(modules.get(id)!),
  });
}

const field = <T extends Element>(selector: string): T => document.querySelector<T>(selector)!;
const out = (): string => field('.out').textContent!;

describe('fields typed before the code loads', () => {
  it('starts with the values the server rendered', async () => {
    await show();
    expect(out()).toBe('server|server note|false|true|b||0');
    await start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Nothing was typed, so nothing is read back: no setter ran, no signal changed.
    expect(out()).toBe('server|server note|false|true|b||0');
  });

  it('writes the signal of a text field', async () => {
    await show();
    field<HTMLInputElement>('.text').value = 'typed';
    await start();
    await vi.waitFor(() => expect(out()).toContain('typed|'));
  });

  it('writes the signal of a textarea', async () => {
    await show();
    field<HTMLTextAreaElement>('.note').value = 'my note';
    await start();
    await vi.waitFor(() => expect(out()).toContain('|my note|'));
  });

  it('writes the signal of a box that was checked, and of one that was unchecked', async () => {
    await show();
    field<HTMLInputElement>('.box').checked = true;
    field<HTMLInputElement>('.on').checked = false;
    await start();
    await vi.waitFor(() => expect(out()).toContain('|true|false|'));
  });

  it('writes the signal of a select', async () => {
    await show();
    field<HTMLSelectElement>('.pick').value = 'c';
    await start();
    await vi.waitFor(() => expect(out()).toContain('|c|'));
  });

  it('does not read a select that shows its first option when none has selected', async () => {
    await show();
    await start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(out()).toContain('|b||');
    expect(field<HTMLSelectElement>('.first').value).toBe('');
  });

  it('calls the setter of a field with its own setter', async () => {
    await show();
    field<HTMLInputElement>('.count').value = 'typed';
    await start();
    await vi.waitFor(() => expect(out().endsWith('|1')).toBe(true));
    // The setter decides what the signal gets, and this one leaves it alone.
    expect(out()).toMatch(/^server\|/);
  });

  it('keeps what was typed when the page updates the signal later', async () => {
    await show();
    field<HTMLInputElement>('.text').value = 'typed';
    await start();
    await vi.waitFor(() => expect(out()).toContain('typed|'));
    field<HTMLInputElement>('.note').value = 'more';
    field<HTMLInputElement>('.note').dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(out()).toContain('|more|'));
    expect(field<HTMLInputElement>('.text').value).toBe('typed');
  });

  it('asks the hook for a field that a part owns', async () => {
    await show();
    const asked: Element[] = [];
    await start((hooks) => {
      hooks.field = (element: Element) => {
        asked.push(element);
        // The part says that the first field changed, and the rest did not.
        return element.classList.contains('text') ? { value: 'from the part' } : false;
      };
    });
    await vi.waitFor(() => expect(out()).toContain('from the part|'));
    expect(asked.length).toBeGreaterThan(1);
    // The hook said that the box did not change, so it was not read.
    expect(out()).toContain('|false|true|b||');
  });
});
