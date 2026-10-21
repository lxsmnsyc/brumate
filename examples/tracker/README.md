# Tracker example

A small issue tracker: a list with search, issue pages, sign-in, and a form to open an issue. The server renders every page, and the browser loads the code of a control when it is used. The issues are kept in memory, in `src/store.ts`.

## Run it

```bash
pnpm --filter brumate build
pnpm --filter example-tracker dev
```

`server.ts` renders pages with Vite in development, and Vite answers server function calls.

```bash
pnpm --filter example-tracker build
SESSION_SECRET=… pnpm --filter example-tracker start
```

`build` writes `dist/client` and `dist/server`, and prerenders `/about` to `dist/client/about/index.html`. `server.prod.ts` serves the client files and the prerendered page, answers server function calls with `handle`, and streams every other page with `route`. Set `SESSION_SECRET` to 32 characters or more. The fallback in `src/session.ts` is only for trying the example.

```bash
pnpm --filter example-tracker test
```

## What each part shows

| Where                                      | What it shows                                                                                                                                        | Docs                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/_layout.brm`                   | The document, the header, and the signed-in user, which it provides to every page with `$setContext`. Sign out is a form.                            | [Routing](../../website/docs/routing.md#layouts), [Context](../../website/docs/context.md)                                                |
| `src/routes/index.brm`                     | The list. `$optimistic` with `$produce` shows a star at once. `toggleStar` refreshes the list memo. `<window onKeyDown>` makes `/` focus the search. | [Forms](../../website/docs/forms.md#showing-a-guess-while-it-posts), [State](../../website/docs/state.md#produce)                         |
| `src/filter.brm.ts`                        | The search and status filter, a module of reactive logic that the list calls.                                                                        | [Reactive modules](../../website/docs/reactive-modules.md)                                                                                |
| `src/routes/issues/[id].brm`               | An issue. Closing posts a form with `$action` and shows the guess at once. Delete asks in a `#portal` dialog, which an `$effect` focuses.            | [Forms](../../website/docs/forms.md), [Control flow](../../website/docs/control-flow.md#portal), [Effects](../../website/docs/effects.md) |
| `src/IssueLink.brm`                        | A related issue. One of them is deleted, so `getIssue` throws and the `#try` around it shows its `#catch`.                                           | [Control flow](../../website/docs/control-flow.md#try-and-catch)                                                                          |
| `src/routes/issues/new/`                   | `_middleware.ts` sends a visitor who is not signed in to `/sign-in`. The form validates with `parseForm` and shows field errors with `$action`.      | [Routing](../../website/docs/routing.md#middleware), [Validating a form](../../website/docs/forms.md#validating-a-form)                   |
| `src/routes/sign-in.brm`, `src/session.ts` | Sign-in with a name only. The name is kept in a signed cookie with `createSession`.                                                                  | [Cookies and sessions](../../website/docs/server-functions.md#cookies-and-sessions)                                                       |
| `src/issues.ts`, `src/schema.ts`           | A `'use server'` file. `parse` checks the ID that a handler sends. The schemas are small Standard Schemas written by hand.                           | [Server functions](../../website/docs/server-functions.md)                                                                                |
| `src/routes/@aside/`                       | A named slot. On the list it streams the activity feed with `#loading`, after a short delay.                                                         | [Named slots](../../website/docs/routing.md#named-slots), [Async data](../../website/docs/async-data.md)                                  |
| `src/routes/api/issues.json.ts`            | An endpoint: `GET /api/issues.json?open=false`.                                                                                                      | [Endpoints](../../website/docs/routing.md#endpoints)                                                                                      |
| `src/routes/_error.brm`                    | The error page, for a missing issue and for paths with no route, with status 404.                                                                    | [Errors and 404](../../website/docs/routing.md#errors-and-404)                                                                            |
| `src/routes/about.brm`, `vite.config.ts`   | A page with no data, prerendered at build time. `vite.config.ts` also turns on view transitions.                                                     | [Prerendering](../../website/docs/deploying.md#prerendering), [View transitions](../../website/docs/navigation.md#view-transitions)       |

The forms work without scripts. With scripts, links and forms load pages without a full page load, and a link starts to load when the pointer rests on it.

## What to look at

- Open the network panel, and click a star. The page sends one call, and the answer names the list, so the list memo loads it again.
- Close an issue with the network throttled. The state changes at once, and the page keeps it when the answer arrives.
- Open `/issues/new` signed out. The middleware answers with a redirect to `/sign-in?next=%2Fissues%2Fnew`. The page signs you in and comes back.
- Turn scripts off. Sign in, and post the new issue form with a short title. The page renders again with the error and the title you typed.
- In the production build, load `/about` directly. It is the prerendered file, so its header shows "Sign in" even when you are signed in. A link from another page keeps the live header, because the root layout stays.

## Tests

- `test/routes.test.ts` renders routes, follows the middleware redirect, and posts forms without scripts.
- `test/server.test.ts` calls the server functions and the schema.
- `test/list.test.ts` mounts the list in happy-dom, filters it and stars an issue. `answerCalls` answers its calls with the functions of `src/issues.ts`.
- `e2e/suites/tracker.mjs` at the root of the repository uses the production build in Chrome. Run it with `pnpm e2e --only tracker`.
