// @vitest-environment happy-dom
// bridge(): a store of another library that crosses the page state in a context or a prop.
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { analyzeProject, compile } from '../../src/index.ts';
import { nameBridges } from '../../src/bridges.ts';
import { check } from '../../src/check-command.ts';
import { getFeatures } from '../../src/features.ts';
import { render as renderParts } from '../../src/runtime/server.ts';
import { findBridgeFiles } from '../../src/files.ts';
import { Bridged, bridge, setBridgeLoader } from '../../src/runtime/store.ts';

const input = resolve(import.meta.dirname, 'bridge');
const output = resolve(import.meta.dirname, '../.output/bridge');
const file = (name: string): string => pathToFileURL(join(output, name)).href;
const modules = new Map<string, string>();

/** Points imports of render modules and client parts at the files that the tests write. */
function toRender(code: string): string {
  return code
    .replace(/\.brm\?brumate-render"/g, '.brm.render.ts"')
    .replace(/\.brm\?brumate-client&part=(\w+)"/g, '.brm.client.$1.ts"')
    .replace(/\.brm\?brumate-client"/g, '.brm.client.ts"');
}

beforeAll(() => {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const sources = new Map(
    readdirSync(input)
      .filter((name) => name.endsWith('.brm'))
      .map((name) => [name, readFileSync(join(input, name), 'utf8')]),
  );
  const liveProps = analyzeProject(sources);
  for (const name of readdirSync(input)) {
    if (!name.endsWith('.brm')) {
      // A script gets the names of its bridges, as the plugin of Vite gives them.
      const source = readFileSync(join(input, name), 'utf8');
      writeFileSync(join(output, name), nameBridges(source, name, `bridge:${name}`) ?? source);
      modules.set(`bridge:${name}`, file(name));
      continue;
    }
    const { server, client, parts, render, plan } = compile(sources.get(name)!, {
      filename: name,
      liveProps: liveProps.get(name),
      path: join(input, name),
    });
    for (const [part, code] of Object.entries(parts)) {
      writeFileSync(join(output, `${name}.client.${part}.ts`), toRender(code));
    }
    writeFileSync(join(output, `${name}.ts`), server.replace(/\.brm'/g, ".brm.ts'"));
    writeFileSync(join(output, `${name}.client.ts`), toRender(client));
    writeFileSync(join(output, `${name}.render.ts`), toRender(render));
    modules.set(plan.id, file(`${name}.client.ts`));
    // A bridge of `<script module>` is named by its component.
    modules.set(`bridge:${plan.id}`, file(`${name}.client.ts`));
  }
});

let stop: (() => void) | undefined;
type Counts = { bridgeCounts?: Record<string, number>; bearsStart?: number };

afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
  delete (globalThis as Counts).bridgeCounts;
  delete (globalThis as Counts).bearsStart;
});

/** Runs an inline script, as a browser does, with the script as `document.currentScript`. */
function run(script: Element): void {
  Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
  try {
    // oxlint-disable-next-line no-eval -- The script is a state record from the server.
    (0, eval)(script.textContent!);
  } finally {
    delete (document as { currentScript?: unknown }).currentScript;
  }
}

function show(html: string): void {
  document.body.innerHTML = html;
  document.body.querySelectorAll('script[b-state]').forEach(run);
}

async function startLoader(eager: string | false = false): Promise<void> {
  vi.resetModules();
  // The browser has not loaded the module of any bridge yet.
  delete (globalThis as { [key: symbol]: unknown })[Symbol.for('brumate.bridges')];
  // A component that imports the bridge file has loaded it before the page resumes.
  if (eager) {
    await import(modules.get(eager)!);
  }
  const { start } = await import('../../src/runtime/loader.ts');
  stop = start({ load: async (id) => import(modules.get(id)!) });
}

/** Renders a component on the server, shows it and starts the loader. */
async function resume(
  name: string,
  before?: () => void,
  eager: string | false = false,
): Promise<void> {
  const server = await import(file(`${name}.brm.ts`));
  const { html, state } = await renderParts(server.default, {});
  // What the server counted is not the browser's.
  delete (globalThis as Counts).bridgeCounts;
  before?.();
  show(html + state);
  await startLoader(eager);
}

function texts(selector: string): string[] {
  return Array.from(document.querySelectorAll(selector), (element) => element.textContent!);
}

function click(selector: string, index = 0): void {
  document.querySelectorAll(selector)[index]!.dispatchEvent(new Event('click', { bubbles: true }));
}

function waitFor(assertion: () => void): Promise<void> {
  return vi.waitFor(assertion, { timeout: 2000 });
}

function counts(): Record<string, number> {
  return (globalThis as Counts).bridgeCounts ?? {};
}

describe('bridge', () => {
  it('makes one source per call on the server, and none is shared between requests', async () => {
    const { bearStore } = await import(file('bears.ts'));
    const first = bearStore({ bears: 1 });
    const second = bearStore({ bears: 1 });
    expect(first.source).not.toBe(second.source);
    first.source.getState().add();
    expect(first.get()).toEqual({ bears: 2 });
    expect(second.get()).toEqual({ bears: 1 });

    // Two renders: the second starts from its own snapshot, not from what the first changed.
    const server = await import(file('bearsCtx.brm.ts'));
    const one = await renderParts(server.default, {});
    const two = await renderParts(server.default, {});
    expect(one.html).toContain('>2</button>');
    expect(two.html).toContain('>2</button>');
    expect(counts().create).toBeGreaterThanOrEqual(4);
  });

  it('renders on the server and resumes through a context, with const and let', async () => {
    await resume('bearsCtx');
    expect(texts('.add')).toEqual(['2', '2']);
    expect(texts('.reset')).toEqual(['2']);
    // The browser makes the source once, at the first subscriber, for all readers.
    await waitFor(() => expect(counts().create).toBe(1));
    // Resume never writes.
    expect(counts().set).toBeUndefined();

    click('.add', 0);
    await waitFor(() => expect(texts('.add')).toEqual(['3', '3']));
    expect(texts('.reset')).toEqual(['3']);
    expect(counts().create).toBe(1);

    // `let` writes the store at the assignment, and every reader sees it.
    click('.reset');
    await waitFor(() => expect(texts('.add')).toEqual(['40', '40']));
    expect(counts().set).toBe(1);
    expect(counts().create).toBe(1);
  });

  it('gives a prop holder the same live store', async () => {
    await resume('bearsProp');
    expect(texts('.prop')).toEqual(['5', '5']);
    await waitFor(() => expect(counts().create).toBe(1));
    click('.prop', 1);
    await waitFor(() => expect(texts('.prop')).toEqual(['6', '6']));
    expect(counts().create).toBe(1);
    expect(counts().set).toBeUndefined();
  });

  it('shares the store with a reader that the browser renders', async () => {
    await resume('bearsLater');
    expect(counts().create).toBeUndefined();
    click('.show');
    await waitFor(() => expect(texts('.add')).toEqual(['7']));
    await waitFor(() => expect(counts().create).toBe(1));
    click('.add');
    await waitFor(() => expect(texts('.add')).toEqual(['8']));
    expect(counts().create).toBe(1);
  });

  it('repairs a slot once when the source starts from another value', async () => {
    await resume('bearsCtx', () => {
      (globalThis as Counts).bearsStart = 9;
    });
    await waitFor(() => expect(texts('.add')).toEqual(['9', '9']));
    expect(texts('.reset')).toEqual(['9']);
    expect(counts().set).toBeUndefined();
    expect(counts().create).toBe(1);
  });

  it('repairs the slots when the module of the bridge has loaded before the page resumes', async () => {
    await resume(
      'bearsCtx',
      () => {
        (globalThis as Counts).bearsStart = 9;
      },
      'bridge:bears.ts',
    );
    await waitFor(() => expect(texts('.add')).toEqual(['9', '9']));
    expect(texts('.reset')).toEqual(['9']);
    expect(counts().create).toBe(1);
    expect(counts().set).toBeUndefined();
  });

  it('has no source in the browser until the store has a subscriber', async () => {
    await resume('bearsCtx');
    const client = await import('../../src/runtime/client.ts');
    let bear: { source: unknown } | undefined;
    await waitFor(() => {
      for (const scope of client.scopes.values()) {
        bear ??= scope.s?.find((value) => (value as { k?: string })?.k === 'brumate.bridge') as
          | { source: unknown }
          | undefined;
      }
      expect(bear).toBeDefined();
    });
    // The first subscriber makes it, when the module of the bridge has loaded.
    await waitFor(() => expect(bear!.source).toBeDefined());
  });

  it('refuses a let on a bridge without set', async () => {
    const server = await import(file('bearsNoSet.brm.ts'));
    await expect(renderParts(server.default, {})).rejects.toThrow(/has no set/);
  });

  it('names the store and the context or the prop when get gives data that cannot be sent', async () => {
    const context = await import(file('bearsBad.brm.ts'));
    await expect(renderParts(context.default, {})).rejects.toThrow(
      /The store "badStore" of bridge\(\) in bears\.ts gives data from get that cannot be sent to the browser .*, and the context "bad" sends it\./,
    );
    const prop = await import(file('bearsBadProp.brm.ts'));
    await expect(renderParts(prop.default, {})).rejects.toThrow(
      /The store "badStore" of bridge\(\) in bears\.ts .*, and the prop or value "(?:held|given)" in \w+ sends it\./,
    );
  });
});

describe('bridge in <script module>', () => {
  /** The ID of the module of a component, from the names that the tests registered. */
  function componentModule(name: string): string {
    const source = readFileSync(join(input, name), 'utf8');
    return `bridge:${compile(source, { filename: name, path: join(input, name) }).plan.id}`;
  }

  it('is named by the component, and the shared part is imported with no other reader', () => {
    const source = readFileSync(join(input, 'modBears.brm'), 'utf8');
    const result = compile(source, { filename: 'modBears.brm', path: join(input, 'modBears.brm') });
    expect(result.parts.shared).toContain(`"bridge:${result.plan.id}#modStore"`);
    expect(result.server).toContain(`"bridge:${result.plan.id}#modStore"`);
    expect(result.client).toContain('brumate-client&part=shared');
    expect(getFeatures(result).bridges).toBe(true);
  });

  it('renders on the server and resumes through a context and a prop, with const and let', async () => {
    await resume('modBears');
    expect(texts('.madd')).toEqual(['2', '2']);
    expect(texts('.mreset')).toEqual(['2']);
    expect(texts('.prop')).toEqual(['5']);
    // One source for the context, one for the prop.
    await waitFor(() => expect(counts().create).toBe(2));
    expect(counts().set).toBeUndefined();

    click('.madd', 1);
    await waitFor(() => expect(texts('.madd')).toEqual(['3', '3']));
    expect(texts('.mreset')).toEqual(['3']);
    click('.prop');
    await waitFor(() => expect(texts('.prop')).toEqual(['6']));

    click('.mreset');
    await waitFor(() => expect(texts('.madd')).toEqual(['40', '40']));
    expect(counts().set).toBe(1);
    expect(counts().create).toBe(2);
  });

  it('resumes when the component has loaded before the page, and repairs the slots', async () => {
    await resume(
      'modBears',
      () => {
        (globalThis as Counts).bearsStart = 9;
      },
      componentModule('modBears.brm'),
    );
    await waitFor(() => expect(texts('.madd')).toEqual(['9', '9']));
    expect(texts('.prop')).toEqual(['9']);
    expect(counts().set).toBeUndefined();
  });

  it('shares the store with a reader that the browser renders', async () => {
    await resume('modLater');
    click('.show');
    await waitFor(() => expect(texts('.madd')).toEqual(['7']));
    click('.madd');
    await waitFor(() => expect(texts('.madd')).toEqual(['8']));
    expect(counts().create).toBe(1);
  });

  it('is not an error for brumate check, and a bridge in the script of a component is', async () => {
    const root = mkdtempSync(join(tmpdir(), 'brumate-bridge-module-'));
    try {
      writeFileSync(
        join(root, 'Good.brm'),
        readFileSync(join(input, 'modLater.brm'), 'utf8').replaceAll('./', `${input}/`),
      );
      const { records } = await check(root, { types: false });
      expect(records.filter((record) => record.code === 'BRM200')).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('bridge value', () => {
  it('names export default as default, and runs', async () => {
    const code = `import { bridge } from 'brumate/store';\nexport default bridge({\n  create: () => 1,\n  get: (source) => source,\n  subscribe: () => () => {},\n});\n`;
    const named = nameBridges(code, 'd.ts', 'bridge:d.ts')!;
    expect(named).toContain('"bridge:d.ts#default"');
    writeFileSync(join(output, 'defaultBridge.ts'), named);
    const module = await import(file('defaultBridge.ts'));
    expect(module.default.i).toBe('bridge:d.ts#default');
    expect(module.default().get()).toBe(1);
  });

  it('puts a file in the manifest only for a bridge that is exported', async () => {
    const root = mkdtempSync(join(tmpdir(), 'brumate-bridge-files-'));
    try {
      writeFileSync(
        join(root, 'note.ts'),
        "// bridge() of 'brumate/store' is not used here\nexport const a = 1;\n",
      );
      writeFileSync(
        join(root, 'real.ts'),
        "import { bridge } from 'brumate/store';\nexport const b = bridge({});\n",
      );
      const found = await findBridgeFiles(root, () => false);
      expect(found.map((item) => item.slice(root.length + 1))).toEqual(['real.ts']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('checks set from the server before the module loads, and reports a failed load', async () => {
    const report = vi.fn<(error: unknown) => void>();
    setBridgeLoader(() => Promise.reject(new Error('offline')), report);
    const without = new Bridged<unknown, number>(undefined, undefined, 'bridge:none#x', 1, false);
    expect(without.set).toBeUndefined();
    const withSet = new Bridged<unknown, number>(undefined, undefined, 'bridge:none#x', 1, true);
    expect(typeof withSet.set).toBe('function');
    withSet.subscribe(() => {});
    await vi.waitFor(() =>
      expect(report).toHaveBeenCalledWith(expect.objectContaining({ message: 'offline' })),
    );
  });

  it('names every bridge that a module exports', () => {
    const code = `import { bridge } from 'brumate/store';
export const a = bridge({});
const b = bridge({});
const c = bridge({});
export { b, c as d };`;
    const named = nameBridges(code, 'x.ts', 'bridge:x.ts')!;
    expect(named).toContain('$$nameBridge(a, "bridge:x.ts#a");');
    expect(named).toContain('$$nameBridge(b, "bridge:x.ts#b");');
    expect(named).toContain('$$nameBridge(c, "bridge:x.ts#d");');
  });

  it('leaves a file without a bridge as it is', () => {
    expect(nameBridges(`export const a = 1;`, 'x.ts', 'bridge:x.ts')).toBeUndefined();
  });

  it('is a compile error (BRM200) when it is not a module-level export', () => {
    for (const code of [
      `import { bridge } from 'brumate/store';\nexport function make() { return bridge({}); }`,
      `import { bridge } from 'brumate/store';\nconst a = bridge({});`,
      `import { bridge } from 'brumate/store';\nexport let a = bridge({});`,
      `import * as s from 'brumate/store';\nexport const a = [s.bridge({})];`,
    ]) {
      expect(() => nameBridges(code, 'x.ts', 'bridge:x.ts')).toThrow(/BRM200/);
    }
  });

  it('is a compile error (BRM200) in a component', () => {
    const source = `<script>
  import { bridge } from 'brumate/store';
  const inside = bridge({ create: () => 1, get: (source) => source, subscribe: () => () => {} });
</script>

<p>{inside.get()}</p>`;
    expect(() => compile(source, { filename: 'inside.brm' })).toThrow(
      /bridge\(\) must be a module-level export/,
    );
  });

  it('is reported by brumate check', async () => {
    const root = mkdtempSync(join(tmpdir(), 'brumate-bridge-'));
    try {
      writeFileSync(
        join(root, 'bad.ts'),
        `import { bridge } from 'brumate/store';\nexport function make() {\n  return bridge({});\n}\n`,
      );
      writeFileSync(
        join(root, 'good.ts'),
        `import { bridge } from 'brumate/store';\nexport const fine = bridge({});\n`,
      );
      const { records } = await check(root, { types: false });
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        file: 'bad.ts',
        severity: 'error',
        code: 'BRM200',
        range: { start: { line: 3, column: 10 } },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the server store when there is no name', () => {
    const made = bridge({
      create: (snapshot?: number) => ({ value: snapshot ?? 0 }),
      get: (source) => source.value,
      subscribe: () => () => {},
    });
    const one = made(3);
    expect(one.get()).toBe(3);
    expect(one.source).toEqual({ value: 3 });
  });
});

void copyFileSync;
