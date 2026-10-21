// @vitest-environment happy-dom
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { render } from '../src/runtime/server.ts';

// The DOM environment replaces URL, so paths are plain strings.
const input = resolve(import.meta.dirname, 'render');
const output = resolve(import.meta.dirname, '.output/raw-text');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
let id = '';

/** Points imports of client parts at the files that the tests write. */
function toRender(code: string): string {
  return code.replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"');
}

beforeAll(() => {
  mkdirSync(output, { recursive: true });
  const name = 'textarea.brm';
  const source = readFileSync(join(input, name), 'utf8');
  // Compiled as the Vite plugin does, with the props that parents can change.
  const result = compile(source, {
    filename: name,
    liveProps: analyzeProject(new Map([[name, source]])).get(name),
    path: join(input, name),
  });
  for (const [part, code] of Object.entries(result.parts)) {
    writeFileSync(join(output, `${name}.client.${part}.ts`), toRender(code));
  }
  writeFileSync(join(output, `${name}.ts`), result.server);
  writeFileSync(join(output, `${name}.client.ts`), toRender(result.client));
  id = result.plan.id;
});

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

async function renderPage(initial: string): Promise<{ html: string; state: string; head: string }> {
  const server = await import(file('textarea.brm.ts'));
  return render(server.default, { initial });
}

describe('elements whose content is text', () => {
  it('renders values in a <textarea> and a <title> without markers', async () => {
    const { html, head } = await renderPage('Kept <b>');
    expect(html).not.toContain('<!--t');
    expect(head).not.toContain('<!--t');
    document.head.innerHTML = head;
    document.body.innerHTML = html;
    const [body, fixed] = document.querySelectorAll('textarea');
    expect(body!.value).toBe('Kept <b>');
    expect(fixed!.value).toBe('a Kept <b> b');
    expect(document.title).toBe('Count 0');
  });

  it('updates the text and the value on the client', async () => {
    const { html, state, head } = await renderPage('Kept');
    document.head.innerHTML = head;
    document.body.innerHTML = html + state;
    for (const script of document.body.querySelectorAll('script[b-state]')) {
      Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
      // oxlint-disable-next-line no-eval -- The state record from the server.
      (0, eval)(script.textContent!);
      delete (document as { currentScript?: unknown }).currentScript;
    }
    vi.resetModules();
    const { start } = await import('../src/runtime/loader.ts');
    stop = start({ load: (name) => import(name === id ? file('textarea.brm.client.ts') : name) });
    const field = document.querySelector('textarea')!;
    // What the user typed is replaced, as a `value` attribute replaces it on an `<input>`.
    field.value = 'Typed';
    document.querySelector('.set')!.dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(document.title).toBe('Count 1'), { timeout: 5000 });
    expect(field.value).toBe('New');
    expect(field.textContent).toBe('New');
  });

  it('reports a value that changes next to other content', () => {
    const source = `<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>
<textarea aria-label="Count">Count {count}</textarea>
<button onClick=(() => count++)>Add</button>`;
    expect(() => compile(source, { filename: 'Test.brm' })).toThrow(
      'A value that changes in <textarea> must be its whole content',
    );
  });
});
