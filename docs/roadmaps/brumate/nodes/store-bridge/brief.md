---
id: store-bridge
title: bridge() makes a brumate store from an outside store, so it can cross the page state
status: active
priority: must
type: feature
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns: []
shared:
  - packages/brumate/src/**
  - packages/brumate/test/**
  - packages/brumate/skills/**
  - website/docs/context.md
  - website/docs/reference-signals.md
  - website/docs/errors.md
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: ui-store-guards
    kind: hard
    why: same runtime and docs files; one worker at a time
  - on: context-read-fallback
    kind: hard
    why: same compiler, runtime and docs files; context-read-fallback sets the $store signature bridge() is read through
---

# bridge() makes a brumate store from an outside store, so it can cross the page state

## Goal

The maintainer approved this on 2026-11-05. After store-any-source, `$store` takes any value with `get` and `subscribe`, so a foreign store works from an import, `<script module>` or a call. It cannot cross the page state in a prop or a context: only a `brumate/store` store's value can be sent, and the browser has no code to rebuild the foreign source. `bridge` covers that case. A store created per request in a provider also avoids the module-level leak that zustand's own SSR docs warn about.

```ts
// brumate/store
export function bridge<S, T>(options: {
  // Module-level and browser-safe. Server: once per call. Browser: once, on the first
  // subscriber after resume, with the snapshot the server sent.
  create: (snapshot: T | undefined) => S;
  get: (source: S) => T; // the snapshot: data only, sent in the page state
  subscribe: (source: S, listener: () => void) => () => void;
  set?: (source: S, value: T) => void;
}): (snapshot?: T) => BridgedStore<S, T>; // a brumate Store, with `.source`
```

The zustand example the maintainer approved (use it as the docs example and a test, with a small stand-in for zustand if adding the dependency is not wanted):

```ts
// bears.ts
export const bearStore = bridge({
  create: (snapshot?: { bears: number }) =>
    createStore<Bears>()((set) => ({
      bears: snapshot?.bears ?? 0,
      add: () => set((state) => ({ bears: state.bears + 1 })),
    })),
  get: (source) => ({ bears: source.getState().bears }),
  subscribe: (source, listener) => source.subscribe(listener),
  set: (source, value) => source.setState(value),
});
export const BearContext = createContext<ReturnType<typeof bearStore>>('bears');
```

A provider calls `$setContext(BearContext, bearStore(initial))`; a reader binds `$store($getContext(BearContext))` and calls actions through `.source`. A child given the store in a prop gets the same live store.

Rules:

- The value `bridge` returns must be a module-level export, so the page state can name it (like a handler reference). A `bridge` call anywhere else is a compile error with a code from brumate-check.
- The page state sends the snapshot from `get` and the reference. On resume, the browser makes the source with `create(snapshot)` on the first subscriber; every reader and prop holder shares that one source. If the source's first value differs from the server's, the slot is repaired once, as for other stores. Resume never calls `set`.
- `get` must return sendable data; otherwise the server error names the store and the context or prop.
- `.source` is undefined in the browser until the store has a subscriber; say so in the docs.
- Update the error PR #470 added for a raw foreign store in a prop or a script value so it points to `bridge`.

Prior art: React `useSyncExternalStore` with `getServerSnapshot` (here `create(snapshot)` replaces hydrating the outside store by hand), and Svelte `readable(value, start)`, with a factory that survives resume. Do not narrow them beyond the rules above; any further limit goes to the maintainer.

## Acceptance

- [ ] The zustand-shaped example works through a context and through a prop: server render, browser render and resume, with `const` and `let`; one source per page in the browser; nothing shared across two server requests.
- [ ] A `bridge` value that is not a module-level export is a compile error; `brumate check` reports it.
- [ ] Docs in website/docs/context.md ("Outside stores") and reference-signals.md, the skill, and a decisions.md entry.
- [ ] Todos and ui example client JS before and after.
- [ ] A minor changeset.

## Sizing

M: one runtime helper, its page-state form, a compile check, docs.
