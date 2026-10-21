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

## Untrusted arguments

The arguments of a server function and the fields of a form come from the browser. Their types are not checked when they arrive. A user can send any value that seroval reads.

- Check them with `parse`, `safeParse` or `parseForm` from `brumate/server` and a [Standard Schema](https://standardschema.dev). See [Validating arguments](./server-functions.md#validating-arguments).
- `parse` answers with status 400 and the message of the first issue, cut at 300 characters. The issues stay on the server.
- Issues that `safeParse` and `parseForm` return keep only the message and the path, so fields that a library adds, such as the input, are not sent back.
- `parseForm` refuses names with a part named `__proto__`, `constructor` or `prototype`, so a form cannot change the prototype of an object. Its work grows with the size of the form only.
- The schema runs on the input, so its own checks decide how long it takes. Prefer limits on the length of strings and arrays.

## Regular expressions

Regular expressions are not read or written, in the page or in server function calls. A call that sends one fails with status 500. A pattern from a client could take the server a long time to match.

## Markup

- Inserted values and attribute values are escaped.
- `raw(html)` from `brumate/html` inserts HTML without escaping. Insert only HTML you trust, such as Markdown that you rendered from your own files.
- URLs in attributes are not checked. A link to a `javascript:` URL from user input runs code when it is clicked. Check the scheme of a URL from a user before it goes into `href` or `src`.
- The page state is code in inline scripts. seroval escapes every `<` in its strings, and U+2028 and U+2029, so a value cannot end the script or run as code. The server refuses a record that would end its script.

## Content Security Policy

A page runs two kinds of inline scripts:

- The state records, one or more per render.
- The scripts that swap in `#loading` bodies.

Give them a nonce with the `nonce` option of `render`, `renderToStream` or the `handle` of `virtual:brumate/routes`:

```ts
const nonce = crypto.randomUUID();
const response = await handle(request, {
  nonce,
  scripts: `<script type="module" async src="/assets/client.js" nonce="${nonce}"></script>`,
});
response?.headers.set('content-security-policy', `script-src 'self' 'nonce-${nonce}'`);
```

The client code loads as modules from your origin, which `'self'` allows.

A policy from a header stays for the whole visit, so the client router gives the state records and swap scripts of each later page the nonce of the page that the browser loaded. Each response can still make its own nonce.

A policy with hashes instead of a nonce does not work for the state records. Their code holds the values of the page, so each page has other hashes, and the records that stream later are not known when the headers are sent. Use a nonce, or `'unsafe-inline'`.

A prerendered page is the exception. Its scripts are known at build time, and the build writes their hashes. See [Content Security Policy for prerendered pages](./deploying.md#content-security-policy-for-prerendered-pages).
