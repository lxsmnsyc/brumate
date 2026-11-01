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
  writeFileSync(`${app}src/lazy.css`, '.lazy { color: red; }\n');
  writeFileSync(
    `${app}src/Page.brm`,
    "<style>\n  p { color: teal; }\n</style>\n\n<script>\n  import { shade } from './lazy.ts';\n  import { $state } from 'brumate/signals';\n  let count = $state(0);\n</script>\n\n<p onClick=(() => (count += shade.length))>{count}</p>\n",
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
  const list = /m\.f=(\[[^\]]*\])/.exec(code)?.[1];
  return list ? (JSON.parse(list) as string[]) : [];
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
    // The scripts of a page come from the `Link` headers, so no table lists one. The table
    // of Vite holds the stylesheet of the bundle and nothing else.
    expect(code).toContain('__vite__mapDeps');
    expect(mapDeps(code)).toEqual([expect.stringMatching(/^assets\/Page_\w+-[\w-]+\.css$/)]);
    expect(code).not.toContain('modulepreload');
    expect(code).not.toContain('detectScriptRel');
    expect(code).not.toContain('isCssPreloadUrl');
    expect(code).toMatch(
      /__vitePreload\(\(\) => import\("\.\/Page[\w-]*\.js"\), __vite__mapDeps\(\[0\]\)\)/,
    );
  });

  it('adds a stylesheet that is not on the page, and waits for it before it loads the chunk', async () => {
    const output = await buildApp('preload-helper-run');
    const chunk = output.find(
      (item): item is Rolldown.OutputChunk =>
        item.type === 'chunk' && item.code.includes('__vitePreload = '),
    )!;
    const css = output.find((item) => item.fileName.endsWith('.css'))!;
    const { links, done } = runHelper(chunk.code, [css.fileName, 'assets/other.js'], []);
    expect(links).toHaveLength(1);
    expect(links[0].rel).toBe('stylesheet');
    expect(links[0].href).toBe(`http://localhost/${css.fileName}`);
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
    expect(mapDeps(code)).toEqual([expect.stringMatching(/\.css$/)]);
    expect(code).not.toContain('modulepreload');
    expect(code).not.toContain('isCssPreloadUrl');
  });
});
