# Security

What brumate checks for you, and what stays your job: calls from other sites, errors, untrusted input in markup, and inline scripts.

## Calls from other sites

A server function call and a form post send the cookies of the user, so a page of another site must not be able to make them. brumate refuses them with status 403.

| Checked                                    | Not checked                       |
| ------------------------------------------ | --------------------------------- |
| Server function calls, at `/_brumate/<id>` | Endpoints, such as `api/todos.ts` |
| Form posts to a server function            | Middleware                        |
| Form posts to a page with `?__action=<id>` | Pages that answer `GET`           |

A request comes from another site when:

1. Its `Origin` header is `null`, or names a host other than the host of the request. The host of the request is read from its URL, and from the `Host` and `X-Forwarded-Host` headers, so a server behind a proxy matches its public name.
2. It has no `Origin`, and `Sec-Fetch-Site` is `cross-site` or `same-site`. Older browsers send only this header.

A request with neither header does not come from a page in a browser, so it is allowed. Origins in the `origins` option of the plugin are always allowed:

```ts
brumate({ origins: ['https://app.example.com'] });
```

An endpoint that changes data checks itself with `isCrossSite`:

```ts
// src/routes/api/todos.ts
import { isCrossSite } from 'brumate/server';

export async function POST(request: Request): Promise<Response> {
  if (isCrossSite(request)) {
    return new Response('Forbidden', { status: 403 });
  }
  // …
}
```

`same-site` counts as another site, because a page on another subdomain can be run by someone else.

## Errors

- A `ServerError` sends its message and status to the browser. Write messages for the user.
- Any other error is logged on the server. The browser gets status 500 and the message "The server function failed", so server details stay on the server.
- Errors that are sent as values, such as in a memo, keep their name and message only. Stack traces are never sent.
- A route error renders `_error.brm` with the same rules.

## Regular expressions

Regular expressions are not read or written, in the page or in server function calls. A call that sends one fails with status 500. A pattern from a client could take the server a long time to match.

## Markup

- Inserted values and attribute values are escaped.
- `raw(html)` from `brumate/html` inserts HTML without escaping. Insert only HTML you trust, such as Markdown that you rendered from your own files.
- URLs in attributes are not checked. A link to a `javascript:` URL from user input runs code when it is clicked. Check the scheme of a URL from a user before it goes into `href` or `src`.
- The page state is a JSON script that does not run. Every `<` in it is escaped, so a value cannot end the script.

## Content Security Policy

A page runs two kinds of inline scripts:

- State scripts have the type `brumate/state`. They never run, so they need no nonce.
- The scripts that swap in `#loading` bodies run. Give them a nonce with the `nonce` option of `render`, `renderToStream` or the `handle` of `virtual:brumate/routes`:

```ts
const nonce = crypto.randomUUID();
const response = await handle(request, {
  nonce,
  scripts: `<script type="module" async src="/assets/client.js" nonce="${nonce}"></script>`,
});
response?.headers.set('content-security-policy', `script-src 'self' 'nonce-${nonce}'`);
```

The client code loads as modules from your origin, which `'self'` allows.

A policy from a header stays for the whole visit, so the client router gives the swap scripts of each later page the nonce of the page that the browser loaded. Each response can still make its own nonce.
