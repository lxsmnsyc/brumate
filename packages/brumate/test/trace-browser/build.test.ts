import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import brumate from '../../src/vite.ts';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../../src/runtime/${name}.ts`, import.meta.url));
const output = fileURLToPath(new URL('../.output/trace-browser/', import.meta.url));

const page = [
  '<script>',
  "  import { $signal } from 'brumate/signals';",
  '  let count = $signal(0);',
  '</script>',
  '',
  '<button onClick=(() => count++)>{count}</button>',
  '',
].join('\n');

/** Builds the client of an app whose entry is `entry`, and reads its scripts. */
async function bundle(
  name: string,
  entry: string,
  settings: { trace?: boolean | 'auto'; files?: Record<string, string>; warnings?: string[] } = {},
): Promise<{ files: string[]; code: string; gzip: number }> {
  const app = `${output}${name}/`;
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}src/routes`, { recursive: true });
  writeFileSync(`${app}src/client.ts`, entry);
  writeFileSync(`${app}src/routes/index.brm`, page);
  for (const [file, text] of Object.entries(settings.files ?? {})) {
    writeFileSync(`${app}src/${file}`, text);
  }
  await build({
    root: app,
    configFile: false,
    logLevel: 'silent',
    plugins: [brumate({ merge: 0, trace: settings.trace })],
    resolve: {
      alias: {
        'brumate/client': runtime('client'),
        'brumate/loader': runtime('loader'),
        'brumate/static-loader': runtime('static-loader'),
        'brumate/signals': runtime('signals'),
        'brumate/events': runtime('events'),
        'brumate/context': runtime('context'),
        'brumate/routes': runtime('routes'),
        'brumate/hot': runtime('hot'),
        'brumate/serial': runtime('values'),
        'brumate/stream': runtime('gather'),
        'brumate/server': runtime('server'),
        'brumate/bundles': runtime('bundles'),
      },
    },
    build: {
      outDir: 'dist/client',
      rolldownOptions: {
        input: 'src/client.ts',
        onLog(_level, log) {
          settings.warnings?.push(log.message);
        },
      },
    },
  });
  const dir = `${app}dist/client/assets/`;
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.js'))
    .toSorted();
  let code = '';
  for (const file of files) {
    code += readFileSync(`${dir}${file}`, 'utf8');
  }
  return { files, code, gzip: gzipSync(code).length };
}

const start = (options: string): string =>
  `import { start } from 'brumate/loader';\nimport { load } from 'virtual:brumate/manifest';\nstart({ load${options} });\n`;

const startWith = (spread: string): string =>
  `import { start } from 'brumate/loader';\nimport { load } from 'virtual:brumate/manifest';\nimport { options } from './options.ts';\nstart({ load, ${spread.replace('...options', '...options')} });\n`;

let off: Awaited<ReturnType<typeof bundle>>;
let on: Awaited<ReturnType<typeof bundle>>;

beforeAll(async () => {
  off = await bundle('off', start(''));
  on = await bundle('on', start(', onTrace: (span) => console.log(span)'));
});

describe('the build flag', () => {
  it('leaves the code of the spans out of a build whose entry has no onTrace', () => {
    for (const text of [
      'brumate.event',
      'brumate.load',
      'brumate.run',
      'http.route',
      'brumate.fetch',
      'traceparent',
    ]) {
      expect(off.code).not.toContain(text);
    }
    expect(off.code).not.toContain('__BRUMATE_TRACE__');
  });

  it('keeps it in a build whose entry passes onTrace', () => {
    for (const text of [
      'brumate.event',
      'brumate.load',
      'brumate.run',
      'http.route',
      'brumate.fetch',
      'traceparent',
    ]) {
      expect(on.code).toContain(text);
    }
    expect(on.gzip).toBeGreaterThan(off.gzip);
    console.log(
      `trace-browser bytes: off ${off.gzip} gzip, on ${on.gzip} gzip, ${off.files.length} and ${on.files.length} files`,
    );
  });
});

describe('the trace option of the plugin', () => {
  const words = ['brumate.event', 'traceparent'];

  it('turns the spans on for an entry with no onTrace when it is true', async () => {
    const forced = await bundle('forced', start(''), { trace: true });
    for (const text of words) {
      expect(forced.code).toContain(text);
    }
  });

  it('turns the spans off for an entry with onTrace when it is false', async () => {
    const left = await bundle('left', start(', onTrace: (span) => console.log(span)'), {
      trace: false,
    });
    for (const text of words) {
      expect(left.code).not.toContain(text);
    }
  });

  it('warns when onTrace is named in a script that the scan cannot place', async () => {
    const warnings: string[] = [];
    const hidden = await bundle('hidden', startWith('...options'), {
      warnings,
      files: {
        'options.ts': 'export const options = { onTrace: (span: unknown) => console.log(span) };\n',
      },
    });
    for (const text of words) {
      expect(hidden.code).not.toContain(text);
    }
    expect(warnings.some((message) => message.includes('options.ts names onTrace'))).toBe(true);
  });

  it('does not warn for the onTrace of the server middleware', async () => {
    const warnings: string[] = [];
    await bundle('server', start(''), {
      warnings,
      files: {
        'middleware.ts': 'export function onTrace(span: unknown): void { console.log(span); }\n',
      },
    });
    expect(warnings.some((message) => message.includes('onTrace'))).toBe(false);
  });
});
