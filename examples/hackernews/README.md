# Hacker News example

A Hacker News reader: the top, new, show, ask and job stories with pages, each story with its comments, and each user. It reads the [HNPWA API](https://github.com/tastejs/hacker-news-pwas).

- `src/api.ts`: the server functions, which keep each answer for a minute with `cached`, so requests share them.
- `src/hn.ts`: reads the API, and keeps only safe tags of the HTML of comments.
- `src/Feed.brm`: a page of a feed, with links to the pages before and after it.
- `src/Comment.brm`: a comment and its replies, which renders itself for each reply.
- `src/routes`: a route for each feed, `/item/[id]`, `/user/[id]` and a 404. Each route exports `cache`, so the server keeps the page for everyone.

## What to look at

- Every page renders on the server, and the browser loads no code until a click.
- The only code of a story page is the button that folds a thread. Folding hides the thread with `hidden`, so the state of the page holds one flag and one count for each comment, not the comments.
- A story page with many comments still sends the comments once, as HTML. Open the Page state tab of the devtools to see the state.
- Links between pages navigate on the client, and the layout stays.

## Development

```bash
pnpm --filter brumate build
pnpm --filter example-hackernews dev
```

Set `HN_API` to read another copy of the API.

## Production

```bash
pnpm --filter brumate build
pnpm --filter example-hackernews build
pnpm --filter example-hackernews start
```

## Tests

`pnpm --filter example-hackernews test` visits the pages in happy-dom with fixtures in place of the API, so it runs without the network.
