# Log: rest-ref-spread

- The server render and the client both lost the binding: the element of a spread had no `ref` target, `prop()` unwrapped the Binding in a rest, and a Binding in a spread would have written a `ref` attribute.
- Server: `ctx.restRef` forwards an ElementReference to the slot of a `ref` Binding in a spread. Browser blocks: `restRef` in client/inserts.ts after the insert. Updates: `attrs` forwards too.
- Vitest skips `.git` paths, so tests ran with a config outside the repo that sets `server.fs.strict` false and a narrower `exclude`. testing.test.ts and vite.test.ts fail the same 8 tests on main in this setup.
