# Forms and actions

A form can post to a server function. It works before any script loads, and with scripts turned off. Once the loader runs, the same form posts without a full page load.

## A form that posts to a server function

Set the `action` of the form to a server function. The function gets the `FormData` of the form.

```brm
<script>
  async function subscribe(form: FormData) {
    'use server';
    await db.subscribers.insert(String(form.get('email')));
  }
</script>

<form action=subscribe>
  <label>
    Email
    <input name="email" type="email" required>
  </label>
  <button>Subscribe</button>
</form>
```

- The form gets `method="post"` unless it sets its own method.
- `formaction=fn` on a button posts that button to another server function.
- The value must be a server function of the component, or one that it imports from a `'use server'` file. Any other value renders as a normal attribute.

What happens when the form is sent:

- **Without scripts**, the browser posts the form. When the function returns, the browser goes back to the page that posted, which renders again with the new data.
- **With the loader**, the form is sent with `fetch`, and the page that comes back replaces the current one without a full page load. The place on the page is kept when it is the same page. See [Navigation](./navigation.md#forms).

## Showing the result with `$action`

A form often needs the answer of its function, such as an error to show next to a field. `$action(fn)` holds the latest result of a server function that a form of this component posts to.

```brm live
<script module>
  // Kept in memory for the sample. A real app would use a database.
  const emails: string[] = [];
</script>

<script>
  import { $action, $isPending } from 'brumate/signals';

  async function signUp(form: FormData) {
    'use server';
    const email = String(form.get('email') ?? '').trim();
    if (!email.includes('@')) {
      return { error: 'Enter an email address', count: emails.length };
    }
    emails.push(email);
    return { error: '', count: emails.length };
  }

  const result = $action(signUp);
</script>

<form action=signUp>
  <label>
    Email
    <input name="email">
  </label>
  <button disabled=($isPending(result))>Sign up</button>
</form>
#if (result?.error) {
  <p role="alert">{result.error}</p>
} #else if (result) {
  <p>Signed up. {result.count} people so far.</p>
}
```

- The result is `undefined` until the form is sent.
- Return errors as values, such as `{ error }`, so the page can show them. A thrown error answers with its message instead, as for other forms.
- With the loader, the result arrives without loading a page, and the fields keep what was typed. `$isPending(result)` is true while the form is sent. Only the answer to the latest send is kept.
- Without scripts, the page renders again with the result. The fields are new, so return the values that they should show.

## Validating a form

`parseForm(schema, form)` from `brumate/server` turns the fields of a form into an object, and checks it with a [Standard Schema](https://standardschema.dev). It returns `{ value }` or `{ issues }`, and does not throw. `fieldErrors(issues)` groups the messages by field, for `$action` to show:

```brm live
<script module>
  import type { StandardSchemaV1 } from 'brumate/server';

  type SignUp = { email: string; age: number };

  // A schema written by hand. A schema library, such as Zod or Valibot, makes the same object.
  const SignUp: StandardSchemaV1<unknown, SignUp> = {
    '~standard': {
      version: 1,
      vendor: 'sample',
      validate(input) {
        const { email, age } = input as Record<string, unknown>;
        const issues: StandardSchemaV1.Issue[] = [];
        if (typeof email !== 'string' || !email.includes('@')) {
          issues.push({ message: 'Enter an email address', path: ['email'] });
        }
        if (!(Number(age) >= 18)) {
          issues.push({ message: 'You must be 18 or older', path: ['age'] });
        }
        return issues.length > 0
          ? { issues }
          : { value: { email: email as string, age: Number(age) } };
      },
    },
  };
</script>

<script>
  import { $action } from 'brumate/signals';
  import { fieldErrors, parseForm } from 'brumate/server';

  async function signUp(form: FormData) {
    'use server';
    const result = await parseForm(SignUp, form);
    if (result.issues) {
      return { errors: fieldErrors(result.issues), email: '' };
    }
    return { errors: {} as Record<string, string[]>, email: result.value.email };
  }

  const result = $action(signUp);
</script>

<form action=signUp>
  <label>
    Email
    <input name="email">
  </label>
  #if (result?.errors.email) {
    <p role="alert">{result.errors.email[0]}</p>
  }
  <label>
    Age
    <input name="age" inputmode="numeric">
  </label>
  #if (result?.errors.age) {
    <p role="alert">{result.errors.age[0]}</p>
  }
  <button>Sign up</button>
</form>
#if (result?.email) {
  <p>Signed up as {result.email}.</p>
}
```

How the fields become an object:

- A name that appears once holds its value.
- A name that appears more than once holds an array of its values, in the order of the form.
- A name that ends with `[]`, such as `tags[]`, always holds an array, under the name without `[]`. Use it for a list that can have one item, such as checkboxes.
- Dots nest objects: `address.city` and `address.zip` make `{ address: { city, zip } }`. A number between dots is a key of an object, not an index of an array.
- An index in brackets makes a list: `items[0].name` and `items[1].name` make `{ items: [{ name }, { name }] }`. An index is at most 999.
- Values stay strings, and files stay `File` values. The schema turns a string into a number or a date.
- A name with an empty part, such as `a..b`, a part named `__proto__`, `constructor` or `prototype`, or an index above 999, is an issue, and the schema does not run. So a form cannot change the prototype of an object, or make a huge list.
- A name that needs an object where another field holds a value, such as `a` and `a.b`, is an issue too.

What `fieldErrors` returns:

- The key is the path of the issue joined with dots, such as `address.city`, and the value is the list of its messages.
- Issues without a path, such as a check across two fields, are under the key `''`.
- The result is plain data, so the function can return it to the page.

`parse(schema, value)` throws instead, with status 400. Use it for values that a correct page always sends right. Without scripts, the browser shows its message as text. See [Validating arguments](./server-functions.md#validating-arguments).

## Forms with `createForm`

`createForm` from `brumate/forms` gives the attributes of a form and of its fields: names, IDs, the values that were posted, errors and their ARIA attributes, and buttons that add and remove the items of a list. Its server function reads the form with `parseSubmission` from `brumate/server`. The form works without scripts, and with scripts it posts without loading the page.

```brm
<script>
  import { createForm } from 'brumate/forms';
  import { parseSubmission } from 'brumate/server';
  import { Order } from '../schema.ts';

  async function save(form: FormData) {
    'use server';
    const submission = await parseSubmission(Order, form);
    if (submission.status !== 'success') {
      // The errors, and the values as posted, so the fields show what was typed.
      return submission.reply();
    }
    if (await db.orders.exists(submission.value.email)) {
      return submission.reply({ formErrors: ['That email has an order already'] });
    }
    await db.orders.save(submission.value);
    return submission.reply({ reset: true });
  }

  const { attrs, fields, errors, defaultSubmit } = createForm(save, Order, {
    defaultValue: { email: '', items: [{ name: '' }] },
  });
</script>

<form action=save {...attrs}>
  <button {...defaultSubmit}></button>

  <label for=(fields.email.id)>Email</label>
  <input {...fields.email.attrs} type="email" required>
  #if (fields.email.errors) {
    <p {...fields.email.errorAttrs}>{fields.email.errors[0]}</p>
  }

  #for (item of fields.items.list by item.key) {
    <input {...item.fields.name.attrs} aria-label="Item">
    <button {...item.remove}>Remove</button>
  }
  <button {...fields.items.insert}>Add an item</button>

  #if (errors) {
    <p role="alert">{errors[0]}</p>
  }
  <button>Save</button>
</form>
```

### The server function

`parseSubmission(schema, form, options?)` reads the fields as `parseForm` does, and validates them with the schema. It does not throw. Its `status` is:

- `success`: the values passed the schema. `value` is the output of the schema.
- `error`: the values did not pass, or a field name was not allowed.
- `intent`: a button such as "Add an item" was pressed. The schema does not run.

`submission.reply(options?)` is what the function returns. It holds the values as posted, the errors of each field by field name, such as `items[0].name`, and the errors of the whole form. Its options:

- `formErrors`: more errors of the whole form, such as a check against the database.
- `fieldErrors`: more errors of fields, by field name.
- `reset: true`: the form goes back to its default values, such as after a save.

Files are never sent back, because a file input cannot be filled again. List other fields that must not come back, such as a password, in `options.hide`:

```ts
const submission = await parseSubmission(SignUp, form, { hide: ['password'] });
```

### Fields

`fields` follows the default value. Each field has:

- `attrs`: `name`, `id`, `aria-invalid` and `aria-describedby` when it has errors, and the value to show. A string or a number is `value`, and a boolean is `checked`.
- `errors`: its messages, or `undefined`.
- `errorAttrs`: the ID that `aria-describedby` names, and `role="alert"` after a submit.
- `value`: the posted value after a submit, or the default value. Use it where `attrs` does not fit, such as the text of a `<textarea>` or the boxes of a group of checkboxes.
- `name` and `id`.

An object has its fields in `fields`, such as `fields.address.fields.city`. A list has:

- `list`: its items. Each item is a field with a `key` for `#for … by`, its `index`, and `remove`, `moveUp` and `moveDown`, the attributes of buttons that change the list.
- `insert`: the attributes of a button that adds an item at the end.

`defaultValue` names every field that the form shows. A list of objects has one item in it, and new items take its fields.

### Buttons that change a list

The buttons of a list are submit buttons with the name `__intent`. With scripts, a button changes the list in the browser at once. Without scripts, it posts the form, and the server applies the change to the posted values:

- With scripts, the items that stay keep their elements and what was typed in them. A new item gets a new key.
- Its click handler wraps `prevent`, so with scripts the form never posts for it, even before its code loads.
- They work without scripts, since a submit button posts its value only when it is pressed.
- They have `formnovalidate`, so a list can grow while the form is incomplete.
- An intent shows no errors, so the fields that the user has not filled yet show none.
- The server checks the change. A list cannot grow past 1000 items, and a name must be a field of the form.

Enter in a field presses the first submit button of the form. `defaultSubmit` is a hidden submit button. Put it first, so Enter saves the form instead of pressing "Remove".

### Validating in the browser

`attrs` holds an `onFocusOut` and an `onInput` handler. They validate the fields with the schema in the browser, so errors show before a submit:

- A field shows its errors once the user leaves it. After that, they change as the user types.
- After a submit, every field shows its errors as the user types.
- The errors of the browser replace those of the reply, until the next reply.
- The errors of the whole form come from the browser only after a submit. Before, they are those of the reply, such as a check against the database.
- The schema loads with the first focus out or input, not with the page.

The schema runs in the browser, so it must not import server code. A check that needs the server, such as a database, goes in the server function, with `reply({ formErrors })` or `reply({ fieldErrors })`.

### With and without scripts

- Without scripts, the form posts, and the page renders again with the reply. The fields show what was posted, with their errors.
- With scripts, the reply arrives without loading the page. The buttons of a list change it in the browser.
- With the code of the form loaded, the fields validate as the user leaves them and types.
- A reply with `reset: true` sets the fields back to their default values.

## Redirects after a post

`redirect(location)` from `brumate/server` sends the browser to another page, with or without scripts:

```ts
import { redirect } from 'brumate/server';

async function createPost(form: FormData) {
  'use server';
  const id = await db.posts.insert(String(form.get('title')));
  redirect(`/posts/${id}`);
}
```

A function that throws a `ServerError` answers with its status and message. Without scripts, the browser shows the message as text, because there is no page to show it in. Return errors as values with `$action` to show them on the page.

## Files

A form with a file input sends its files to the function as `File` values in the `FormData`:

```brm
<script>
  async function upload(form: FormData) {
    'use server';
    const file = form.get('avatar') as File;
    await storage.put(file.name, await file.arrayBuffer());
  }
</script>

<form action=upload enctype="multipart/form-data">
  <label>
    Avatar
    <input type="file" name="avatar">
  </label>
  <button>Upload</button>
</form>
```

Set `enctype="multipart/form-data"`, so the browser sends the files when scripts are off. A handler can also pass a file to a server function directly. See [Server functions](./server-functions.md#files).

## Forms posted twice

A form can be posted twice: a double click before the page loads, or a post again after a reload or the back button. For a function that must not run twice, such as one that places an order, wrap it in `idempotent` from `brumate/server`:

```ts
// orders.ts
'use server';

import { idempotent } from 'brumate/server';

export const placeOrder = idempotent(async (form: FormData) => {
  await db.orders.insert(String(form.get('item')));
  redirect('/orders');
});
```

```brm
<script>
  import { placeOrder } from '../orders.ts';
</script>

<form action=placeOrder>…</form>
```

- Each form that the server renders for the function gets a key in its URL. A second post with that key gets the result of the first, or the same redirect, without running the function. A post that comes while the first runs waits for it.
- The result of a key is kept for 10 minutes, in the store of [`cached`](./server-functions.md#results-that-requests-share). `idempotent(fn, { maxAge })` changes it. An error is not kept, so the post can be tried again.
- With scripts, the form gets a new key after each answer, so a post that the user means again runs again.
- A page with such a form is not cached for everyone, since its key is for one visitor.
- It works for the functions of `'use server'` files. A call without a key, such as from a handler, runs as usual.

## Refreshing other data

After a form changes data, call `event.refresh(fn)` in its function with the server function that reads the data. Memos that call it load again. See [Loading again](./async-data.md#loading-again). Without scripts, the page renders again, so its memos are new anyway.

## Showing a guess while it posts

`$optimistic(source)` follows a memo, and handlers can write it. The page shows the new value at once, and the server sends the real one after:

```brm
<script>
  import { $action, $memo, $optimistic } from 'brumate/signals';
  import { getEvent } from 'brumate/server';

  async function list() {
    'use server';
    return db.names();
  }

  async function sign(form: FormData) {
    'use server';
    const event = getEvent();
    const name = String(form.get('name') ?? '');
    if (!name) {
      return { error: 'Enter a name' };
    }
    await db.add(name);
    event.refresh(list);
    return { error: '' };
  }

  const signed = $action(sign);
  const names = $memo(list());
  let shown = $optimistic(names);

  function guess(event: SubmitEvent) {
    const name = new FormData(event.currentTarget as HTMLFormElement).get('name');
    shown = [...shown, String(name)];
  }
</script>

<form action=sign onSubmit=guess>
  <input name="name" aria-label="Name">
  <button>Sign</button>
</form>
#if (signed?.error) {
  <p>{signed.error}</p>
}
<ul>
  #for (name of shown by name) {
    <li>{name}</li>
  }
</ul>
```

- The handler runs as the form posts, so the new name shows at once.
- When `names` changes, `shown` takes its value. Here `event.refresh(list)` loads the new list after the post.
- When the post fails, or returns without changing `names`, `shown` goes back to `names` once every server call of the page finishes.
- Write `$optimistic` in a component. Writes from a reactive module function set the value, but do not go back after a failed post.
