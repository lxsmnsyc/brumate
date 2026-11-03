import { fileURLToPath } from 'node:url';
import { createVitest } from 'vitest/node';
import { expect, it } from 'vitest';
import brumate from '../src/vite.ts';

// test/testing-a11y/a11y.fixture.ts checks mounted components with axe-core, in happy-dom.
const root = fileURLToPath(new URL('./testing-a11y/', import.meta.url));
const runtime = (name: string): string =>
  fileURLToPath(new URL(`../src/runtime/${name}.ts`, import.meta.url));
const alias = Object.fromEntries(
  ['server', 'client', 'loader', 'signals', 'testing', 'context', 'batch'].map((name) => [
    `brumate/${name}`,
    runtime(name),
  ]),
);

it('checks a mounted component with axe-core', async () => {
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
    ).toHaveLength(5);
  } finally {
    await vitest.close();
    process.exitCode = exitCode;
  }
}, 30_000);
