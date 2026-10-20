import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

/** Compiles a component and returns its warnings. */
function warnings(script: string, markup = ''): string[] {
  const source = `<script>\n${script}\n</script>\n\n${markup}`;
  return compile(source, { filename: 'Test.brm' }).warnings.map((warning) =>
    source.slice(warning.range.start, warning.range.end),
  );
}

describe('changes in place', () => {
  it('warns when a method changes a signal value in place', () => {
    expect(
      warnings(`let todos = $signal([]);
function add() {
  todos.push(1);
}`),
    ).toEqual(['todos.push(1)']);
  });

  it('warns when a property of a reactive value is written', () => {
    expect(
      warnings(
        `const { todo } = $props();
let list = $signal([{ done: false }]);
function done() {
  todo.done = true;
  list[0].done = true;
  list.length++;
}`,
      ),
    ).toEqual(['todo.done = true', 'list[0].done = true', 'list.length++']);
  });

  it('does not warn for new values, drafts and local values', () => {
    expect(
      warnings(`let todos = $signal([]);
function add() {
  todos = [...todos, 1];
  todos = $produce(todos, (draft) => {
    draft.push(1);
  });
  const copy = todos.slice();
  copy.push(1);
  todos.map((todo) => todo).sort();
}`),
    ).toEqual([]);
  });
});
