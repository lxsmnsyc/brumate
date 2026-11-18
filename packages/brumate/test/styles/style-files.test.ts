import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import type { InlineConfig } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import brumate from '../../src/vite.ts';

// The builds of the client and the server take more than the default 5s on a CI runner.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../../src/runtime/${name}.ts`, import.meta.url));

const app = fileURLToPath(new URL('../.output/style-files/', import.meta.url));

/**
 * A layout with a global style, a page with client code that renders a card with no client
 * code, a `${}` variable and a block style, and a page with no client code at all.
 */
function writeApp(): void {
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}src/routes`, { recursive: true });
  writeFileSync(
    `${app}src/client.ts`,
    "import { start } from 'brumate/loader';\nimport { load } from 'virtual:brumate/manifest';\nstart({ load });\n",
  );
  writeFileSync(`${app}src/server.ts`, "export { handle } from 'virtual:brumate/routes';\n");
  // A server that renders a component itself, outside the routes.
  writeFileSync(
    `${app}src/custom.ts`,
    [
      "import { renderToStream } from 'brumate/server';",
      "import Card from './Card.brm';",
      '',
      'export async function page(): Promise<string> {',
      "  let html = '';",
      "  for await (const chunk of renderToStream(Card, { shade: 'teal' })) {",
      '    html += chunk;',
      '  }',
      '  return html;',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(
    `${app}src/routes/_layout.brm`,
    [
      '<script>',
      "  import { $props } from 'brumate/signals';",
      '  const { children } = $props();',
      '</script>',
      '',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <main class="frame">{children}</main>',
      '  </body>',
      '</html>',
      '',
      '<style global>',
      '  body { margin: 0; }',
      '</style>',
      '<style>',
      '  .frame { padding: 4px; }',
      '</style>',
      '',
    ].join('\n'),
  );
  writeFileSync(
    `${app}src/routes/index.brm`,
    [
      '<script>',
      "  import { $signal } from 'brumate/signals';",
      "  import Card from '../Card.brm';",
      '  let count = $signal(0);',
      "  const tags = ['a', 'b'];",
      '</script>',
      '',
      '<button class="count" onClick=(() => count++)>{count}</button>',
      '<Card shade="teal" />',
      '#for (tag of tags by tag) {',
      '  <span class="tag">{tag}</span>',
      '  <style>.tag { color: blue; }</style>',
      '}',
      '',
      '<style>',
      '  .count { color: red; }',
      '</style>',
      '',
    ].join('\n'),
  );
  writeFileSync(
    `${app}src/routes/plain.brm`,
    '<p class="plain">Plain</p>\n\n<style>\n  .plain { color: green; }\n</style>\n',
  );
  writeFileSync(
    `${app}src/Card.brm`,
    [
      '<script>',
      "  import { $props } from 'brumate/signals';",
      '  const { shade } = $props();',
      '</script>',
      '',
      '<div class="card">Card</div>',
      '',
      '<style>',
      '  .card { background: ${shade}; }',
      '</style>',
      '',
    ].join('\n'),
  );
}

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
      'brumate/bundles': runtime('bundles'),
      'brumate/signals': runtime('signals'),
      'brumate/routes': runtime('routes'),
      'brumate/context': runtime('context'),
      'brumate/events': runtime('events'),
      'brumate/serial': runtime('values'),
      'brumate/stream': runtime('gather'),
    },
  },
};

type Handle = (request: Request) => Promise<Response | undefined>;

let handle: Handle;
/** `handle` of the build with a relative base. */
let relativeHandle: Handle;
/** `page()` of `src/custom.ts`: a render outside the routes. */
let custom: () => Promise<string>;

async function page(path: string, from = handle): Promise<string> {
  const response = await from(new Request(`http://localhost${path}`));
  expect(response?.status).toBe(200);
  return await response!.text();
}

/** The text of the files of a folder of the build, by name. */
function files(folder: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const name of readdirSync(`${app}${folder}`, { recursive: true }) as string[]) {
    if (/\.(js|css)$/.test(name)) {
      found.set(name, readFileSync(`${app}${folder}/${name}`, 'utf8'));
    }
  }
  return found;
}

/** The CSS of the stylesheets that some HTML links to. */
function linkedCss(html: string): string {
  let css = '';
  for (const [, href] of html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)) {
    css += readFileSync(`${app}dist/client${href}`, 'utf8');
  }
  return css;
}

beforeAll(async () => {
  writeApp();
  await build({
    ...config,
    build: { outDir: 'dist/client', rolldownOptions: { input: 'src/client.ts' } },
  });
  await build({
    ...config,
    build: {
      outDir: 'dist/server',
      ssr: true,
      rolldownOptions: { input: { server: 'src/server.ts', custom: 'src/custom.ts' } },
    },
  });
  // The same app with a relative base, which keeps the inline stylesheets. A plugin of its own,
  // as a project has one base: the plugin keeps what it compiled across the builds of a process.
  const relative: InlineConfig = { ...config, base: './', plugins: [brumate({ merge: 0 })] };
  await build({
    ...relative,
    build: { outDir: 'relative/client', rolldownOptions: { input: 'src/client.ts' } },
  });
  await build({
    ...relative,
    build: { outDir: 'relative/server', ssr: true, rolldownOptions: { input: 'src/server.ts' } },
  });
  ({ handle } = (await import(pathToFileURL(`${app}dist/server/server.js`).href)) as {
    handle: Handle;
  });
  ({ page: custom } = (await import(pathToFileURL(`${app}dist/server/custom.js`).href)) as {
    page: () => Promise<string>;
  });
  ({ handle: relativeHandle } = (await import(
    pathToFileURL(`${app}relative/server/server.js`).href
  )) as { handle: Handle });
});

describe('component CSS in a build', () => {
  it('is in no module of the client or the server build', () => {
    const found: string[] = [];
    for (const folder of ['dist/client', 'dist/server']) {
      for (const [name, code] of files(folder)) {
        if (name.endsWith('.js') && (code.includes('$$css') || code.includes('.card'))) {
          found.push(`${folder}/${name}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it('is in the stylesheets of the bundles, global and block styles included', () => {
    let css = '';
    for (const [name, code] of files('dist/client')) {
      if (name.endsWith('.css')) {
        css += code;
      }
    }
    expect(css).toMatch(/body\{margin:0\}/);
    expect(css).toMatch(/\.frame\[b-c-\w+\]\{padding:4px\}/);
    expect(css).toMatch(/\.card\[b-c-\w+\]\{background:var\(--s-[\w-]+\)\}/);
    expect(css).toMatch(/\.tag\[b-c-\w+-1\]\{color:#?\w+\}/);
    expect(css).toMatch(/\.plain\[b-c-\w+\]\{color:green\}/);
  });

  it('reaches a page as linked stylesheets instead of inline ones', async () => {
    const html = await page('/');
    expect(html).not.toContain('<style');
    const css = linkedCss(html);
    // The card has no client code, so its stylesheet comes with the bundle of the page.
    expect(css).toMatch(/\.card\[b-c-\w+\]/);
    expect(css).toMatch(/\.count\[b-c-\w+\]/);
    expect(css).toMatch(/\.frame\[b-c-\w+\]/);
    // The value of the variable is on the element, as in development.
    expect(html).toMatch(/style="--s-[\w-]+: ?teal"/);
  });

  it('links the stylesheet of a page with no client code', async () => {
    const html = await page('/plain');
    expect(html).not.toContain('<style');
    expect(linkedCss(html)).toMatch(/\.plain\[b-c-\w+\]\{color:green\}/);
  });

  // A render outside the routes links no stylesheet yet: only `renderPage` links those of the
  // bundles. style-files-links writes the link of each component as it renders.
  it.fails('reaches a render outside the routes', async () => {
    const html = await custom();
    expect(html).toContain('class="card"');
    expect(html.includes('.card[') || linkedCss(html).includes('.card[')).toBe(true);
  });
});

describe('component CSS in a build with a relative base', () => {
  it('stays inline, as the server could not link an asset from a page at any depth', async () => {
    const html = await page('/', relativeHandle);
    expect(html).toMatch(/<style[^>]*>[^<]*\.card\[b-c-\w+\]/);
    let modules = '';
    for (const [name, code] of files('relative/server')) {
      if (name.endsWith('.js')) {
        modules += code;
      }
    }
    expect(modules).toContain('$$css');
    const assets = [...files('relative/client').keys()];
    expect(assets.filter((name) => name.endsWith('.css'))).toEqual([]);
  });
});
