// Type-checked with the package. It fails to compile if the declarations of brumate/signals are wrong.
import {
  $client,
  $effect,
  $memo,
  $produce,
  $props,
  $signal,
  $untrack,
} from '../src/runtime/signals.ts';

interface Todo {
  id: string;
  done: boolean;
}

export function component(): void {
  const { initial = [] } = $props<{ initial?: Todo[] }>();
  let todos = $signal(initial);
  const left: number = $memo(todos.filter((todo) => !todo.done).length);
  const user: string = $memo(Promise.resolve('Ada'));
  let input = $signal<HTMLInputElement>();
  $effect(() => {
    document.title = `${left} ${user}`;
    return () => {};
  });
  $client(() => input?.focus(), 'idle');
  const untracked: Todo[] = $untrack(todos);
  $produce(todos, (draft) => {
    draft.push({ id: String(untracked.length), done: false });
  });
  todos = [];
  input = undefined;
}

// A memo of an async iterable holds its values, one at a time.
async function* ticks(): AsyncGenerator<number> {
  yield 1;
}
const tick: number = $memo(ticks());
void tick;
