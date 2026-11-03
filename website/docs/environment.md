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
Error: Environment variables: DATABASE_URL is missing. SESSION_SECRET is invalid
```

For a server variable, the error gives the name and the path of each issue, not its message, because the messages of some schema libraries hold the value. A public variable's error gives the messages too.

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

Code that the browser loads imports the file only from components. A script that the browser loads, such as a helper that a handler calls, cannot import it, by any path: the build fails and names the script. The compiler checks what a component reads, and it cannot check a script. Read the variable in a component or a server function, and pass the value on.

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

The plugin finds the imports of the env file by the path that they resolve to, so an alias such as `~/env` counts too.

A server variable that a component reads while it renders, such as in a memo that the server computes and the browser never does, stays on the server. The check is on the names of the variables, which a prefix in the name cannot do: `SITE_NAME` is public because the file says so, not because it starts with `VITE_`.

## In the page state

The compiler sees the reads in a component only. A helper in another module can read a secret, and a component can put what it returns in a signal that the browser reads:

```brm
<script>
  import { $signal } from 'brumate/signals';
  import { connectionString } from './db.ts';

  let url = $signal(connectionString());
</script>

<button onClick=(() => console.log(url))>Show</button>
```

The server checks the page state too. `defineEnv` keeps the values of the server variables when the server starts, and the server refuses to send a page whose state holds one of them as a string. The render fails, and the error names the slot and its component, as it does for a value that cannot be sent:

```
The value of "url" in Page_1x2y3z is the value of a server environment variable, and code that runs in the browser reads it.
```

- The check compares whole strings. A value that holds a secret inside a longer string, or a value made from one, such as its length, is not found.
- Values under 8 characters are not checked, such as `true` or `3000`, because a page can hold the same text for another reason.
- The check costs one search of each record of the page state per secret.

## Reference

| Export                              | What it does                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `defineEnv(schema, options?)`       | Checks the variables of `schema.server` and `schema.public` and returns their values, typed. Throws for a wrong one. |
| `options.source`                    | Where the values come from. Defaults to `process.env`. The browser's copy of the file passes the public values.      |
| `Env<S>`, `EnvSchema`, `EnvOptions` | The types of the values, of the schema and of the options.                                                           |
