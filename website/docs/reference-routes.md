# Route files

The files under `src/routes` and what each one does. [Routing](./routing.md) explains them with examples.

## Files

| File or folder                | What it is                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `index.brm`                   | The page of its folder, such as `/` for `src/routes/index.brm`.                                                       |
| `about.brm`, `about/`         | A fixed segment: `/about`.                                                                                            |
| `[id].brm`, `[id]/`           | A dynamic segment, one part of the path. Routes read it as `params.id`.                                               |
| `[...rest].brm`, `[...rest]/` | The rest of the path, one or more parts, such as `a/b`. Routes read it as `params.rest`.                              |
| `_layout.brm`                 | Wraps every route of its folder and of the folders inside it.                                                         |
| `@aside/`                     | A sibling route tree. It matches the same path, and renders in the `aside` prop of the layout next to it.             |
| `@aside/_default.brm`         | What the `aside` slot renders when none of its routes match.                                                          |
| `_error.brm`                  | Renders in place of a route of its folder that throws. At the root, it also renders for a path that no route matches. |
| `_loading.brm`                | Shows while a route of its folder streams in.                                                                         |
| `_middleware.ts`              | Runs before every route of its folder and of the folders inside it, endpoints included.                               |
| `hello.ts`, `index.ts`        | An endpoint: answers requests at its path with the handlers that it exports.                                          |

Other files whose names start with `_` are not routes. `.d.ts` files are skipped.

## Matching

- A fixed segment wins over a dynamic one, and a dynamic one wins over a rest segment.
- A folder can have one dynamic segment. Two names, such as `[a]` and `[b]` in one folder, are an error.
- The segments of the path are decoded before they match, so `params` hold decoded text.
- The `_error.brm` that renders is the nearest one to the route, inside the layouts of its folder and the folders above it.
- The middleware of each folder on the path runs from the outside in.
- Each `@` folder matches the same path on its own, and gets the same `params`.

## Props

Every route file gets `params`, the values of the dynamic and rest segments on its path, as strings.

| File                                    | Props                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.brm`, `[id].brm` and other pages | `params`                                                                                                                                                           |
| `_layout.brm`                           | `params`, `children` (the matched route), and one prop for each `@` folder next to it, such as `aside`. A slot with no match and no `_default.brm` is `undefined`. |
| `_default.brm`                          | `params`                                                                                                                                                           |
| `_loading.brm`                          | `params`                                                                                                                                                           |
| `_error.brm`                            | `params`, and `error`: `{ message: string; status: number }`. The layouts around it get `error` too.                                                               |

`RouteParams<'/todos/[id]'>` from `brumate/routes` is the type of `params` for a path.

## Endpoints

```ts
// src/routes/api/todos/[id].ts
export async function GET(request: Request, params: Record<string, string>): Promise<Response> {
  return Response.json(await db.todos.get(params.id));
}
```

- An endpoint exports a handler for each method, named in capitals, such as `GET` and `POST`. A handler has the type `Handler` from `brumate/server`.
- `HEAD` uses `GET` when there is no `HEAD` handler.
- A method that the file does not export answers 405, with `Allow`.
- A folder can have a page and an endpoint at the same path. The endpoint answers the methods that it exports, and the page answers other `GET` requests.
- Endpoints do not check where a request comes from. Call `isCrossSite` in a handler that changes data. See [Security](./reference-security.md).

## Middleware

```ts
// src/routes/admin/_middleware.ts
import type { Middleware } from 'brumate/server';

export const middleware: Middleware = async (request, next) => {
  if (!(await session(request))) {
    return Response.redirect(new URL('/login', request.url));
  }
  return next();
};
```

`_middleware.ts` exports `middleware(request, next)`. It answers the request itself, or calls `next()` for the answer of the route, and returns it changed or not.

## Errors

- A `ServerError` gives the error file its message and status. Any other error gives status 500 and a generic message, and is logged on the server.
- An error file that throws hands the error to the next error file outside it.
- A path that no route matches renders the `_error.brm` of the root, with status 404.
- An error in a `#loading` body, or a route that streams after a `_loading.brm`, keeps its fallback, because the page has started.
- A `redirect` while a page renders answers with a redirect.
