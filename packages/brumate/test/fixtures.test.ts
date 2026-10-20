import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze, buildGraph, parse, printAST, printGraph, printModel } from '../src/index.ts';

const directory = new URL('./fixtures/', import.meta.url);
const fixtures = readdirSync(directory).filter((name) => name.endsWith('.brm'));

describe('fixtures', () => {
  it.each(fixtures)('%s', async (name) => {
    const source = readFileSync(new URL(name, directory), 'utf8');
    const file = parse(source, { filename: name });
    const model = analyze(file);
    const graph = buildGraph(model);
    const output = [
      '# Syntax tree',
      printAST(file),
      '',
      '# Semantic model',
      printModel(source, model),
      '',
      '# Graph',
      printGraph(source, graph),
      '',
    ].join('\n');
    await expect(output).toMatchFileSnapshot(`./__snapshots__/${name.replace('.brm', '.txt')}`);
  });
});
