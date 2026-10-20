// Type-checked with the package. It fails to compile if the global declarations are wrong.
/// <reference path="../globals.d.ts" />

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
