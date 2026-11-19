import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { Rolldown } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import brumate from '../../src/vite.ts';

// A build of an app keeps the code that names elements for a transition only when one of its
// components uses `viewTransition` or `viewTransitionName`.

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../../src/runtime/${name}.ts`, import.meta.url));

const COUNTER = `<script>
  import { $signal } from 'brumate/signals';
  import { transition } from 'brumate/events';
  let count = $signal(0);
</script>

<button onClick=(transition(() => count++))>{count}</button>
`;

const MARKED = `${COUNTER}
<p viewTransition="card">Card</p>
`;

/** The code of all chunks of a production build of an app with one component. */
async function buildApp(name: string, source: string): Promise<string> {
  const root = fileURLToPath(
    new URL(`../.output/view-transitions-build/${name}/`, import.meta.url),
  );
  rmSync(root, { recursive: true, force: true });
  mkdirSync(`${root}src`, { recursive: true });
  writeFileSync(`${root}src/App.brm`, source);
  writeFileSync(`${root}src/client.ts`, "import 'virtual:brumate/start';\n");
  const result = (await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [brumate({})],
    resolve: {
      alias: {
        'brumate/client': runtime('client'),
        'brumate/loader': runtime('loader'),
        'brumate/static-loader': runtime('static-loader'),
        'brumate/bundles': runtime('bundles'),
        'brumate/context': runtime('context'),
        'brumate/signals': runtime('signals'),
      },
    },
    build: {
      write: false,
      minify: true,
      rolldownOptions: { input: 'src/client.ts' },
    },
  })) as Rolldown.RolldownOutput;
  let code = '';
  for (const item of result.output) {
    if (item.type === 'chunk') {
      code += item.code;
    }
  }
  return code;
}

describe('view transitions', () => {
  beforeAll(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('adds no naming code to an app that has no marked element', async () => {
    const code = await buildApp('without', COUNTER);
    expect(code).toContain('startViewTransition');
    expect(code).not.toContain('b-vtn');
  });

  it('keeps the naming code for an app with one', async () => {
    const code = await buildApp('with', MARKED);
    expect(code).toContain('b-vtn');
  });
});
