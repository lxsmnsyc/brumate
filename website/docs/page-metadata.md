# Page metadata

`$title` sets the title of the page, `#head` adds tags to the `<head>`, and `$id` makes IDs for attributes such as `for` and `aria-describedby`.

## `$title`

`$title(value)` sets the title of the page:

```brm
<script>
  import { $memo, $signal, $title } from 'brumate/signals';

  let todos = $signal([{ title: 'Write the docs', done: false }]);
  const left = $memo(todos.filter((todo) => !todo.done).length);

  $title(`${left} left | Todos`);
</script>
```

- Call it at the top level of a script.
- The server writes the `<title>` into the head of the page.
- When the value changes in the browser, the title changes too.
- When several components set a title, the last one that renders wins. A layout can set a default title, and its page can set its own.
- A component in a `#loading` block sets the title when its content streams in.

## `#head`

`#head` renders its content into the `<head>` of the page, for tags such as `<meta>` and `<link>`:

```brm
<script>
  import { $props } from 'brumate/signals';

  const { post } = $props<{ post: { title: string; summary: string; image: string } }>();
</script>

#head {
  <meta name="description" content=post.summary>
  <meta property="og:title" content=post.title>
  <meta property="og:image" content=post.image>
  <link rel="canonical" href=(`https://example.com/posts/${post.title}`)>
}

<h1>{post.title}</h1>
```

- The server puts the content into the head of the page, after the title.
- Attributes can change in the browser, like any other attribute.
- Inside a block that the browser renders, such as an `#if` that opens, the content is added to the head, and removed with the block.
- Use `$title` for the title, not a `<title>` tag in `#head`.

## On navigation

When a link loads another page of the site without a full page load, the head follows the new page:

- The title becomes the title of the new page.
- Tags that are in both pages stay. Tags of the old page that the new page does not have are removed, and new ones are added.

See [Navigation](./navigation.md).

## `$id`

`$id()` returns an ID that is unique in the page. Use it to connect a label or a description to a field:

```brm live
<script>
  import { $id } from 'brumate/signals';

  const field = $id();
  const hint = $id();
</script>

<label for=field>Email</label>
<input id=field type="email" aria-describedby=hint>
<p id=hint>We never share your email.</p>
```

- The server and the browser make the same ID, so a component that the browser renders later gets the same IDs as it would on the server.
- Each instance of a component gets its own IDs, so a component can be used many times on a page.
- An ID has only letters, digits, `-` and `_`, such as `b3-0`, so it also works in a CSS selector, as `#b3-0`.
- In the script of a block, such as the body of a `#for`, each item gets its own IDs:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  let fields = $signal(['Name', 'Email']);
</script>

#for (name of fields by name) {
  <script>
    import { $id } from 'brumate/signals';

    const id = $id();
  </script>
  <p>
    <label for=id>{name}</label>
    <input id=id>
  </p>
}
<button onClick=(() => (fields = [...fields, `Field ${fields.length + 1}`]))>Add a field</button>
```
