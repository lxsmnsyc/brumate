import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { InlineConfig, Rolldown } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import brumate from '../src/vite.ts';

vi.setConfig({ testTimeout: 30_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));

/** Builds a small client with a lazy script that imports a stylesheet and a root component with one. */
async function buildApp(name: string, extra: InlineConfig['build'] = {}) {
  const app = fileURLToPath(new URL(`./.output/${name}/`, import.meta.url));
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}src`, { recursive: true });
  writeFileSync(`${app}src/client.ts`, "import 'virtual:brumate/start';\n");
  writeFileSync(`${app}src/lazy.ts`, "import './lazy.css';\nexport const shade = 'red';\n");
  writeFileSync(`${app}src/shared.ts`, 'export const shared = Math.random();\n');
  writeFileSync(
    `${app}src/a.ts`,
    "import { shared } from './shared.ts';\nexport const a = shared + 1;\n",
  );
  writeFileSync(
    `${app}src/b.ts`,
    "import { shared } from './shared.ts';\nexport const b = shared + 2;\n",
  );
  writeFileSync(`${app}src/lazy.css`, '.lazy { color: red; }\n');
  writeFileSync(
    `${app}src/Page.brm`,
    "<style>\n  p { color: teal; }\n</style>\n\n<script>\n  import { shade } from './lazy.ts';\n  import { $state } from 'brumate/signals';\n  let count = $state(0);\n</script>\n\n<p onClick=(async () => { count += shade.length + (await import('./a.ts')).a + (await import('./b.ts')).b; })>{count}</p>\n",
  );
  const config: InlineConfig = {
    root: app,
    configFile: false,
    logLevel: 'silent',
    plugins: [brumate({ merge: 0 })],
    resolve: {
      alias: {
        'brumate/server': runtime('server'),
        'brumate/client': runtime('client'),
        'brumate/loader': runtime('loader'),
        'brumate/static-loader': runtime('static-loader'),
        'brumate/context': runtime('context'),
        'brumate/events': runtime('events'),
        'brumate/serial': runtime('values'),
        'brumate/stream': runtime('gather'),
      },
    },
    build: {
      write: false,
      minify: false,
      rolldownOptions: { input: 'src/client.ts' },
      ...extra,
    },
  };
  const result = (await build(config)) as Rolldown.RolldownOutput;
  return result.output;
}

/** The files in the table of dependencies that Vite writes at the top of a chunk. */
function mapDeps(code: string): string[] {
  const files: string[] = [];
  for (const match of code.matchAll(/m\.f=(\[[^\]]*\])/g)) {
    files.push(...(JSON.parse(match[1]) as string[]));
  }
  return files;
}

/** Runs the helper of a build against a page with the given stylesheets and returns the links that it added. */
function runHelper(
  code: string,
  deps: string[],
  existing: string[],
): { links: { rel: string; href: string; onload?: () => void }[]; done: Promise<string> } {
  const source = /(?:export const|var) __vitePreload = [\s\S]*?\n\};/.exec(code)?.[0];
  expect(source).toBeDefined();
  const links: { rel: string; href: string; onload?: () => void }[] = [];
  const document = {
    getElementsByTagName: () => existing.map((href) => ({ rel: 'stylesheet', href })),
    createElement: () => ({}) as { rel: string; href: string; onload?: () => void },
    head: { appendChild: (link: (typeof links)[number]) => links.push(link) },
  };
  const make = new Function(
    'document',
    'location',
    `${source!.replace(/^(?:export const|var)/, 'const')}; return __vitePreload;`,
  );
  const helper = make(document, { href: 'http://localhost/page' }) as (
    load: () => string,
    deps: string[],
  ) => Promise<string>;
  return { links, done: helper(() => 'loaded', deps) };
}

describe('the preload helper of the client build', () => {
  it('replaces the helper of Vite with one that waits for stylesheets only', async () => {
    const output = await buildApp('preload-helper');
    let code = '';
    for (const item of output) {
      if (item.type === 'chunk') {
        code += item.code;
      }
    }
    // The scripts of a page and of its bundles come from the `Link` headers, so the table
    // holds the stylesheet of the bundle and the imports of the other lazy chunks. A lazy
    // chunk and the chunk that it shares with another load together.
    const deps = mapDeps(code);
    expect(deps).toContainEqual(expect.stringMatching(/^assets\/Page_\w+-[\w-]+\.css$/));
    const lazy = output.find(
      (item): item is Rolldown.OutputChunk =>
        item.type === 'chunk' && item.fileName.startsWith('assets/a-'),
    )!;
    expect(lazy.imports).toHaveLength(1);
    expect(deps).toContain(lazy.imports[0]);
    const start = output.filter(
      (item): item is Rolldown.OutputChunk =>
        item.type === 'chunk' && item.moduleIds.some((id) => id.endsWith('virtual:brumate/start')),
    );
    for (const item of start) {
      expect(deps).not.toContain(item.fileName);
    }
    expect(deps).not.toContainEqual(expect.stringMatching(/^assets\/Page_[\w-]+\.js$/));
    expect(code).not.toContain('detectScriptRel');
    expect(code).not.toContain('isCssPreloadUrl');
  });

  it('adds a stylesheet that is not on the page, and waits for it before it loads the chunk', async () => {
    const output = await buildApp('preload-helper-run');
    const chunk = output.find(
      (item): item is Rolldown.OutputChunk =>
        item.type === 'chunk' && item.code.includes('__vitePreload = '),
    )!;
    const css = output.find((item) => item.fileName.endsWith('.css'))!;
    const { links, done } = runHelper(chunk.code, [css.fileName, 'assets/other.js'], []);
    // The script gets a hint that is not waited for, the stylesheet is.
    expect(links.map((link) => link.rel)).toEqual(['stylesheet', 'modulepreload']);
    expect(links[0].href).toBe(`http://localhost/${css.fileName}`);
    expect(links[1].href).toBe('http://localhost/assets/other.js');
    let settled = false;
    void done.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    links[0].onload!();
    expect(await done).toBe('loaded');
  });

  it('skips a stylesheet that the page has', async () => {
    const output = await buildApp('preload-helper-has');
    const chunk = output.find(
      (item): item is Rolldown.OutputChunk =>
        item.type === 'chunk' && item.code.includes('__vitePreload = '),
    )!;
    const css = output.find((item) => item.fileName.endsWith('.css'))!;
    const { links, done } = runHelper(
      chunk.code,
      [css.fileName],
      [`http://localhost/${css.fileName}`],
    );
    expect(links).toHaveLength(0);
    expect(await done).toBe('loaded');
  });

  it('does the same when the app turns the preloading off', async () => {
    const output = await buildApp('preload-helper-off', { modulePreload: false });
    let code = '';
    for (const item of output) {
      if (item.type === 'chunk') {
        code += item.code;
      }
    }
    for (const file of mapDeps(code)) {
      expect(file).not.toMatch(/^assets\/(?:client|skew|Page_[\w-]+)-[\w-]+\.js$/);
    }
    expect(code).not.toContain('isCssPreloadUrl');
  });
});
