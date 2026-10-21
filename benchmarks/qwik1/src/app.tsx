import { component$, useSignal, useComputed$ } from '@builder.io/qwik';

interface Todo {
  id: string;
  title: string;
  done: boolean;
}

export const Counter = component$(() => {
  const count = useSignal(0);
  const double = useComputed$(() => count.value * 2);
  return (
    <>
      <button onClick$={() => count.value++}>Clicked {count.value} times</button>
      <p>Double: {double.value}</p>
    </>
  );
});

export const App = component$<{ initial: Todo[] }>((props) => {
  const todos = useSignal(props.initial);
  const draft = useSignal('');
  const next = useSignal(props.initial.length + 1);
  const left = useComputed$(() => todos.value.filter((todo) => !todo.done).length);
  return (
    <>
      <h1>Todos</h1>
      <form
        preventdefault:submit
        onSubmit$={() => {
          if (draft.value.trim() === '') return;
          todos.value = [
            ...todos.value,
            { id: String(next.value), title: draft.value, done: false },
          ];
          next.value++;
          draft.value = '';
        }}
      >
        <input
          value={draft.value}
          placeholder="What needs doing?"
          onInput$={(_, el) => (draft.value = el.value)}
        />
        <button>Add</button>
      </form>
      <ul>
        {todos.value.map((todo) => (
          <li key={todo.id} class={{ done: todo.done }}>
            <button
              class="todo"
              onClick$={() => {
                todos.value = todos.value.map((item) =>
                  item.id === todo.id ? { ...item, done: !item.done } : item,
                );
              }}
            >
              {todo.title}
            </button>
          </li>
        ))}
      </ul>
      <p>{left.value} left</p>
      <h2>Counter</h2>
      <Counter />
    </>
  );
});
