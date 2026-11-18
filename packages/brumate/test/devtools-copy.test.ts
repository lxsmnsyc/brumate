// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DevtoolsHooks, Scope } from '../src/runtime/client.ts';
import { installDevtools, reportError } from '../src/runtime/devtools.ts';
import type { Interaction } from '../src/runtime/devtools.ts';
import { openPanel, togglePanel } from '../src/runtime/devtools-panel.ts';
import {
  copyText,
  printValue,
  writeComponent,
  writeForAgent,
  writeIssue,
  writeRun,
} from '../src/runtime/devtools-panel/copy.ts';
import type { ComponentInfo } from '../src/runtime/devtools-panel/info.ts';

const DEVTOOLS = Symbol.for('brumate.devtools');
const LONG = 'x'.repeat(5000);

let opened: { shadow: ShadowRoot; state: ReturnType<typeof installDevtools> } | undefined;

afterEach(() => {
  if (opened?.shadow.querySelector('.panel')) {
    togglePanel(opened.shadow, opened.state);
  }
  opened = undefined;
  vi.unstubAllGlobals();
});

function hooks(): DevtoolsHooks {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS]!;
}

function stubClipboard(): ReturnType<typeof vi.fn<(text: string) => Promise<void>>> {
  const write = vi.fn<(text: string) => Promise<void>>(async () => {});
  vi.stubGlobal('navigator', { clipboard: { writeText: write } });
  return write;
}

const INFO: ComponentInfo = {
  name: 'Cart',
  file: 'src/Cart.brm',
  scopes: { 0: { label: 'component', slots: ['items', 'note'] } },
  text: 'Cart: 2 slots',
};

function open(): { state: ReturnType<typeof installDevtools>; shadow: ShadowRoot } {
  document.body.innerHTML = '';
  document.querySelector('brumate-devtools')?.remove();
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).startsWith('/__brumate/source')
      ? new Response('const a = 1;\nthrow new Error("Boom");\nconst b = 2;\n')
      : Response.json(INFO)) as typeof fetch;
  const state = installDevtools('/inspect', '/_brumate', { version: '1.2.3', vite: '8.0.0' });
  const shadow = document.querySelector('brumate-devtools')!.shadowRoot!;
  opened = { shadow, state };
  return { state, shadow };
}

function press(button: Element | null): void {
  expect(button).not.toBeNull();
  (button as HTMLElement).click();
}

function makeCart(): Scope {
  const root: Scope = {
    id: 0,
    k: 0,
    m: 'Cart_1',
    s: [[LONG], { headers: { cookie: 'SECRET1' }, name: 'ok' }],
    children: new Set(),
    v: { theme: 'dark' },
    x: { user: 1 },
  };
  root.children!.add({ id: 5, k: 0, m: 'Note_1', p: root, s: [], children: new Set() });
  return root;
}

function makeRun(): Interaction {
  return {
    ref: 'Cart_1#h2',
    label: 'click on <button>',
    begun: 100,
    ready: 104,
    end: 130,
    settled: 160,
    calls: [
      { name: 'saveCart', start: 110, end: 150, status: 200 },
      { name: 'pingCart', start: 111, status: 'failed' },
    ],
    updates: [{ count: 3, start: 131, end: 135 }],
  };
}

describe('Copy for an agent: an error', () => {
  it('writes the message, the place, the source, the stack and the versions', () => {
    const text = writeIssue(
      {
        time: 0,
        source: 'server',
        message: 'Declare $signal with let',
        plugin: 'brumate',
        stack: 'Error\n    at f (/app/src/Page.brm:3:3)',
        loc: { file: '/app/src/Page.brm', line: 3, column: 3 },
      },
      'Server error',
      { version: '1.2.3', vite: '8.0.0' },
      { file: '/app/src/Page.brm', line: 3, text: 'a\nb\nconst x = 1;\nd' },
    );
    expect(text).toContain('Server error');
    expect(text).toContain('Declare $signal with let');
    expect(text).toContain('Place: /app/src/Page.brm:3');
    expect(text).toContain('Component: Page');
    expect(text).toContain('> 3 | const x = 1;');
    expect(text).toContain('Error\n    at f');
    expect(text).toContain('Versions: brumate 1.2.3, Vite 8.0.0');
  });

  it('cuts long values and leaves out cookies and headers', () => {
    const text = writeIssue(
      {
        time: 0,
        source: 'browser',
        message: `${LONG}\nCookie: session=SECRET1\nauthorization: Bearer SECRET2`,
        stack: 'set-cookie: id=SECRET3',
      },
      'Browser error',
    );
    expect(text).toContain('… (');
    expect(text.length).toBeLessThan(2500);
    expect(text).not.toContain('SECRET');
    expect(text).toContain('[left out]');
  });

  it('puts the text on the clipboard from the button of the detail', async () => {
    const write = stubClipboard();
    const { state, shadow } = open();
    reportError(
      state,
      { message: 'Boom', stack: 'Error\n    at f (http://localhost/src/a.ts:2:1)' },
      'browser',
    );
    togglePanel(shadow, state);
    openPanel(shadow, state, 'errors');
    await expect
      .poll(() => shadow.querySelectorAll('.issues .acts .btn').length)
      .toBeGreaterThan(0);
    let copy: HTMLElement | undefined;
    for (const button of shadow.querySelectorAll<HTMLElement>('.issues .acts .btn')) {
      if (button.textContent === 'Copy for an agent') {
        copy = button;
      }
    }
    press(copy!);
    await expect.poll(() => copy!.textContent).toBe('Copied');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0]).toContain('Browser error');
    expect(write.mock.calls[0]![0]).toContain('Versions: brumate 1.2.3, Vite 8.0.0');
  });
});

describe('Copy for an agent: a component', () => {
  it('writes the file, the slots by name, the contexts and the report', () => {
    const text = writeComponent(makeCart(), INFO, { version: '1.2.3' });
    expect(text).toContain('Cart');
    expect(text).toContain('File: src/Cart.brm');
    expect(text).toContain('- items: ');
    expect(text).toContain('- note: ');
    expect(text).toContain('"ok"');
    expect(text).toContain('provides theme: "dark"');
    expect(text).toContain('reads user');
    expect(text).toContain('Cart: 2 slots');
    expect(text).toContain('Components inside: Note_1');
  });

  it('cuts long values and leaves out cookies and headers', () => {
    const text = writeComponent(makeCart(), INFO);
    expect(text).toContain('… (');
    expect(text).not.toContain(LONG);
    expect(text).not.toContain('SECRET1');
    expect(text).toContain('[left out]');
  });

  it('puts the text on the clipboard from the button of the header', async () => {
    const write = stubClipboard();
    const { state, shadow } = open();
    const root = makeCart();
    hooks().attach!({ scopes: new Map([[0, root]]), set: () => {} });
    togglePanel(shadow, state);
    openPanel(shadow, state, 'scopes');
    await expect.poll(() => shadow.querySelector('.ins .title .dock-copy')).not.toBeNull();
    const copy = shadow.querySelector<HTMLElement>('.ins .title .dock-copy')!;
    expect(copy.textContent).toBe('Copy for an agent');
    press(copy);
    await expect.poll(() => copy.textContent).toBe('Copied');
    expect(write.mock.calls[0]![0]).toContain('File: src/Cart.brm');
    expect(write.mock.calls[0]![0]).not.toContain('SECRET1');
  });
});

describe('Copy for an agent: a handler run', () => {
  it('writes the event, the writes, the updates and the calls with times', () => {
    const text = writeRun(makeRun(), 'Cart h2', ['Cart count = 2']);
    expect(text).toContain('Cart h2');
    expect(text).toContain('Event: click on <button>');
    expect(text).toContain('Times: ready after 4 ms, code ran 26 ms, settled after 60 ms');
    expect(text).toContain('- Cart count = 2');
    expect(text).toContain('- 3 updates in 4 ms');
    expect(text).toContain('- saveCart(): 200, 40 ms');
    expect(text).toContain('- pingCart(): failed, pending');
  });

  it('cuts long values and leaves out cookies and headers', () => {
    const text = writeRun(makeRun(), 'Cart h2', [`Cart note = ${LONG}`, 'cookie: SECRET1']);
    expect(text).toContain('… (');
    expect(text).not.toContain('SECRET1');
  });

  it('puts the text on the clipboard from the button of the row', async () => {
    const write = stubClipboard();
    const { state, shadow } = open();
    const button = document.createElement('button');
    const begun = performance.now();
    hooks().handler!('Cart_1#h2', button, new Event('click'));
    hooks().handled!({
      ref: 'Cart_1#h2',
      event: 'click',
      element: button,
      begun,
      ready: begun,
      end: begun + 2,
      result: undefined,
    } as never);
    togglePanel(shadow, state);
    (shadow.querySelector('[data-ws="activity"]') as HTMLElement).click();
    await expect.poll(() => shadow.querySelector('.ent .dock-copy-row')).not.toBeNull();
    const copy = shadow.querySelector<HTMLElement>('.ent .dock-copy-row')!;
    expect(copy.getAttribute('aria-label')).toBe('Copy for an agent');
    press(copy);
    await expect.poll(() => copy.textContent).toBe('Copied');
    expect(write.mock.calls[0]![0]).toContain('Event: click on <button>');
    expect(write.mock.calls[0]![0]).toContain('Handler: Cart_1#h2');
  });
});

describe('Copy for an agent: secrets in text', () => {
  const JSON_TEXT = '{"cookie":"SECRET1","Authorization":"Bearer SECRET2","x-api-key":"SECRET3"}';

  it('leaves out a cookie or a header that sits inside a JSON string', () => {
    const text = printValue({
      body: JSON_TEXT,
      other: 'x-auth-token: SECRET4',
      err: new Error('cookie=SECRET5'),
    });
    expect(text).not.toContain('SECRET');
    expect(text).toContain('[left out]');
    expect(printValue(new Headers({ a: 'SECRET6' }))).toBe('"[headers]"');
    expect(printValue(new Error('boom'))).toContain('"message": "boom"');
  });

  it('keeps them out of the copy of a server call', () => {
    const call = {
      name: 'saveTodos',
      start: 0,
      end: 10,
      status: 200,
      record: {
        name: 'saveTodos',
        args: [JSON_TEXT, { headers: { cookie: 'SECRET7' } }],
        result: { echoed: JSON_TEXT },
        error: { message: 'Cookie: SECRET8', stack: 'Error\n  authorization: SECRET9' },
        timing: { module: 1, network: 1, server: 1, decode: 1 },
        server: {
          reads: [],
          calls: [],
          logs: [{ level: 'log', text: 'set-cookie: SECRET10' }],
        },
      },
    } as never;
    const text = writeForAgent(call, undefined, ['note = "cookie=SECRET11"']);
    expect(text).not.toContain('SECRET');
  });
});

function make(): HTMLButtonElement {
  const button = document.createElement('button');
  button.append('Copy for an agent');
  copyText(button, () => 'text');
  return button;
}

describe('Copy for an agent: the clipboard', () => {
  it('shows Copied once the write resolved', async () => {
    stubClipboard();
    const button = make();
    button.click();
    expect(button.textContent).toBe('Copying');
    await expect.poll(() => button.textContent).toBe('Copied');
  });

  it('shows Copy failed when the clipboard is missing or refuses', async () => {
    vi.stubGlobal('navigator', {});
    const missing = make();
    missing.click();
    await expect.poll(() => missing.textContent).toBe('Copy failed');
    vi.stubGlobal('navigator', {
      clipboard: { writeText: async () => Promise.reject(new Error('no')) },
    });
    const refused = make();
    refused.click();
    await expect.poll(() => refused.textContent).toBe('Copy failed');
  });

  it('falls back to a text area', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn<(command: string) => boolean>(() => true);
    const button = make();
    button.click();
    await expect.poll(() => button.textContent).toBe('Copied');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});

describe('Copy for an agent: more ways to hide a secret', () => {
  it('matches a key by a word in its name', () => {
    const text = printValue({
      requestHeaders: { a: 'SECRET1' },
      sessionCookie: 'SECRET2',
      'x-csrf-token': 'SECRET3',
      'Authorization-Token': 'SECRET4',
      nested: { apiKey: 'SECRET5', password: 'SECRET6' },
    });
    expect(text).not.toContain('SECRET');
  });

  it('matches a pair list of headers', () => {
    const text = printValue([
      ['cookie', 'SECRET1'],
      ['x-api-key', 'SECRET2'],
      ['accept', 'text/html'],
    ]);
    expect(text).not.toContain('SECRET');
    expect(text).toContain('text/html');
    expect(printValue([...new Headers({ cookie: 'SECRET3' }).entries()])).not.toContain('SECRET');
  });

  it('matches a name with a word inside it, and a bearer token, in text', () => {
    const text = printValue({
      a: 'sessionCookie=SECRET1',
      b: '{"x-csrf-token":"SECRET2"}',
      c: 'sent Bearer SECRET3.abc to the server',
      d: 'my_password: SECRET4',
    });
    expect(text).not.toContain('SECRET');
  });
});

describe('Copy for an agent: focus and quick clicks', () => {
  it('gives the focus back after the text area fallback', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn<(command: string) => boolean>(() => true);
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    shadow.append(input);
    const button = document.createElement('button');
    button.append('Copy');
    shadow.append(button);
    copyText(button, () => 'text');
    input.focus();
    button.click();
    await expect.poll(() => button.textContent).toBe('Copied');
    expect(shadow.activeElement).toBe(input);
    host.remove();
  });

  it('lets only the newest click end the feedback', async () => {
    const writes: string[] = [];
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          writes.push(text);
        },
      },
    });
    const button = document.createElement('button');
    button.append('Copy');
    let slow: (value: string) => void = () => {};
    let first = true;
    copyText(button, () => {
      if (first) {
        first = false;
        return new Promise<string>((resolve) => {
          slow = resolve;
        });
      }
      return 'fast';
    });
    button.click();
    button.click();
    await expect.poll(() => button.textContent).toBe('Copied');
    slow('slow');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(button.textContent).toBe('Copied');
    expect(writes).toContain('fast');
  });

  it('starts the write inside the click with a promise of the text', async () => {
    const write = vi.fn<(items: unknown[]) => Promise<void>>(async () => {});
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(public items: Record<string, Promise<Blob>>) {}
      },
    );
    const button = document.createElement('button');
    button.append('Copy');
    copyText(button, async () => 'later');
    button.click();
    expect(write).toHaveBeenCalledTimes(1);
    await expect.poll(() => button.textContent).toBe('Copied');
  });
});
