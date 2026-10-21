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
- The value must be a server function. Any other value renders as a normal attribute.

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

## Refreshing other data

After a form changes data, call `refresh(fn)` in its function with the server function that reads the data. Memos that call it load again. See [Refreshing data](./server-functions.md#refreshing-data). Without scripts, the page renders again, so its memos are new anyway.
