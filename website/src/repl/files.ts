// The files of the REPL: its examples, and the link that shares them.

export interface ReplFile {
  name: string;
  source: string;
}

export interface Example {
  name: string;
  files: ReplFile[];
}

export const examples: Example[] = [
  {
    name: 'Counter',
    files: [
      {
        name: 'App.brm',
        source: `<script>
  import { $memo, $signal } from 'brumate/signals';

  let count = $signal(0);
  const double = $memo(count * 2);
</script>

<h1>A counter</h1>
<button onClick=(() => count++)>Clicked {count} times</button>
<p>Double: {double}</p>
`,
      },
    ],
  },
  {
    name: 'Todos',
    files: [
      {
        name: 'App.brm',
        source: `<script>
  import { $memo, $signal } from 'brumate/signals';
  import { prevent } from 'brumate/events';

  let todos = $signal([{ id: 1, title: 'Write the docs', done: false }]);
  let draft = $signal('');
  const left = $memo(todos.filter((todo) => !todo.done).length);

  function add() {
    todos = [...todos, { id: Date.now(), title: draft, done: false }];
    draft = '';
  }

  function toggle(id: number) {
    todos = todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo));
  }
</script>

<form onSubmit=(prevent(add))>
  <input value=draft placeholder="Add a todo" onInput=((event) => (draft = event.currentTarget.value))>
</form>
<ul>
  #for (todo of todos by todo.id) {
    <li>
      <label>
        <input type="checkbox" checked=(todo.done) onChange=(() => toggle(todo.id))>
        {todo.title}
      </label>
    </li>
  }
</ul>
<p>{left} left</p>
`,
      },
    ],
  },
  {
    name: 'Components',
    files: [
      {
        name: 'App.brm',
        source: `<script>
  import Card from './Card.brm';
</script>

<Card title="First">
  <p>Children render where the card inserts them.</p>
</Card>
<Card title="Second">
  <p>Each card has its own state.</p>
</Card>
`,
      },
      {
        name: 'Card.brm',
        source: `<script>
  import { $props, $signal } from 'brumate/signals';

  const { title, children } = $props<{ title: string; children?: unknown }>();
  let open = $signal(true);
</script>

<section>
  <button onClick=(() => (open = !open))>{open ? 'Hide' : 'Show'} {title}</button>
  #if (open) {
    {children}
  }
</section>

<style>
  section {
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 8px;
  }
</style>
`,
      },
    ],
  },
  {
    name: 'Shared logic',
    files: [
      {
        name: 'App.brm',
        source: `<script>
  import { counter } from './counter.brm.ts';

  const { count, double, increment, reset } = counter(10);
</script>

<button onClick=increment>Clicked {count} times</button>
<button onClick=reset>Reset</button>
<p>Double: {double}</p>
`,
      },
      {
        name: 'counter.brm.ts',
        source: `import { $memo, $signal } from 'brumate/signals';

export function counter(start: number) {
  let count = $signal(start);
  const double = $memo(count * 2);

  function increment() {
    count++;
  }

  return { count, double, increment, reset: () => (count = start) };
}
`,
      },
    ],
  },
  {
    name: 'Server function',
    files: [
      {
        name: 'App.brm',
        source: `<script>
  import { $memo, $signal } from 'brumate/signals';

  async function greet(name: string) {
    'use server';
    await new Promise((resolve) => setTimeout(resolve, 500));
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
    ],
  },
  {
    name: 'Styles',
    files: [
      {
        name: 'App.brm',
        source: `<script>
  import { $signal } from 'brumate/signals';

  let big = $signal(false);
</script>

<p>Hello</p>
<button onClick=(() => (big = !big))>Toggle</button>

<style>
  p {
    font-size: \${big ? 2 : 1}rem;
    transition: font-size 0.2s;
  }
</style>
`,
      },
    ],
  },
];

/** The files in the address, so a link shares them. */
export function encode(files: ReplFile[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(files));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/** The files of a link. A link of the old playground holds the source of one component. */
export function decode(hash: string): ReplFile[] | undefined {
  if (!hash) {
    return undefined;
  }
  try {
    const base64 = hash.replaceAll('-', '+').replaceAll('_', '/');
    const text = new TextDecoder().decode(
      Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)),
    );
    if (!text.startsWith('[')) {
      return [{ name: 'App.brm', source: text }];
    }
    const files = JSON.parse(text) as ReplFile[];
    return Array.isArray(files) &&
      files.length > 0 &&
      files.every((file) => typeof file.name === 'string' && typeof file.source === 'string')
      ? files
      : undefined;
  } catch {
    return undefined;
  }
}

/** A file name that the REPL can run: a component or a module of reactive logic. */
export function validName(name: string, taken: string[]): string | undefined {
  if (!/^[\w-]+(\.brm|\.brm\.ts|\.ts)$/.test(name)) {
    return 'A file name ends with .brm, .brm.ts or .ts, and has only letters, digits, - and _.';
  }
  if (taken.includes(name)) {
    return `There is already a file named ${name}.`;
  }
  return undefined;
}

/** The size of a module, in bytes and gzipped. */
export async function measure(code: string): Promise<{ bytes: number; gzip: number }> {
  const bytes = new TextEncoder().encode(code);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const gzip = (await new Response(stream).arrayBuffer()).byteLength;
  return { bytes: bytes.length, gzip };
}
