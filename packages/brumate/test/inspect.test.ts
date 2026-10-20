import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyzeProjectProps, inspect } from '../src/index.ts';

const directory = new URL('./render/', import.meta.url);
const sources = new Map(
  readdirSync(directory)
    .filter((name) => name.endsWith('.brm'))
    .map((name) => [name, readFileSync(new URL(name, directory), 'utf8')]),
);
const props = analyzeProjectProps(sources);

function report(name: string): string {
  const parents = props.get(name)!;
  return inspect(sources.get(name)!, {
    filename: name,
    liveProps: new Set(parents.keys()),
    parents,
  }).text;
}

describe('inspect', () => {
  it.each(['todos.brm', 'Badge.brm', 'Child.brm'])('%s', async (name) => {
    await expect(report(name)).toMatchFileSnapshot(
      `./__snapshots__/inspect/${name.replace('.brm', '.txt')}`,
    );
  });

  it('says when a file is compiled alone', () => {
    expect(inspect(sources.get('Badge.brm')!, { filename: 'Badge.brm' }).text).toContain(
      'compiled alone, so every prop can change',
    );
  });

  it('runs from the command line', () => {
    const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
    const output = execFileSync(process.execPath, [cli, 'inspect', '--json', 'Badge.brm'], {
      cwd: fileURLToPath(directory),
      encoding: 'utf8',
    });
    const [badge] = JSON.parse(output);
    expect(badge.name).toBe('Badge');
    expect(badge.changes[0]).toEqual({
      label: 'prop label',
      at: '2:11',
      reason: 'toolbar.brm passes a value that changes',
    });
  });
});
