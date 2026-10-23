// Type-checked with the package. It fails to compile if the declarations of brumate/signals are wrong.
import {
  $bind,
  $client,
  $effect,
  $memo,
  $produce,
  $props,
  $signal,
  $untrack,
} from '../src/runtime/signals.ts';
import type { Bindable } from '../src/runtime/signals.ts';

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

// `$bind` passes only to a prop that is `Bindable`, of the same type.
interface DialogProps {
  title: string;
  open?: Bindable<boolean>;
  count?: number;
}
export function bindings(open: boolean, label: string): DialogProps[] {
  const { open: shown } = $props<DialogProps>();
  const value: boolean | undefined = shown;
  return [
    { title: 'a', open },
    { title: 'b', open: $bind(open) },
    { title: 'c', open: $bind(open, (next) => next satisfies boolean) },
    // @ts-expect-error A prop that is not Bindable does not take a binding.
    { title: 'd', count: $bind(1) },
    // @ts-expect-error A binding of another type.
    { title: 'e', open: $bind(label) },
    { title: String(value) },
  ];
}
