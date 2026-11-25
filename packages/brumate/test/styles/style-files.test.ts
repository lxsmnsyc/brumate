import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import type { InlineConfig, Plugin } from 'vite';
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
    `${app}src/routes/later.brm`,
    [
      "<script>\n  import Late from '../Late.brm';\n</script>",
      '',
      "#defer ('idle') {",
      '  <Late />',
      '} #else {',
      '  <p class="fallback">Loading</p>',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(
    `${app}src/Late.brm`,
    '<p class="late">Late</p>\n\n<style>\n  .late { color: purple; }\n</style>\n',
  );
  // A component with a `url()` to a local asset and an `@import`, which the CSS pipeline rewrites.
  writeFileSync(`${app}src/bg.png`, Buffer.from('iVBORw0KGgo=', 'base64'));
  writeFileSync(`${app}src/shared.css`, '.shared { color: red; }\n');
  writeFileSync(
    `${app}src/Pic.brm`,
    [
      '<div class="pic">Pic</div>',
      '',
      '<style>',
      "  @import './shared.css';",
      '  .pic { background: url(./bg.png) no-repeat; }',
      '</style>',
      '',
    ].join('\n'),
  );
  writeFileSync(
    `${app}src/routes/pic.brm`,
    "<script>\n  import Pic from '../Pic.brm';\n</script>\n\n<Pic />\n",
  );
  // A page whose bundle imports a plain CSS file, which is not the CSS of a component.
  writeFileSync(`${app}src/extra.css`, '.extra { color: orange; }\n');
  writeFileSync(`${app}src/extra.ts`, "import './extra.css';\nexport const label = 'Extra';\n");
  writeFileSync(
    `${app}src/routes/extra.brm`,
    [
      '<script>',
      "  import { $signal } from 'brumate/signals';",
      "  import { label } from '../extra.ts';",
      '  let count = $signal(0);',
      '</script>',
      '',
      '<button class="extra" onClick=(() => (count += label.length))>{count}</button>',
      '',
      '<style>',
      '  .own { color: blue; }',
      '</style>',
      '',
    ].join('\n'),
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
  plugins: [...sheets(undefined), brumate({ merge: 0 })],
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

/** The CSS assets of a client build, as the plugins after the plugin see them. */
const assets = new Map<string, string>();
/** The assets of the build of the first describe, and of the builds with damaged marks. */
const seen = new Map<string, string>();
const damagedAssets = new Map<string, Map<string, string>>();
const damagedHandles = new Map<string, Handle>();

/**
 * Listed before the plugin, so it sees the bundle first or last: `damage` changes the marks in
 * the sheets before the plugin cuts them, and `watch` records the sheets after.
 */
function sheets(damage: 'missing' | 'reordered' | undefined): Plugin[] {
  const record = (bundle: Record<string, { type: string; source?: unknown }>): void => {
    for (const [name, item] of Object.entries(bundle)) {
      if (item.type === 'asset' && name.endsWith('.css')) {
        assets.set(name, String(item.source));
      }
    }
  };
  return [
    {
      name: 'damage-marks',
      enforce: 'pre',
      generateBundle: {
        order: 'pre',
        handler(_options, bundle) {
          for (const item of Object.values(bundle)) {
            if (item.type !== 'asset' || !String(item.name ?? item.fileName).endsWith('.css')) {
              continue;
            }
            const marks = [
              ...String(item.source).matchAll(/\.(b-mark-[\w-]+)\{--b-mark:[\w-]+\}/g),
            ];
            if (marks.length < 2 || !damage) {
              continue;
            }
            let source = String(item.source);
            if (damage === 'missing') {
              source = source.replace(marks[0]![0], '');
            } else {
              // The first two marks swap names, so the sheet has them out of order.
              const [first, second] = [marks[0]![1]!, marks[1]![1]!];
              source = source
                .replaceAll(first, '@@')
                .replaceAll(second, first)
                .replaceAll('@@', second);
            }
            item.source = source;
          }
        },
      },
    },
    {
      name: 'watch-sheets',
      enforce: 'post',
      generateBundle(_options, bundle) {
        record(bundle);
      },
    },
  ];
}

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

/** The `<style b-style>` elements of some HTML, by component ID. */
function inlineStyles(html: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, id, css] of html.matchAll(/<style[^>]* b-style="([^"]+)">([^<]*)<\/style>/g)) {
    found.set(id!, css!);
  }
  return found;
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
  // The sheets that later plugins saw in the build above.
  for (const [name, source] of assets) {
    seen.set(name, source);
  }
  assets.clear();
  // The same app with damaged marks in the sheets, which fall back to blocking links.
  for (const damage of ['missing', 'reordered'] as const) {
    const damaged: InlineConfig = {
      ...config,
      plugins: [...sheets(damage), brumate({ merge: 0, clientOutDir: `${damage}/client` })],
    };
    await build({
      ...damaged,
      build: { outDir: `${damage}/client`, rolldownOptions: { input: 'src/client.ts' } },
    });
    await build({
      ...damaged,
      build: {
        outDir: `${damage}/server`,
        ssr: true,
        rolldownOptions: { input: 'src/server.ts' },
      },
    });
    damagedAssets.set(damage, new Map(assets));
    assets.clear();
    damagedHandles.set(
      damage,
      ((await import(pathToFileURL(`${app}${damage}/server/server.js`).href)) as { handle: Handle })
        .handle,
    );
  }
  // The same app with a relative base, which keeps the inline stylesheets. A plugin of its own,
  // as a project has one base: the plugin keeps what it compiled across the builds of a process.
  const relative: InlineConfig = {
    ...config,
    base: './',
    plugins: [brumate({ merge: 0, clientOutDir: 'relative/client' })],
  };
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
  it('is in no module of the client build, and in no `$$css` of the server build', () => {
    const found: string[] = [];
    for (const folder of ['dist/client', 'dist/server']) {
      for (const [name, code] of files(folder)) {
        if (
          name.endsWith('.js') &&
          (code.includes('$$css') || (folder === 'dist/client' && code.includes('.card')))
        ) {
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
    expect(css).toMatch(/\.frame:where\(\[b-c-\w+\]\)\{padding:4px\}/);
    expect(css).toMatch(/\.card:where\(\[b-c-\w+\]\)\{background:var\(--s-[\w-]+\)\}/);
    expect(css).toMatch(/\.tag:where\(\[b-c-\w+-1\]\)\{color:#?\w+\}/);
    expect(css).toMatch(/\.plain:where\(\[b-c-\w+\]\)\{color:green\}/);
  });

  it('reaches a page as inline styles of the components it renders, with no blocking link', async () => {
    const html = await page('/');
    const head = html
      .slice(0, html.indexOf('<body'))
      .replace(/<noscript[^>]*>.*?<\/noscript>/g, '');
    expect(head).not.toContain('<link rel="stylesheet"');
    const styles = inlineStyles(head);
    let css = '';
    for (const text of styles.values()) {
      css += text;
    }
    // The card has no client code, and its CSS is in the page as the other components' is.
    expect(css).toMatch(/\.card:where\(\[b-c-\w+\]\)/);
    expect(css).toMatch(/\.count:where\(\[b-c-\w+\]\)/);
    expect(css).toMatch(/\.frame:where\(\[b-c-\w+\]\)/);
    // The value of the variable is on the element, as in development.
    expect(html).toMatch(/style="--s-[\w-]+: ?teal"/);
  });

  it('writes each component once in the head, in the same order on every request', async () => {
    const first = await page('/');
    const second = await page('/');
    const body = first.indexOf('<body');
    const styles = [...first.matchAll(/<style[^>]* b-style="([^"]+)"/g)];
    expect(styles.length).toBeGreaterThan(0);
    for (const style of styles) {
      expect(style.index).toBeLessThan(body);
    }
    expect(second).toBe(first);
    expect(new Set(styles.map((style) => style[1])).size).toBe(styles.length);
  });

  it('preloads the stylesheets of the bundles of the first load, and links them for a navigation', async () => {
    const first = await page('/');
    const preloads = [...first.matchAll(/<link rel="preload" as="style" b-sheet href="([^"]+)">/g)];
    expect(preloads.length).toBeGreaterThan(0);
    const response = await handle(
      new Request('http://localhost/', { headers: { 'x-brumate-base': '0' } }),
    );
    const navigation = await response!.text();
    expect(navigation).not.toContain('b-sheet');
    expect(linkedCss(navigation)).toMatch(/\.count:where\(\[b-c-\w+\]\)/);
    // What the page preloads and what the navigation links are the same files, so a later
    // navigation finds them in the cache.
    for (const [, href] of preloads) {
      expect(navigation).toContain(`href="${href}"`);
    }
  });

  it('writes the CSS of a page with no client code inline', async () => {
    const html = await page('/plain');
    expect(html).toMatch(
      /<style[^>]* b-style="[^"]+">[^<]*\.plain:where\(\[b-c-\w+\]\)\{color:green\}/,
    );
  });

  it('writes the CSS of a component that only a `#defer` body renders, in that body', async () => {
    const html = await page('/later');
    const [, at, boundary, base] = /b-b="([^"]+)" b-defer="[^":]+:([^":]+):([^"]+)"/.exec(html)!;
    const response = await handle(
      new Request('http://localhost/later', {
        headers: { 'x-brumate-defer': `${boundary} ${at}`, 'x-brumate-base': base! },
      }),
    );
    const body = await response!.text();
    expect(body).toContain('class="late"');
    expect(body).toMatch(
      /<style[^>]* b-style="[^"]+">[^<]*\.late:where\(\[b-c-\w+\]\)\{color:purple\}/,
    );
  });

  it('writes the CSS after the pipeline: `url()` and `@import` as the sheet has them', async () => {
    const html = await page('/pic');
    const styles = [...inlineStyles(html)].filter(([id]) => id.startsWith('Pic_'));
    expect(styles).toHaveLength(1);
    const text = styles[0]![1];
    // The asset is the built one, and the import is inlined.
    expect(text).toMatch(/url\((?:data:image\/png|\/assets\/bg-)/);
    expect(text).not.toContain('./bg.png');
    expect(text).not.toContain('@import');
    expect(text).toContain('.shared');
    expect(text).not.toContain('b-mark');
    let sheets = '';
    for (const [name, code] of files('dist/client')) {
      if (name.endsWith('.css')) {
        sheets += code;
      }
    }
    expect(sheets).toContain(text);
    expect(sheets).not.toContain('b-mark');
  });

  it('keeps a sheet with a plain CSS file in its chunk as a blocking link', async () => {
    const html = await page('/extra');
    const head = html
      .slice(0, html.indexOf('<body'))
      .replace(/<noscript[^>]*>.*?<\/noscript>/g, '');
    const links = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)];
    expect(links.length).toBeGreaterThan(0);
    let css = '';
    for (const [, href] of links) {
      css += readFileSync(`${app}dist/client${href}`, 'utf8');
    }
    expect(css).toContain('.extra');
    // No preload names that sheet.
    for (const [, href] of links) {
      expect(head).not.toContain(`rel="preload" as="style" b-sheet href="${href}"`);
    }
  });

  it('names the components with global rules of each sheet that loads late', () => {
    const hints = JSON.parse(readFileSync(`${app}dist/client/.brumate/hints.json`, 'utf8')) as {
      deferred: Record<string, string[]>;
    };
    const entries = Object.entries(hints.deferred);
    // The layout has `<style global>`, so a page that does not render it keeps its sheet blocking.
    expect(entries.some(([, ids]) => ids.some((id) => id.startsWith('Layout_')))).toBe(true);
    // A sheet with a plain CSS file in its chunk is not in the table.
    expect(entries.filter(([url]) => url.includes('Extra_'))).toEqual([]);
  });

  it('adds a `<noscript>` link for each preloaded sheet', async () => {
    const html = await page('/');
    const preloads = [...html.matchAll(/<link rel="preload" as="style" b-sheet href="([^"]+)">/g)];
    expect(preloads.length).toBeGreaterThan(0);
    for (const [, href] of preloads) {
      expect(html).toContain(`<noscript b-sheet><link rel="stylesheet" href="${href}"></noscript>`);
    }
  });

  it('writes the same rules inline as the stylesheets of the bundles hold', async () => {
    const html = await page('/');
    let sheets = '';
    for (const [name, code] of files('dist/client')) {
      if (name.endsWith('.css')) {
        sheets += code;
      }
    }
    const missing: string[] = [];
    for (const text of inlineStyles(html).values()) {
      for (const rule of text.split('}')) {
        // A `${}` value has its own variable name in each build of the CSS text, so compare the selector.
        const selector = rule.split('{')[0]!;
        if (selector && !sheets.includes(selector)) {
          missing.push(selector);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  // A render outside the routes writes the CSS of each component at its first instance.
  it('reaches a render outside the routes', async () => {
    const html = await custom();
    expect(html).toContain('class="card"');
    expect(html.includes('.card:where([') || linkedCss(html).includes('.card:where([')).toBe(true);
  });
});

describe('the marks in the sheets of a build', () => {
  it('are gone from the sheets that the plugins after the plugin see', () => {
    expect(seen.size).toBeGreaterThan(0);
    for (const source of seen.values()) {
      expect(source).not.toContain('b-mark');
    }
  });

  it.each(['missing', 'reordered'] as const)(
    'with %s marks fall back to blocking links and leave no mark',
    async (damage) => {
      const found = damagedAssets.get(damage)!;
      expect(found.size).toBeGreaterThan(0);
      for (const source of found.values()) {
        expect(source).not.toContain('b-mark');
      }
      const files = readdirSync(`${app}${damage}/client`, { recursive: true }) as string[];
      let text = '';
      for (const name of files) {
        text += name.endsWith('.css') ? readFileSync(`${app}${damage}/client/${name}`, 'utf8') : '';
      }
      expect(text).not.toContain('b-mark');
      const hints = JSON.parse(
        readFileSync(`${app}${damage}/client/.brumate/hints.json`, 'utf8'),
      ) as { css: Record<string, string>; deferred: Record<string, string[]> };
      // The sheet of the page, with the index and the card, lost its marks: no inline CSS for them.
      expect(Object.keys(hints.css).some((id) => id.startsWith('Card_'))).toBe(false);
      const response = await damagedHandles.get(damage)!(new Request('http://localhost/'));
      const html = await response!.text();
      const head = html
        .slice(0, html.indexOf('<body'))
        .replace(/<noscript[^>]*>.*?<\/noscript>/g, '');
      // The sheet blocks the paint, as a sheet with CSS that the page cannot inline.
      expect(head).toMatch(/<link rel="stylesheet" href="[^"]*Index_[^"]+\.css">/);
      expect(head).not.toMatch(/b-style="Card_/);
    },
  );
});

describe('component CSS in a build with a relative base', () => {
  it('stays inline, as the server could not link an asset from a page at any depth', async () => {
    const html = await page('/', relativeHandle);
    expect(html).toMatch(/<style[^>]*>[^<]*\.card:where\(\[b-c-\w+\]\)/);
    let modules = '';
    for (const [name, code] of files('relative/server')) {
      if (name.endsWith('.js')) {
        modules += code;
      }
    }
    expect(modules).toContain('$$css');
    const assets = [...files('relative/client').keys()];
    // The CSS file that a script imports is an asset still.
    expect(assets.filter((name) => name.endsWith('.css') && !name.includes('Extra'))).toEqual([]);
  });
});
