# Protecting server functions

A server function answers any caller. This page shows how to limit how often a caller can call it, and which sites can call it. [Security](./reference-security.md) lists what brumate checks for you.

## Rate limiting

Server functions are public endpoints: anyone can call them with `fetch`, as often as they like. A sign-in, a search or a form that sends mail needs a limit. `rateLimit` counts the calls of each key and refuses the ones over the limit:

```ts
import { rateLimit } from 'brumate/server';

async function signIn(email: string, password: string) {
  'use server';
  await rateLimit({ ...rateLimit.strict, key: () => email.toLowerCase() });
  // …
}
```

- Call it first thing in the function, before its first `await`, as `getEvent()`. After `max` calls in the window for one key, a call rejects with a `RateLimitError`: status 429, `Retry-After`, and the seconds to wait in `retryAfter`, in the browser too. The rest of the function does not run.
- The window is a length such as `'10s'`, `'1m'` or `'1h'`, or a number of milliseconds. The count slides: it weighs the last window by how much of it is still inside the window, so a burst at the edge of a window does not get through.
- Each call counts before the limit decides, with one atomic increment, so calls that arrive at the same time cannot all pass. A refused call counts too, so a client that keeps trying stays refused until it slows down.
- `rateLimit.strict`, 3 calls in 10 seconds, is a preset for functions that guess at secrets, such as a sign-in or a code check.
- `rateLimit.middleware({ max, window })` limits every request under a folder of routes, endpoints and pages included, as its `_middleware.ts`, or every request of the app as the entry middleware. A request over the limit answers 429 with the message.
- Limits count unless `configureRateLimit({ enabled: false })` or `enabled: false` on one limit turns them off. Pages that the build prerenders never count.
- The counts live in memory, per process. An app with more than one server passes a store to `configureRateLimit({ store })`, or to one limit. Its `increment(key, ttl)` adds one and returns the new count in one atomic step, such as `INCR` with `EXPIRE` on Redis, and `get(key)` reads a count.

### Keys

`key: (event, args) => …` says what to count by. `args` are the arguments of the call, which middleware sees too. Each server function counts on its own, and each route for middleware, whatever the key.

- **Key by the target** for a form that guesses at a secret, such as a sign-in or a code check: the email of the account, as above. Guesses at one account are limited from any number of addresses.
- **Key by the user** for actions of a signed-in user, such as `key: (event) => event.locals.user?.id`, which middleware sets. The user is limited wherever they sign in from.
- A cookie is not a key for a caller who is not signed in, since a client can drop it and start a new count.
- Without a key, or when it returns undefined, the limit counts by the address of the client.

### The address of the client

The address of the client comes from the server. A server passes it to `handle` as `address`, such as the remote address of the socket. Behind a proxy, the address the server sees is the proxy's, and the client's is in `X-Forwarded-For`. The header is read only when the address that the server passed is one of the proxies that the app names, as addresses or CIDR ranges, and from the right, past them, because a client can write anything at its left:

```ts
import { configureRateLimit } from 'brumate/server';

configureRateLimit({ proxies: ['10.0.0.0/8'] });
```

A range that is not an address, or an address with a prefix length, such as `10.0.0.0/` or `10.0.0.0/33`, throws. `clientAddress(event)` gives the address that the limits use. An IPv6 address counts by its /64, since one client often holds a whole subnet.

A limit with no key and no address would count every caller together, so one client could use up the limit of all. In production, it throws an error that names the function or the route. In development, it warns once and does not count. Pass `address` to the handler of the server, or set `key`. See [Deploying](./deploying.md) for passing the address.

## Calls from other sites

A call carries the cookies of the user, so the server refuses calls from pages of other sites with status 403. To allow another origin of your own, such as an admin app on another domain, list it in the plugin options:

```ts
brumate({ origins: ['https://admin.example.com'] });
```

[Security](./reference-security.md) describes the check.
