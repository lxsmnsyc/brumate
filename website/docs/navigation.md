# Navigation

Links are plain `<a>` elements, so every page works with scripts turned off. Once the loader runs, it loads pages of your site itself, without a full page load, and keeps the parts of the page that stay the same.

## What happens on a click

When a link leads to another page of the same site:

1. The loader fetches the new page from the server.
2. The new page replaces the current one as soon as its first part arrives. Content that streams in later, such as `#loading` bodies, follows when it is ready.
3. The head is updated, with the new title, `#head` content and styles.
4. The address bar and the history change, as for a normal link.

The back and forward buttons load pages the same way.

The code for this loads on the first navigation, so pages that never navigate do not load it. Client code that a page already loaded is not loaded again.

## Layouts keep their state

A link keeps the layouts that both pages share, with their markup and their state in the browser. Only the routes inside them are replaced.

```brm
<!-- src/routes/_layout.brm -->
<script>
  import { $props, $signal } from 'brumate/signals';

  const { children } = $props();
  // Stays open or closed while the reader moves between pages.
  let menuOpen = $signal(false);
</script>

<button onClick=(() => (menuOpen = !menuOpen))>Menu</button>
#if (menuOpen) {
  <nav><a href="/">Home</a> <a href="/posts">Posts</a></nav>
}
<main>{children}</main>
```

- A layout stays when it is the same file with the same params. A layout of `posts/[slug]` renders again when the slug changes. The root layout always stays.
- Inputs, scroll positions inside the layout, and its signals keep their values.
- New routes read the contexts that a kept layout provides.
- A form post replaces the whole page, because what it changed can show anywhere on it.

This works on static hosts too, such as a site written by [prerendering](./deploying.md#prerendering).

## Prefetching

A page starts to load when the pointer rests on its link, or when the link gets focus from the keyboard. A click soon after uses that response, so the new page shows sooner.

Turn it off for a link that should not load early, such as a link that logs the user out:

```brm
<a href="/logout" data-prefetch="none">Log out</a>
```

## Links that the browser loads

The loader leaves a link to the browser, which loads a full page, when:

- The link goes to another site.
- The link has `target`, such as `target="_blank"`, or `download`.
- The link has `data-reload`, for a page that must load fresh.
- A key such as Ctrl, Shift or Cmd is held, or another mouse button is used, so the browser can open a new tab.
- The link only changes the hash of the current page. The browser scrolls to the target.

```brm
<a href="/export.csv" download>Export</a>
<a href="/dashboard" data-reload>Open the dashboard</a>
```

A response that is not a page, such as a file or JSON, opens in the browser as a normal link would. If the request fails, the browser loads the page itself.

To turn client navigation off for the whole site, set `navigate: false` in the plugin options.

## Navigating from code

`navigate(href, options)` from `brumate/routes` loads a page as a link does: the layouts that stay keep their state. It returns when the page shows.

```brm
<script>
  import { $signal } from 'brumate/signals';
  import { href, navigate } from 'brumate/routes';
  import { createIssue } from '../issues.server';

  let title = $signal('');

  async function save() {
    const issue = await createIssue(title);
    await navigate(href('/issues/[id]', { id: issue.id }));
  }
</script>
```

- `replace: true` replaces the current entry of the history instead of adding one, such as for a filter.
- `scroll: false` keeps the place on the page.
- A URL of another origin, or a site with `navigate: false`, loads the page in full.

## The route

`$route()` from `brumate/signals` gives the route of the page: `url`, `search`, which is `url.searchParams`, and the `params` of the route. `$route('/issues/[id]')` types the params from the route files, as `href` does.

```brm
<script>
  import { $route } from 'brumate/signals';
  import { navigate } from 'brumate/routes';

  const route = $route('/issues');
</script>

<input value=(route.search.get('q') ?? '') onInput=((event) => navigate(`?q=${event.currentTarget.value}`, { replace: true }))>
<p>Page {route.search.get('page') ?? '1'}</p>
```

- The server reads the request and the params of the route. The browser reads `location`, and the params from the page state. Both render the same value.
- When navigation changes the URL, code that reads the route updates, such as in a layout that stays.
- A change of the query string still asks the server for the page.

## While a page loads

`$navigation()` gives the navigation that loads: `{ pending, from, to }`, with `pending` false when none does. It is `{ pending: false }` on the server.

```brm
<script>
  import { $navigation } from 'brumate/signals';

  const navigation = $navigation();
</script>

<div class={ bar: true, active: navigation.pending }></div>
```

The loader also sets `data-navigating` on `<html>` while a page loads, so a progress bar can be CSS alone, with no client code in the page:

```css
html[data-navigating] .bar {
  opacity: 1;
}
```

## Accessibility

A full page load tells a screen reader that the page changed, and starts the keyboard focus at the top. Client navigation does the same:

- The loader writes the title of the new page into a live region of its own, which is visually hidden, so a screen reader reads it. A page whose title is the same for many URLs sets its own text with `<meta name="brumate-announce" content="…">`, such as in `#head`.
- The focus moves to the first `<h1>` of the routes that changed, or to `<main>`, with `tabindex="-1"` until it leaves, so the next Tab starts there. `navigate: { focus: false }` in the plugin turns it off.
- A navigation that changes only the query string, such as a filter, moves no focus and announces nothing, so typing in a search field goes on.
- The back and forward buttons move the focus too, and scroll as they do.

## Scroll and history

- A new page scrolls to the top, or to the element that the hash of the link names.
- The back and forward buttons restore the scroll position of the page.
- A form that comes back to the same page keeps the scroll position.
- A link to the page that is already shown loads it again, and does not add an entry to the history.

## Forms

A form that posts to a server function is sent with `fetch` once the loader runs. The page that the server answers with, or redirects to, replaces the current one in the same way as a link.

A server function that redirects to a page of the same site, from a handler or from the form of an `$action`, also loads that page with `fetch`. The new page replaces the whole current one and adds an entry to the history, as after a form post. A redirect to another site, or with client navigation turned off, loads the page in full.

Other forms, such as a search form that uses `GET`, are left to the browser. See [Forms and actions](./forms.md).

## View transitions

Set `transition` in the plugin options to change pages inside a view transition, where the browser supports them:

```ts
brumate({ navigate: { transition: true } });
```

By default the browser fades the old page into the new one. CSS changes the animation. Each transition has a type that tells how the page was reached:

| Type       | When                                             |
| ---------- | ------------------------------------------------ |
| `push`     | A click on a link.                               |
| `traverse` | The back and forward buttons.                    |
| `form`     | A form post, or a redirect of a server function. |

```css
/* The back and forward buttons slide the page instead of fading it. */
html:active-view-transition-type(traverse) {
  &::view-transition-old(root) {
    animation: slide-out 0.2s;
  }
  &::view-transition-new(root) {
    animation: slide-in 0.2s;
  }
}

/* The header stays in place while the page changes. */
header {
  view-transition-name: header;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none;
  }
}
```

In a browser without view transitions, the page changes at once.
