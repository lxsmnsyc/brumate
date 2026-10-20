# Prior art

## Qwik

Qwik resumes instead of hydrating. The developer marks lazy boundaries with `$()`. The runtime records signal subscriptions and serializes them into the page.

brumate finds the boundaries by analysis instead of `$()`. It builds the graph at compile time, so it does not serialize subscriptions.

Qwik's `preventdefault:click` attribute solves the same problem as brumate's `:prevent` modifier.

## Marko 6

Marko 6 analyzes the data flow of each component and ships only the code that events and changing state can reach. It needs no manual boundaries.

This is the closest design to brumate. Its compiler output is the first thing to study.

## Wiz and JSAction

Google's Wiz framework listens to events at the document and loads handlers when they fire. JSAction is the event part of it. It is now part of Angular's event replay.

brumate's loader follows the same approach.

## Astro islands

Astro renders pages on the server and hydrates only the components marked as islands. Each island still hydrates. The rest of the page ships no code.

brumate's `#static` and `#client` blocks are similar in scope, but the parts that run on the client resume instead of hydrating.

## React Server Components

Server components run on the server only. Client components still hydrate. The split is chosen by the developer with `'use client'`.

brumate takes `'use server'` from this model, but decides the client side by analysis.

## solid-sfc

solid-sfc is the syntax that brumate starts from. It compiles to Solid 2.0, which hydrates. brumate keeps the file format and the markup, and replaces the reactive functions and the output.
