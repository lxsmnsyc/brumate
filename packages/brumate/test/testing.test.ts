import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createVitest } from 'vitest/node';
import { expect, it } from 'vitest';
import brumate from '../src/vite.ts';

// test/testing/app.fixture.ts is a component test, as an app has one: it runs in
// happy-dom with the brumate plugin, and answers calls with `answerCalls`.
const root = fileURLToPath(new URL('./testing/', import.meta.url));
const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));
const alias = Object.fromEntries(
  ['server', 'client', 'loader', 'signals', 'testing', 'context', 'batch'].map((name) => [
    `brumate/${name}`,
    runtime(name),
  ]),
);

it('gives a DOM test the server code of a file of server functions under the query', async () => {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [brumate()],
    resolve: { alias },
    server: { middlewareMode: true },
  });
  try {
    const client = server.environments.client;
    // Client code gets the stubs.
    expect((await client.transformRequest('/notes.ts'))?.code).toContain('rpc(');
    const real = (await client.transformRequest('/notes.ts?brumate-server'))?.code;
    expect(real).toContain('notes.push(text)');
    expect(real).not.toContain('Promise<void>');
    // The server version of a component imports the server code, and the plain module as it is.
    const component = (await client.transformRequest('/Notes.brm?brumate-server'))?.code;
    expect(component).toMatch(/notes\.ts\?brumate-server/);
    expect(component).toMatch(/store\.ts["']/);
    const registry = (await client.transformRequest('virtual:brumate/server'))?.code;
    expect(registry).toContain('notes.ts?brumate-server');
    expect(registry).toMatch(/Notes\.brm\?(import&)?brumate-server/);
    // The server environment imports the files as they are.
    const ssr = (await server.environments.ssr.transformRequest('virtual:brumate/server'))?.code;
    expect(ssr).not.toContain('?brumate-server');
  } finally {
    await server.close();
  }
});

it('answers the calls of a mounted component with the real server functions', async () => {
  const exitCode = process.exitCode;
  const vitest = await createVitest(
    {
      root,
      config: false,
      watch: false,
      include: ['*.fixture.ts'],
      environment: 'happy-dom',
      reporters: [],
    },
    { plugins: [brumate()], resolve: { alias }, logLevel: 'silent' },
  );
  try {
    const result = await vitest.start();
    const failures = result.testModules.flatMap((module) =>
      [...module.children.allTests()].flatMap((test) =>
        (test.result().errors ?? []).map((error) => `${test.name}: ${error.message}`),
      ),
    );
    expect(failures).toEqual([]);
    expect(result.unhandledErrors).toEqual([]);
    expect(
      result.testModules.flatMap((module) => Array.from(module.children.allTests('passed'))),
    ).toHaveLength(6);
  } finally {
    await vitest.close();
    process.exitCode = exitCode;
  }
}, 30_000);
