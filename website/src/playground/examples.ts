// The examples that the playground opens with.

export interface Example {
  name: string;
  source: string;
}

export const examples: Example[] = [
  {
    name: 'Counter',
    source: `<script>
  let count = $signal(0);
  const double = $memo(count * 2);
</script>

<h1>A counter</h1>
<button onClick=(() => count++)>Clicked {count} times</button>
<p>Double: {double}</p>
`,
  },
  {
    name: 'Todos',
    source: `<script>
  let todos = $signal([{ id: 1, title: 'Write the docs', done: false }]);
  let draft = $signal('');
  const left = $memo(todos.filter((todo) => !todo.done).length);

  function add() {
    todos = [...todos, { id: Date.now(), title: draft, done: false }];
    draft = '';
  }
</script>

<form onSubmit:prevent=add>
  <input value=draft onInput=((event) => (draft = event.currentTarget.value))>
</form>
<ul>
  #for (todo of todos by todo.id) {
    <li class={ done: todo.done }>{todo.title}</li>
  }
</ul>
<p>{left} left</p>
`,
  },
  {
    name: 'Server function',
    source: `<script>
  async function greet(name: string) {
    'use server';
    return \`Hello, \${name}\`;
  }

  let name = $signal('Ada');
  const greeting = $memo(greet(name));
</script>

<input value=name onInput=((event) => (name = event.currentTarget.value))>
#loading {
  <p>{greeting}</p>
} #else {
  <p>Loading</p>
}
`,
  },
  {
    name: 'Styles',
    source: `<script>
  let big = $signal(false);
</script>

<style>
  p {
    font-size: \${big ? 2 : 1}rem;
  }
</style>

<p>Hello</p>
<button onClick=(() => (big = !big))>Toggle</button>
`,
  },
];
