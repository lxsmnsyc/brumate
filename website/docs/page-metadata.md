# Page metadata

`#head` adds tags to the `<head>` of the page, such as its `<title>`.

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
- A `<title>` sets the title of the page. See [`<title>`](#title).

## `<title>`

A `<title>` in `#head` sets the title of the page, as `<meta>` and `<link>` in `#head` add to the head:

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';

  let todos = $signal([{ title: 'Write the docs', done: false }]);
  let editing = $signal(false);
  const left = $memo(todos.filter((todo) => !todo.done).length);
</script>

#head {
  <title>{`${left} left | Todos`}</title>
}

#if (editing) {
  #head {
    <title>Unsaved changes | Todos</title>
  }
}
```

- Its content is text, or one value such as a template string.
- When several titles render, the last one in the page wins. A layout can set a default title, and its page can set its own.
- Blocks decide which title renders, so a title in an `#if` needs no code in a script. When a block removes its title, the last one that is left wins. With none left, the title stays as it was.
- When the value changes in the browser, the title changes too.
- A component in a `#loading` block sets the title when its content streams in.
- With one title, the head has that `<title>`. With several, the server also puts the last one first in the head, so a reader without scripts, such as a crawler, sees it.
- A `<title>` anywhere else in the markup is an error, except inside an `<svg>`, where it names the shape, and inside the `<head>` of a document component, where it is the head's own.

`$title(value)` in a script does the same, and is replaced by a `<title>` in `#head`. The compiler warns about it, and it goes in a later version.

## On navigation

When a link loads another page of the site without a full page load, the head follows the new page:

- The title becomes the title of the new page.
- Tags that are in both pages stay. Tags of the old page that the new page does not have are removed, and new ones are added.

See [Navigation](./navigation.md).
