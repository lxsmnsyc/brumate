import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { InlineConfig } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import brumate from '../src/vite.ts';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));
const output = fileURLToPath(new URL('./.output/async-effects-build/', import.meta.url));

/** A page whose button writes `n`, and an effect that reads it. */
function page(callback: string): string {
  return `<script>\n  import { $effect, $signal } from 'brumate/signals';\n  let n = $signal(0);\n  $effect(${callback});\n</script>\n<button onClick=(() => n++)>{n}</button>\n`;
}

/** Builds the client of an app with one page, unminified so the names stay. */
async function bundle(name: string, source: string): Promise<string> {
  const root = `${output}${name}/`;
  rmSync(root, { recursive: true, force: true });
  mkdirSync(`${root}src/routes`, { recursive: true });
  writeFileSync(
    `${root}src/client.ts`,
    "import { start } from 'brumate/loader';\nimport { load } from 'virtual:brumate/manifest';\nstart({ load });\n",
  );
  writeFileSync(`${root}src/server.ts`, "export { handle } from 'virtual:brumate/routes';\n");
  writeFileSync(`${root}src/routes/index.brm`, source);
  const config: InlineConfig = {
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [brumate({ merge: 0 })],
    resolve: {
      alias: {
        'brumate/server': runtime('server'),
        'brumate/client': runtime('client'),
        'brumate/loader': runtime('loader'),
        'brumate/static-loader': runtime('static-loader'),
        'brumate/bundles': runtime('bundles'),
        'brumate/signals': runtime('signals'),
        'brumate/hot': runtime('hot'),
        'brumate/routes': runtime('routes'),
        'brumate/context': runtime('context'),
        'brumate/events': runtime('events'),
        'brumate/serial': runtime('values'),
        'brumate/stream': runtime('gather'),
      },
    },
    build: { outDir: 'dist/client', minify: false, rolldownOptions: { input: 'src/client.ts' } },
  };
  await build(config);
  let code = '';
  const assets = `${root}dist/client/assets`;
  for (const file of readdirSync(assets)) {
    if (file.endsWith('.js')) {
      code += readFileSync(`${assets}/${file}`, 'utf8');
    }
  }
  return code;
}

describe('the client bundle', () => {
  let sync = '';
  let asynchronous = '';

  beforeAll(async () => {
    sync = await bundle('sync', page('() => { console.log(n); }'));
    asynchronous = await bundle(
      'async',
      page('async () => { await Promise.resolve(); console.log(n); }'),
    );
  });

  it('has no asyncEffect when every effect is sync', () => {
    expect(sync).toContain('function effect(');
    expect(sync).not.toContain('asyncEffect');
  });

  it('has asyncEffect when an effect is async', () => {
    expect(asynchronous).toContain('function asyncEffect(');
  });
});
