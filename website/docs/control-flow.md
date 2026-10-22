# Control flow

Blocks start with `#`, such as `#if` and `#for`, and wrap their body in braces. A block's code ships to the browser only if what it depends on can change there. Otherwise the block is HTML only.

## `#if`

`#if (condition)` renders its body when the condition is true. `#else if` and `#else` follow it:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let temperature = $signal(18);
</script>

<label>
  Temperature
  <input type="range" min="-10" max="40" value=temperature onInput=((event) => (temperature = Number(event.currentTarget.value)))>
</label>
#if (temperature < 5) {
  <p>{temperature}°: bring a coat.</p>
} #else if (temperature < 22) {
  <p>{temperature}°: a sweater will do.</p>
} #else {
  <p>{temperature}°: t-shirt weather.</p>
}
```

## `#for`

`#for (item of list)` renders its body for each item. `#else` renders when the list is empty:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let people = $signal([
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Grace' },
    { id: 3, name: 'Edsger' },
  ]);

  function remove(id: number) {
    people = people.filter((person) => person.id !== id);
  }
</script>

<ol>
  #for (person, index of people by person.id) {
    <li>
      {index + 1}. {person.name}
      <button onClick=(() => remove(person.id))>Remove {person.name}</button>
    </li>
  } #else {
    <li>Everyone left.</li>
  }
</ol>
```

- `person, index` names the item and its position. The index is optional.
- `by person.id` is the key. When the list changes, items with the same key keep their elements, and only items that changed update.
- `by index` keys items by their position. Without `by`, each item is its own key, which suits lists of strings and numbers.
- The item can be destructured: `#for ({ id, name } of people by id)`.

Pick a key that stays the same for an item, such as an ID from a database. A key that changes renders the item again.

## `#repeat`

`#repeat (index of count)` renders its body `count` times, with `index` from 0. `#else` renders when the count is 0:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let rating = $signal(3);
</script>

<p>
  #repeat (star of 5) {
    <button onClick=(() => (rating = star + 1)) aria-label=(`Rate ${star + 1}`)>{star < rating ? '★' : '☆'}</button>
  }
</p>
<p>{rating} of 5</p>
```

## `#switch`

`#switch` renders the first `#case` whose condition is true, or `#default`:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let tab = $signal<'profile' | 'settings' | 'help'>('profile');
</script>

<nav>
  <button onClick=(() => (tab = 'profile'))>Profile</button>
  <button onClick=(() => (tab = 'settings'))>Settings</button>
  <button onClick=(() => (tab = 'help'))>Help</button>
</nav>
#switch {
  #case (tab === 'profile') {
    <p>Your name and photo.</p>
  }
  #case (tab === 'settings') {
    <p>Notifications and privacy.</p>
  }
  #default {
    <p>Questions and answers.</p>
  }
}
```

## `#key`

`#key (value)` renders its body again when the value changes. The state inside the body starts over, such as the signals of a block script or of a component:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let contact = $signal('Ada');
</script>

<button onClick=(() => (contact = contact === 'Ada' ? 'Grace' : 'Ada'))>Switch contact</button>
#key (contact) {
  <script>
    let note = $signal('');
  </script>
  <label>
    Note for {contact}
    <input value=note onInput=((event) => (note = event.currentTarget.value))>
  </label>
}
```

Type a note, then switch: the field empties, because the body renders again for the new contact.

## `#offscreen`

`#offscreen (visible)` shows its body while `visible` is true. When it turns false, the body is hidden but stays in the page, with its elements and its state:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let tab = $signal<'note' | 'reply'>('note');
</script>

<style>
  .panel {
    display: grid;
    gap: 4px;
  }
</style>

<nav>
  <button onClick=(() => (tab = 'note'))>Note</button>
  <button onClick=(() => (tab = 'reply'))>Reply</button>
</nav>
#offscreen (tab === 'note') {
  <script>
    let draft = $signal('');
  </script>
  <label class="panel note">
    Note
    <textarea onInput=((event) => (draft = event.currentTarget.value))></textarea>
  </label>
  <p class="count">{draft.length} characters</p>
}
#offscreen (tab === 'reply') {
  <label class="panel reply">
    Reply
    <textarea></textarea>
  </label>
}
```

Type a note, open the reply and come back: the note is still there.

- A body that is hidden when the page renders is not rendered. The browser renders it the first time it shows, and keeps it after.
- Each element at the top level of a hidden body gets an inline `display: none !important`, which a class such as `.panel` does not override. Text at the top level is emptied. The elements keep their own inline `display` for when the body shows.
- The markup still updates while it is hidden, so it is current when it shows.
- The `$effect` and `$client` callbacks of the body run their cleanups when it hides, and do not run while it is hidden. When it shows, the ones that ran before, or whose values changed, run once with the current values.
- `<window>` and `<document>` listeners in the body do not run while it is hidden.
- The content of a `#portal` in the body hides with it.
- A nested `#offscreen` is hidden while any `#offscreen` around it is hidden.
- When the block itself is removed, such as by an `#if` around it, its body is removed as other blocks are.

Use it for tabs, steps of a form, or panels that the user switches between. Use `#if` when the body should start over each time it shows.

## `#try` and `#catch`

`#try` renders its body, and `#catch` renders instead if the body throws. `#catch (error, reset)` names the error and a function that renders the body again:

```brm live
<script module>
  let ready = false;

  export function connect(): void {
    ready = true;
  }

  export function status(): string {
    if (!ready) {
      throw new Error('Not connected');
    }
    return 'Connected';
  }
</script>

#try {
  <p>{status()}</p>
} #catch (error, reset) {
  <p>{String(error)}</p>
  <button onClick=(() => { connect(); reset(); })>Connect and try again</button>
}
```

- An error in a component inside the body is caught too.
- When the body throws on the server, nothing it rendered reaches the page: not its markup, its `#portal` and `#head` blocks, its title, its `#loading` bodies, or the state of its components. A component's stylesheet that only the body rendered is sent with the next copy of the component, such as one in `#catch`.
- `reset` runs in the browser. If the body throws again, `#catch` renders again.

## `#loading`

`#loading` renders its `#else` body first, and its own body once the values it reads have loaded. The rest of the page does not wait for them:

```brm live
<script>
  import { $memo } from 'brumate/signals';

  async function quote(): Promise<string> {
    'use server';
    await new Promise((done) => setTimeout(done, 1500));
    return 'Ship less code to the browser.';
  }

  const text = $memo(quote());
</script>

<p>The page is here.</p>
#loading {
  <blockquote>{text}</blockquote>
} #else {
  <p>Loading a quote…</p>
}
```

[Async data](./async-data.md) describes loading data, `#loading` and `$isPending`.

## `#portal`

`#portal` renders its body somewhere else in the page, such as a dialog at the end of the body. `#portal (target)` renders into an element or the element that a selector finds:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let open = $signal(false);
</script>

<section id="portal-demo-target"></section>
<button onClick=(() => (open = !open))>{open ? 'Hide' : 'Show'} the notice</button>
#if (open) {
  #portal ('#portal-demo-target') {
    <p>This paragraph renders inside the section above the button.</p>
  }
}
```

- Without a target, the body goes to the end of the page.
- With a target, the body renders into it when the page loads in the browser. When the target changes, the body moves.
- The content of a portal is removed with the block that contains it, such as the `#if` above.

## `#head`

`#head` renders its body into the `<head>` of the page, for tags such as `<meta>` and `<link>`:

```brm
#head {
  <meta name="description" content=(`${count} items in your cart`)>
}
```

[Page metadata](./page-metadata.md) describes `#head` and `$title`.

## `#client`

`#client` skips its body on the server. The browser renders it when its trigger fires: `'visible'`, the default, when it comes into view; `'idle'` when the browser is idle; or `'load'` when the page loads:

```brm live
<script>
  const rendered = 'the browser';
</script>

<p>This paragraph comes from the server.</p>
#client ('idle') {
  <p>This one was rendered by {rendered}, at {new Date().toLocaleTimeString()}.</p>
}
```

Use it for markup that needs the browser, such as a map or a chart. [Effects and browser code](./effects.md) compares it with `$client` and `$effect`.

An `#else` body renders on the server in place of the body, until the body renders:

```brm live
#client ('idle') {
  <p>Your time zone is {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
} #else {
  <p>Finding your time zone…</p>
}
```

- The fallback can keep the space of the body, so the page does not move when the body renders.
- With `'visible'`, the block renders when the fallback comes into view.
- Without scripts, the fallback stays.

## `#defer`

`#defer` renders its body on the server later, in a request of its own. The page has the `#else` body until the trigger fires, with the same triggers as `#client`. The browser then asks the server for the body, which replaces the fallback:

```brm
#defer ('visible') {
  <Recommendations user=user />
} #else {
  <p>Loading recommendations…</p>
}
```

Use it for markup that the server renders but that the first response does not need, such as content far below the fold, or the parts of a cached page that depend on the user.

- The body renders on the server, with the same route, request, cookies and values as the page. It can call server functions and read the database.
- The request goes to the URL of the page, so middleware runs for it as it does for the page. The answer has `vary: x-brumate-defer`, and so does the page.
- The server renders the route again for the request, up to the block. It renders the `#loading` and `#defer` bodies around the block, without sending them, and no other body. Data that the page loads before the block loads again. Data that only the body needs is not loaded for the page: put it in the body, such as in a component inside it.
- If the page's data changed since it loaded, and the block is not where the browser has it, the fallback stays.
- Without scripts, the fallback stays. A prerendered page needs a server for the request.
- A `#defer` block can be inside a `#loading` or `#defer` body. It cannot be inside a `#client` body, or in markup that the browser renders, such as a branch of an `#if` that changes. The compiler reports it in the same file.
- A component with a `#defer` block that the browser renders, such as inside the `#client` body of its parent, keeps the fallback. The compiler cannot see this across files.

`#client` renders its body in the browser, for markup that needs the browser. `#defer` renders it on the server, for markup that needs the server.

## `#template`

`#template name(parameters)` declares a piece of markup that takes arguments. Call it in an expression:

```brm live
<script>
  const total = 42;
</script>

#template price(label: string, amount: number) {
  <p><strong>{label}:</strong> ${amount.toFixed(2)}</p>
}

{price('Subtotal', total)}
{price('Tax', total * 0.1)}
```

- A template can read the values of the component.
- Declare templates at the top level of the markup or at the start of a block body.
- A template can be passed as a prop, so a component renders your markup for its data. See [Components](./components.md#templates-as-props).

## A script in a block

A block body can start with a `<script>`. It runs for each instance of the body, such as for each item of a `#for`, and can declare signals and functions of its own:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  const questions = [
    { id: 1, title: 'What runs in the browser?', answer: 'Only the code that events reach.' },
    { id: 2, title: 'What does the server send?', answer: 'HTML with the state in it.' },
  ];
</script>

#for (question of questions by question.id) {
  <script>
    let open = $signal(false);
  </script>
  <button onClick=(() => (open = !open)) aria-expanded=(String(open))>{question.title}</button>
  #if (open) {
    <p>{question.answer}</p>
  }
}
```

Each question has its own `open`. The script can read the item and the values of the component.
