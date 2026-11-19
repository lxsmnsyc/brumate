import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { Rolldown } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import brumate from '../../src/vite.ts';

// A build of an app keeps the code for scripts in markup only when one of its components has a
// script with a trigger or a script of `#head`.

const runtime = (name: string): string =>
  fileURLToPath(new URL(`../../src/runtime/${name}.ts`, import.meta.url));

const COUNTER = `<script>
  import { $signal } from 'brumate/signals';
  let count = $signal(0);
</script>

<button onClick=(() => count++)>{count}</button>
`;

const SCRIPTED = `${COUNTER}
#head {
  <script src="https://a.test/chat.js" trigger="idle"></script>
}
`;

/** The code of all chunks of a production build of an app with one component. */
async function buildApp(name: string, source: string): Promise<string> {
  const root = fileURLToPath(
    new URL(`../.output/external-scripts-build/${name}/`, import.meta.url),
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

const SHELL = `<script>
  import { $signal } from 'brumate/signals';
  import { raw } from 'brumate/html';
  let count = $signal(0);
</script>

{raw('<script type="module" src="/src/client.ts"></script>')}
<button onClick=(() => count++)>{count}</button>
`;

describe('scripts in markup', () => {
  beforeAll(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('adds no code to an app without a script in markup', async () => {
    const code = await buildApp('without', COUNTER);
    expect(code).not.toContain('b-script');
    expect(code).not.toContain('createScriptURL');
  });

  it('adds no code to an app that writes a script tag as a string', async () => {
    const code = await buildApp('shell', SHELL);
    expect(code).not.toContain('b-script');
    expect(code).not.toContain('createScriptURL');
  });

  it('keeps the loader code and the Trusted Types method for an app with one', async () => {
    const code = await buildApp('with', SCRIPTED);
    expect(code).toContain('template[b-script]');
    expect(code).toContain('createScriptURL');
  });
});
