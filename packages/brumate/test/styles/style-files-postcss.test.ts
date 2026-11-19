import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, createServer } from 'vite';
import type { InlineConfig } from 'vite';
import type { Plugin as PostCSSPlugin } from 'postcss';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import brumate from '../../src/vite.ts';

// The builds of the client and the server take more than the default 5s on a CI runner.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../../src/runtime/${name}.ts`, import.meta.url));

const app = fileURLToPath(new URL('../.output/style-files-postcss/', import.meta.url));

/** A page with a client script and two components with CSS that a transform changes. */
function writeApp(): void {
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}src/routes`, { recursive: true });
  writeFileSync(
    `${app}src/client.ts`,
    "import { start } from 'brumate/loader';\nimport { load } from 'virtual:brumate/manifest';\nstart({ load });\n",
  );
  writeFileSync(`${app}src/server.ts`, "export { handle } from 'virtual:brumate/routes';\n");
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
      '  <body>{children}</body>',
      '</html>',
      '',
    ].join('\n'),
  );
  writeFileSync(
    `${app}src/routes/index.brm`,
    [
      '<script>',
      "  import { $signal } from 'brumate/signals';",
      "  import Card from '../Card.brm';",
      "  import Tile from '../Tile.brm';",
      '  let count = $signal(0);',
      '</script>',
      '',
      '<button class="count" onClick=(() => count++)>{count}</button>',
      '<Card />',
      '<Tile />',
      '',
    ].join('\n'),
  );
  writeFileSync(
    `${app}src/Card.brm`,
    '<div class="card">Card</div>\n\n<style>\n  .card { color: red; inset: 0; }\n</style>\n',
  );
  // A component that imports a CSS file and has a `url()`, on a page below the root.
  writeFileSync(`${app}src/imp.css`, '.imp-rule { color: blue; }\n');
  writeFileSync(`${app}src/bg.png`, Buffer.from('iVBORw0KGgo=', 'base64'));
  writeFileSync(
    `${app}src/Pic.brm`,
    [
      '<div class="pic">Pic</div>',
      '',
      '<style>',
      "  @import './imp.css';",
      '  .pic { background: url(./bg.png) no-repeat; }',
      '</style>',
      '',
    ].join('\n'),
  );
  mkdirSync(`${app}src/routes/nested`, { recursive: true });
  writeFileSync(
    `${app}src/routes/nested/pic.brm`,
    "<script>\n  import Pic from '../../Pic.brm';\n</script>\n\n<Pic />\n",
  );
  writeFileSync(
    `${app}src/Tile.brm`,
    '<div class="tile">Tile</div>\n\n<style>\n  .tile { color: red; inset: 0; }\n</style>\n',
  );
}

/** Changes `red` to a color that no other rule has, so the CSS shows that the plugin ran. */
const repaint: PostCSSPlugin = {
  postcssPlugin: 'repaint',
  Declaration(declaration) {
    if (declaration.prop === 'color' && declaration.value === 'red') {
      declaration.value = '#010203';
    }
  },
};

/** Drops every rule that only sets a custom property, which includes the marks. */
const dropProperties: PostCSSPlugin = {
  postcssPlugin: 'drop-properties',
  Rule(rule) {
    const declarations = rule.nodes.filter((node) => node.type === 'decl');
    if (declarations.length > 0 && declarations.every((node) => node.prop.startsWith('--'))) {
      rule.remove();
    }
  },
};

/**
 * The CSS options of each build. Vite runs PostCSS or Lightning CSS on a stylesheet, never both.
 * The minifier is Lightning CSS in both, with `build.cssTarget` as its targets, and it joins
 * `top`, `right`, `bottom` and `left` into `inset` again unless the target needs them apart.
 */
const variants: Record<string, { css: InlineConfig['css']; cssTarget?: string; base?: string }> = {
  postcss: { css: { postcss: { plugins: [repaint] } } },
  lightning: {
    css: { transformer: 'lightningcss', lightningcss: { targets: { safari: 12 << 16 } } },
    cssTarget: 'safari12',
  },
  dropped: { css: { postcss: { plugins: [dropProperties] } } },
  // A relative base keeps the CSS inline, and Vite's CSS plugin never sees it.
  relative: { css: { postcss: { plugins: [repaint] } }, base: './' },
};

type Handle = (request: Request) => Promise<Response | undefined>;
const handles = new Map<string, Handle>();

/** The text of the CSS assets of a variant. */
function sheetsOf(name: string): string {
  let text = '';
  for (const file of readdirSync(`${app}${name}/client`, { recursive: true }) as string[]) {
    if (file.endsWith('.css')) {
      text += readFileSync(`${app}${name}/client/${file}`, 'utf8');
    }
  }
  return text;
}

/** The `<style b-style>` elements of some HTML, by component ID. */
function inlineStyles(html: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, id, css] of html.matchAll(/<style[^>]* b-style="([^"]+)">([^<]*)<\/style>/g)) {
    found.set(id!, css!);
  }
  return found;
}

async function page(name: string): Promise<string> {
  const response = await handles.get(name)!(new Request('http://localhost/'));
  expect(response?.status).toBe(200);
  return await response!.text();
}

beforeAll(async () => {
  writeApp();
  for (const [name, { css, cssTarget, base }] of Object.entries(variants)) {
    const config: InlineConfig = {
      root: app,
      configFile: false,
      logLevel: 'silent',
      css,
      base,
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
    await build({
      ...config,
      build: { outDir: `${name}/client`, cssTarget, rolldownOptions: { input: 'src/client.ts' } },
    });
    await build({
      ...config,
      build: {
        outDir: `${name}/server`,
        cssTarget,
        ssr: true,
        rolldownOptions: { input: 'src/server.ts' },
      },
    });
    handles.set(
      name,
      ((await import(pathToFileURL(`${app}${name}/server/server.js`).href)) as { handle: Handle })
        .handle,
    );
  }
});

describe('component CSS in a build with a PostCSS plugin', () => {
  it('takes the plugin in the sheet', () => {
    const sheets = sheetsOf('postcss');
    expect(sheets).toContain('#010203');
    expect(sheets).not.toContain('red');
    expect(sheets).not.toContain('b-mark');
  });

  it('writes the same CSS inline as the sheet has', async () => {
    const styles = [...inlineStyles(await page('postcss'))].filter(([id]) =>
      /^(Card|Tile)_/.test(id),
    );
    expect(styles).toHaveLength(2);
    const sheets = sheetsOf('postcss');
    for (const [, text] of styles) {
      expect(text).toContain('#010203');
      expect(text).not.toContain('red');
      expect(sheets).toContain(text);
    }
  });
});

describe('component CSS in a build with Lightning CSS targets', () => {
  it('lowers `inset` in the sheet and the inline copy, which is the sheet text', async () => {
    const sheets = sheetsOf('lightning');
    expect(sheets).not.toContain('inset');
    expect(sheets).not.toContain('b-mark');
    expect(sheets).toContain('top:0');
    const styles = [...inlineStyles(await page('lightning'))].filter(([id]) =>
      /^(Card|Tile)_/.test(id),
    );
    expect(styles).toHaveLength(2);
    for (const [, text] of styles) {
      expect(text).not.toContain('inset');
      expect(text).toContain('top:0');
      expect(sheets).toContain(text);
    }
  });

  it('does not run the PostCSS plugins of the project, as Vite runs one transformer', () => {
    expect(sheetsOf('lightning')).toContain('red');
  });

  it('keeps `inset` without targets', async () => {
    expect(sheetsOf('postcss')).toContain('inset:0');
    const styles = [...inlineStyles(await page('postcss'))].filter(([id]) =>
      /^(Card|Tile)_/.test(id),
    );
    expect(styles).toHaveLength(2);
    for (const [, text] of styles) {
      expect(text).toContain('inset:0');
    }
  });
});

describe('a PostCSS plugin that drops the marks', () => {
  it('leaves no inline CSS and links the sheet, which has the component CSS', async () => {
    const html = await page('dropped');
    const head = html
      .slice(0, html.indexOf('<body'))
      .replace(/<noscript[^>]*>.*?<\/noscript>/g, '');
    expect([...inlineStyles(html).keys()].filter((id) => /^(Card|Tile)_/.test(id))).toEqual([]);
    const links = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)];
    let css = '';
    for (const [, href] of links) {
      css += readFileSync(`${app}dropped/client${href}`, 'utf8');
    }
    expect(css).toContain('.card[');
    expect(css).toContain('.tile[');
    expect(sheetsOf('dropped')).not.toContain('b-mark');
  });
});

describe('component CSS in a build with a relative base', () => {
  it('takes the PostCSS plugin in the inline CSS', async () => {
    const styles = [...inlineStyles(await page('relative'))].filter(([id]) =>
      /^(Card|Tile)_/.test(id),
    );
    expect(styles).toHaveLength(2);
    for (const [, text] of styles) {
      expect(text).toContain('#010203');
      expect(text).not.toContain('red');
    }
  });
});

describe('url() and @import in a build with a relative base', () => {
  it('inlines the import, which is global, and leaves `url()` as written', async () => {
    const response = await handles.get('relative')!(new Request('http://localhost/nested/pic'));
    const html = await response!.text();
    expect(html).toContain('.imp-rule');
    // The page can be at any depth, so no URL relative to the file can be written.
    expect(html).toContain('url(./bg.png)');
  });
});

describe('@import in component CSS', () => {
  it('is inlined after the scoping, so its rules are global', () => {
    const sheets = sheetsOf('postcss');
    expect(sheets).toContain('.imp-rule');
    expect(sheets).not.toContain('.imp-rule[b-c-');
  });

  it('keeps the sheet of the component blocking for a page that does not render it', () => {
    const hints = JSON.parse(readFileSync(`${app}postcss/client/.brumate/hints.json`, 'utf8')) as {
      deferred: Record<string, string[]>;
    };
    expect(
      Object.values(hints.deferred).some((ids) => ids.some((id) => id.startsWith('Pic_'))),
    ).toBe(true);
  });
});

describe('component CSS in the dev server', () => {
  it('takes the PostCSS plugin in the render and in a hot update', async () => {
    const dev = await createServer({
      root: app,
      configFile: false,
      logLevel: 'silent',
      appType: 'custom',
      server: { middlewareMode: true },
      css: { postcss: { plugins: [repaint] } },
      plugins: [brumate({ merge: 0 })],
    });
    const messages: unknown[] = [];
    const send = dev.ws.send.bind(dev.ws) as (payload: unknown) => void;
    dev.ws.send = ((payload: unknown) => {
      messages.push(payload);
      send(payload);
    }) as typeof dev.ws.send;
    const file = `${app}src/Card.brm`;
    const original = readFileSync(file, 'utf8');
    try {
      const { handle } = (await dev.ssrLoadModule('/src/server.ts')) as { handle: Handle };
      const response = await handle(new Request('http://localhost/'));
      const html = await response!.text();
      expect(html).toContain('#010203');
      expect(html).not.toContain('color:red');
      // A client is needed for the update, so the page is loaded as a module once.
      await dev.ssrLoadModule('/src/Card.brm');
      writeFileSync(file, original.replace('inset: 0', 'inset: 1px; color: red'));
      await vi.waitFor(
        () => {
          const update = JSON.stringify(messages);
          expect(update).toContain('brumate:update');
          expect(update).toContain('#010203');
          expect(update).not.toContain('color: red');
        },
        { timeout: 15_000 },
      );
    } finally {
      writeFileSync(file, original);
      await dev.close();
    }
  });
});

describe('imports and urls in the CSS of the dev server', () => {
  it('rewrites `url()` to the file, and follows a change to an imported file', async () => {
    const dev = await createServer({
      root: app,
      configFile: false,
      logLevel: 'silent',
      appType: 'custom',
      server: { middlewareMode: true },
      css: { postcss: { plugins: [repaint] } },
      plugins: [brumate({ merge: 0 })],
    });
    const messages: unknown[] = [];
    const send = dev.ws.send.bind(dev.ws) as (payload: unknown) => void;
    dev.ws.send = ((payload: unknown) => {
      messages.push(payload);
      send(payload);
    }) as typeof dev.ws.send;
    const file = `${app}src/imp.css`;
    const original = readFileSync(file, 'utf8');
    const render = async (): Promise<string> => {
      const { handle } = (await dev.ssrLoadModule('/src/server.ts')) as { handle: Handle };
      const response = await handle(new Request('http://localhost/nested/pic'));
      return await response!.text();
    };
    try {
      const html = await render();
      // The page is two folders deep, so a URL relative to it would miss the file.
      expect(html).toContain('url(/src/bg.png)');
      expect(html).toContain('.imp-rule { color: blue; }');
      writeFileSync(file, original.replace('blue', 'green'));
      await vi.waitFor(
        async () => {
          expect(await render()).toContain('.imp-rule { color: green; }');
          const update = JSON.stringify(messages);
          expect(update).toContain('brumate:update');
          expect(update).toContain('green');
        },
        { timeout: 15_000 },
      );
    } finally {
      writeFileSync(file, original);
      await dev.close();
    }
  });
});
