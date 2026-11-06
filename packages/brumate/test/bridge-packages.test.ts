// A bridge exported by an installed package: a real copy in node_modules, with no `brumate` field,
// that depends on brumate and ships compiled `.js`.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { build, createServer } from 'vite';
import type { InlineConfig, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { findBridgePackages } from '../src/packages.ts';
import { render } from '../src/runtime/server.ts';
import brumate from '../src/vite.ts';

vi.setConfig({ testTimeout: 30_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));

let base: string;
let app: string;
const write = (file: string, content: string): void => {
  mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
  writeFileSync(path.join(base, file), content);
};
const json = (value: unknown): string => JSON.stringify(value, null, 2);

const BRIDGE = (extra: string): string => `import { bridge } from "brumate/store";
${extra}`;

beforeAll(() => {
  base = realpathSync(mkdtempSync(path.join(tmpdir(), 'brumate-installed-')));
  app = path.join(base, 'app');
  write(
    'app/package.json',
    json({
      name: 'app',
      dependencies: { 'bear-kit': '1.0.0', 'plain-kit': '1.0.0', other: '1.0.0' },
    }),
  );
  write(
    'app/src/BearsPage.brm',
    `<script>
  import { bears } from 'bear-kit';
  import { more } from 'bear-kit/more';
  import Reader from './Reader.brm';

  const held = bears(3);
  const other = more(8);
</script>

<Reader given=(held) />
<Reader given=(held) />
<Reader given=(other) />
`,
  );
  write(
    'app/src/Reader.brm',
    `<script>
  import { $props, $store } from 'brumate/signals';

  const { given } = $props<{ given: unknown }>();
  const value = $store(given);
</script>

<button class="b" onClick=(() => given.source?.add())>{value}</button>
`,
  );
  // A real copy of a package: compiled files, an export list, and a bridge named by `export { a as bears }`.
  const kit = 'app/node_modules/bear-kit';
  write(
    `${kit}/package.json`,
    json({
      name: 'bear-kit',
      version: '1.0.0',
      type: 'module',
      dependencies: { brumate: '*', 'cjs-count': '1.0.0' },
      exports: { '.': './dist/index.js', './more': './dist/more.js' },
    }),
  );
  // A CommonJS dependency, which the browser can import only once Vite prebundles it.
  write(
    `${kit}/node_modules/cjs-count/package.json`,
    json({ name: 'cjs-count', version: '1.0.0', main: './index.js' }),
  );
  write(`${kit}/node_modules/cjs-count/index.js`, 'module.exports = { start: 0 };\n');
  const source = `{
  create: (snapshot) => {
    globalThis.installedCreates = (globalThis.installedCreates ?? 0) + 1;
    const source = {
      value: snapshot ?? 0,
      listeners: new Set(),
      add() {
        source.value += 1;
        for (const listener of source.listeners) listener();
      },
    };
    return source;
  },
  get: (source) => source.value,
  subscribe: (source, listener) => {
    source.listeners.add(listener);
    return () => source.listeners.delete(listener);
  },
}`;
  write(
    `${kit}/dist/index.js`,
    BRIDGE(
      `import counts from 'cjs-count';\nexport const zero = counts.start;\nconst a = bridge(${source});\nexport { a as bears };\n`,
    ),
  );
  write(`${kit}/dist/more.js`, BRIDGE(`export const more = bridge(${source});\n`));
  // Depends on brumate and has no bridge: it adds nothing.
  write(
    'app/node_modules/plain-kit/package.json',
    json({
      name: 'plain-kit',
      version: '1.0.0',
      dependencies: { brumate: '*' },
      main: './index.js',
    }),
  );
  write('app/node_modules/plain-kit/index.js', 'export const plain = 1;\n');
  // Does not depend on brumate, so it is not scanned, though its text names a bridge.
  write('app/node_modules/other/package.json', json({ name: 'other', version: '1.0.0' }));
  write(
    'app/node_modules/other/index.js',
    `import { bridge } from "brumate/store";\nexport const x = bridge({});\n`,
  );
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

const aliases = {
  'brumate/server': runtime('server'),
  'brumate/client': runtime('client'),
  'brumate/loader': runtime('loader'),
  'brumate/signals': runtime('signals'),
  'brumate/store': runtime('store'),
  'brumate/context': runtime('context'),
  'brumate/bundles': runtime('bundles'),
};

/** Puts a DOM on the globals, as a browser has, and returns the function that takes it away. */
function browser(): () => void {
  const window = new Window({ url: 'http://localhost/' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const skip = new Set([
    'URL',
    'URLSearchParams',
    'fetch',
    'Request',
    'Response',
    'Headers',
    'FormData',
    'AbortController',
    'AbortSignal',
    'Blob',
    'File',
    'console',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'queueMicrotask',
    'performance',
    'TextEncoder',
    'TextDecoder',
    'crypto',
    'structuredClone',
    'ReadableStream',
    'WritableStream',
    'TransformStream',
    'Event',
    'EventTarget',
    'CustomEvent',
  ]);
  const keys = new Set<string>([
    'window',
    'self',
    'document',
    'navigator',
    'location',
    'history',
    'Event',
    'CustomEvent',
    'EventTarget',
  ]);
  for (const key of Object.getOwnPropertyNames(window)) {
    if (!skip.has(key) && !(key in globalThis)) {
      keys.add(key);
    }
  }
  for (const key of ['Event', 'CustomEvent', 'EventTarget']) {
    keys.add(key);
  }
  for (const key of keys) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    const value =
      key === 'window' || key === 'self'
        ? window
        : (window as unknown as Record<string, unknown>)[key];
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  return () => {
    for (const [key, descriptor] of saved) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete (globalThis as Record<string, unknown>)[key];
      }
    }
    void window.happyDOM.close();
  };
}

describe('findBridgePackages', () => {
  it('finds the packages that depend on brumate, and not the others', () => {
    const found = findBridgePackages(app);
    expect(found.map((item) => item.name)).toEqual(['bear-kit', 'plain-kit']);
    expect(found[0]!.dependencies).toEqual(['cjs-count']);
  });

  /** An app with `dup-kit` at the top and a second copy nested under `holder`. */
  function duplicates(top: string, nested: string): string {
    const root = path.join(base, `dup-${top}-${nested}`);
    const put = (file: string, value: unknown): void => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), json(value));
    };
    const kit = (version: string) => ({
      name: 'dup-kit',
      version,
      dependencies: { brumate: '*' },
    });
    put('package.json', { name: 'app', dependencies: { 'dup-kit': top, holder: '1.0.0' } });
    put('node_modules/dup-kit/package.json', kit(top));
    put('node_modules/holder/package.json', {
      name: 'holder',
      version: '1.0.0',
      dependencies: { brumate: '*', 'dup-kit': nested },
    });
    put('node_modules/holder/node_modules/dup-kit/package.json', kit(nested));
    return root;
  }

  it('names two versions of one package by their versions', () => {
    const names = findBridgePackages(duplicates('1.0.0', '2.0.0')).map((item) => item.name);
    expect(names.toSorted()).toEqual(['dup-kit@1.0.0', 'dup-kit@2.0.0', 'holder']);
  });

  it('throws for two copies of one version, which would share bridge names', () => {
    expect(() => findBridgePackages(duplicates('1.0.0', '1.0.0'))).toThrow(
      /two installed copies of dup-kit@1\.0\.0/,
    );
  });
});

describe('a bridge of an installed package, in development', () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await createServer({
      root: app,
      configFile: false,
      logLevel: 'silent',
      plugins: [brumate()],
      resolve: { alias: aliases },
      appType: 'custom',
      server: { middlewareMode: true, watch: null },
    });
    await server.pluginContainer.buildStart({});
  });

  afterAll(async () => {
    await server.close();
  });

  it('changes the config only for a package with a bridge', () => {
    expect(server.config.optimizeDeps.exclude).toContain('bear-kit');
    expect(server.config.optimizeDeps.exclude).not.toContain('plain-kit');
    expect(server.config.ssr.noExternal).toContain('bear-kit');
    expect(server.config.ssr.noExternal).not.toContain('plain-kit');
    expect(server.config.optimizeDeps.include).toContain('bear-kit > cjs-count');
  });

  it('serves the CommonJS dependency of the package prebundled', async () => {
    const result = await server.transformRequest('/node_modules/bear-kit/dist/index.js');
    expect(result?.code).toMatch(
      /__vite__cjsImport\w+ from "\/node_modules\/\.vite\/deps\/bear-kit_n_cjs-count\.js/,
    );
  });

  it('names the bridges by package and path, and lists them in the manifest', async () => {
    const manifest = await server.transformRequest('virtual:brumate/manifest');
    expect(manifest?.code).toContain('"bridge:bear-kit/dist/index.js"');
    expect(manifest?.code).toContain('"bridge:bear-kit/dist/more.js"');
    expect(manifest?.code).not.toContain('plain-kit');
    expect(manifest?.code).not.toContain('"bridge:other');
  });

  it('renders with the stable names and resumes with one source for each bridge', async () => {
    const globals = globalThis as { installedCreates?: number };
    const page = await server.ssrLoadModule('/src/BearsPage.brm');
    const { html, state } = await render(page.default, {});
    expect(state).toContain('bridge:bear-kit/dist/index.js#bears');
    expect(state).toContain('bridge:bear-kit/dist/more.js#more');
    expect(state).not.toContain(base);
    expect(html.match(/>3<\/button>/g)).toHaveLength(2);
    expect(html).toContain('>8</button>');
    globals.installedCreates = 0;
    // The browser has not loaded the module of any bridge: the server's copies go.
    delete (globalThis as { [key: symbol]: unknown })[Symbol.for('brumate.bridges')];
    server.moduleGraph.invalidateAll();

    // The browser: the state, the loader of the manifest, and the code of the page.
    const dom = browser();
    document.body.innerHTML = html + state;
    for (const script of document.body.querySelectorAll('script[b-state]')) {
      Object.defineProperty(document, 'currentScript', { configurable: true, value: script });
      // oxlint-disable-next-line no-new-func -- The script is a state record from the server.
      new Function('self', script.textContent!)(globalThis);
    }
    delete (document as { currentScript?: unknown }).currentScript;
    const { load } = await server.ssrLoadModule('virtual:brumate/manifest');
    const { start } = await server.ssrLoadModule(runtime('loader'));
    const stop = start({ load });
    try {
      await vi.waitFor(() => expect(globals.installedCreates).toBe(2), { timeout: 5000 });
      const buttons = document.querySelectorAll<HTMLButtonElement>('.b');
      buttons[1]!.dispatchEvent(new Event('click', { bubbles: true }));
      await vi.waitFor(
        () => expect(Array.from(buttons, (item) => item.textContent)).toEqual(['4', '4', '8']),
        { timeout: 5000 },
      );
      // One source for the two readers of `held`, one for `other`.
      expect(globals.installedCreates).toBe(2);
    } finally {
      stop();
      dom();
    }
  });
});

describe('a bridge of an installed package, in a build', () => {
  it('names the bridges and adds the loaders to the entry', async () => {
    mkdirSync(path.join(app, 'src/routes'), { recursive: true });
    writeFileSync(path.join(app, 'src/client.ts'), "import 'virtual:brumate/start';\n");
    writeFileSync(path.join(app, 'src/routes/index.brm'), '<h1>Home</h1>\n');
    const shared: InlineConfig = {
      root: app,
      configFile: false,
      logLevel: 'silent',
      plugins: [brumate()],
      resolve: { alias: aliases },
    };
    await build({
      ...shared,
      build: { outDir: 'dist/client', rolldownOptions: { input: 'src/client.ts' } },
    });
    const code = readdirSync(path.join(app, 'dist/client/assets'))
      .map((file) => readFileSync(path.join(app, 'dist/client/assets', file), 'utf8'))
      .join('\n');
    expect(code).toContain('bridge:bear-kit/dist/index.js#bears');
    expect(code).toContain('bridge:bear-kit/dist/more.js#more');
    expect(code).not.toContain(base);
    expect(code).not.toContain('plain-kit');
  });
});
