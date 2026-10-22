# Environment variables

Secrets and settings come from the environment: a database URL, a session secret, the name of the site. brumate checks them with a schema when the server starts, types them, and keeps the server's values out of the browser.

## Declaring them

One file declares every variable, split into the ones that only the server reads and the ones that the browser reads too:

```ts
// src/env.ts
import { defineEnv } from 'brumate/env';
import * as v from 'valibot';

export default defineEnv({
  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
    SESSION_SECRET: v.pipe(v.string(), v.minLength(32)),
  },
  public: {
    SITE_NAME: v.optional(v.string(), 'Tracker'),
  },
});
```

- Each variable has a [Standard Schema](https://standardschema.dev), such as a schema of Valibot, Zod or ArkType, as `parse` and `parseForm` take. The schema gives the type and the default, and must validate without waiting.
- The values come from `process.env`. On a host without it, pass them as `source` in the options.
- The Vite plugin finds `src/env.ts` by itself. The `env` option names another file, and `false` uses none.
- Write the schemas in the call, as object literals, so the compiler and the plugin can read the names of the variables without running the file. The file should import only its schema library, because the browser loads it too.

## On the server

The server checks every variable when the file loads, which the plugin makes the first thing the server loads. A server that starts without a secret, or with a wrong one, fails at once, and the error names every variable that is missing or wrong:

```
Error: Environment variables: DATABASE_URL is missing. SESSION_SECRET is invalid: Invalid length
```

Components, server functions, middleware and endpoints import the file and read the values with their types:

```ts
import env from './env.ts';

async function listIssues() {
  'use server';
  return db.connect(env.DATABASE_URL).issues.list();
}
```

## In the browser

The browser gets the file without the server variables: the plugin removes their schemas, and writes in the values of the public variables, read when the dev server or the build ran. The public schemas check them in the browser as the server's do on the server, so a default such as `'Tracker'` works in both.

```brm
<script>
  import env from './env.ts';
</script>

<h1>{env.SITE_NAME}</h1>
```

The compiler knows which code runs in the browser, so it reports a read of a server variable there, in a handler, an effect, a `$client` callback or a memo that the browser computes again. A value made from a server variable that the browser reads, such as a signal, is reported too, because the page state would send it:

```brm
<script>
  import { $signal } from 'brumate/signals';
  import env from './env.ts';

  let url = $signal(env.DATABASE_URL);
  // "url" holds env.DATABASE_URL, a server variable, and code that runs in the browser reads it
</script>

<button onClick=(() => console.log(env.DATABASE_URL))>Show</button>
<!-- env.DATABASE_URL, a server variable, is read by code that runs in the browser -->
```

A server variable that a component reads while it renders, such as in a memo that the server computes and the browser never does, stays on the server. The check is on the names of the variables, which a prefix in the name cannot do: `SITE_NAME` is public because the file says so, not because it starts with `VITE_`.

## Reference

| Export                              | What it does                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `defineEnv(schema, options?)`       | Checks the variables of `schema.server` and `schema.public` and returns their values, typed. Throws for a wrong one. |
| `options.source`                    | Where the values come from. Defaults to `process.env`. The browser's copy of the file passes the public values.      |
| `Env<S>`, `EnvSchema`, `EnvOptions` | The types of the values, of the schema and of the options.                                                           |
