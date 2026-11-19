---
id: produce-map-set
title: $produce warns on, then drafts, maps and sets
status: done
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/produce.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent: 231000
owns:
  - packages/brumate/src/runtime/produce.ts
  - packages/brumate/test/produce.test.ts
shared:
  - packages/brumate/src/shared-module.ts
  - website/docs/signals.md
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# $produce warns on, then drafts, maps and sets

## Goal

`$produce` on a signal that holds a `Map` or a `Set` updates the page, and a map or set inside a drafted object no longer changes the old value. Two steps, in this order: a dev warning when the value cannot be drafted and the recipe returns nothing, then drafts of maps and sets that copy on the first write.

## Decision: one node

One node with two steps, not two nodes. Both edit `produce.ts` and `produce.test.ts`, step 2 reuses the test cases of step 1, and the warning is small (about a day). Splitting would make two PRs on the same 72-line test file in a row. The steps are two commits, so the warning can be reviewed alone.

## Current state

- `isDraftable` accepts only arrays and plain objects (`packages/brumate/src/runtime/produce.ts:19`). Any other value goes to the recipe as it is (`produce`, `produce.ts:156-160`: `if (!isDraftable(base)) { const result = recipe(base); return result === undefined ? base : result; }`). A map that the recipe changes in place comes back as the same object, so `writeSlot` sees no change.
- A map inside a drafted object is returned by the `get` trap as the map itself (`produce.ts:72`, `!isDraftable(value)` returns `value`), so `draft.byId.set(...)` changes the old value's map.
- The compiler rewrites `$produce(todos, recipe)` to `($$c.todos = $$b.produce($$c.todos, recipe))` (`packages/brumate/src/shared-module.ts:273-281`). The call does not pass the name of the signal.
- Tests: `packages/brumate/test/produce.test.ts` (72 lines, objects and arrays only).
- `decisions.md` line 80: changing a reactive value in place is a compile warning (`analyze.ts:2994`); the runtime has no warning for the case where the recipe changes a map.

## Prior art

Read at pinned SHAs.

| Choice | Immer | Mutative | Brumate |
| --- | --- | --- | --- |
| Where maps and sets are drafted | `DraftMap` and `DraftSet` are subclasses of `Map` and `Set` that hold a state object ([mapset.ts at 784c86b](https://github.com/immerjs/immer/blob/784c86bb234e805566481c9425fcb2a3897e8bcc/src/plugins/mapset.ts)) | A Proxy of the map with a `mapHandler` that replaces `get`, `set`, `delete`, `clear` and the iterators ([map.ts at ecd17c4](https://github.com/unadlib/mutative/blob/ecd17c4bf10bd13ce79cd3d4ea7d03acf9b408b9/src/map.ts)) | A Proxy, as the object draft already is (`createDraft`). One mechanism, no subclass that must keep `instanceof Map` true: a Proxy of a `Map` target passes it through the handler. |
| Opt in | `enableMapSet()` loads the plugin; without it a map in a draft throws ([plugins.ts](https://github.com/immerjs/immer/blob/784c86bb234e805566481c9425fcb2a3897e8bcc/src/utils/plugins.ts)) | On by default, with the Proxy code in the core bundle | On by default, in a separate module that `produce.ts` imports only when a call site can reach a map or set. See the bytes section. No `enableMapSet`: it is a call a user can forget, and the failure is silent with a Proxy that falls through. |
| Copy on first write | `prepareMapCopy` copies when `set`, `delete` or `clear` first runs | `ensureShallowCopy` on the first write | Same, on `set`, `delete`, `clear` (map) and `add`, `delete`, `clear` (set). Entry order is kept: `new Map(base)` keeps order, and `set` of a present key keeps its position. |
| Values | A read of a value through `get` or iteration drafts it | `getEntry` drafts a value of the original map on read, and skips it when `value !== original.get(key)` (already drafted or assigned) | Same rule as the object draft's `get` trap: draft a value only while it is still the base value. |
| Keys | Used as they are | Used as they are; in dev it fails when a draft is used as a key because the draft is revoked | Never drafted. In dev, `set(key)` where `key` is a draft throws a `TypeError` that says to use the base key. |
| No change | Returns the base | Returns the base | `finalize` returns the map or set itself, so `Object.is` still cuts the update. |
| Warning for a value it cannot draft | none | none | New: step 1, dev only. |

Neither names the signal in a message, because neither has signals; the form of the warning is ours.

## Steps

- [ ] 1. Dev warning. `produce(base, recipe, name?)`. When `base` is an object that `isDraftable` refuses, and `recipe` returns `undefined`, warn once for each name: `$produce(<name>) changed a <Map|Set|ClassName> and returned nothing. Nothing updates. Return a new value, such as new Map(<name>).`. Gated by `import.meta.env?.DEV`, as `runtime/navigate.ts:642` does, so the text is removed from builds. The compiler passes `"<name>"` as the third argument only in dev (see Notes). The warning stays after step 2, for instances of other classes.
- [ ] 2. Drafts of maps and sets in `packages/brumate/src/runtime/produce-collections.ts` (new, owned). `produce.ts` calls it when `base` or a child value is a `Map` or `Set` (subclasses and class instances stay as they are). The draft of a map or set drafts its draftable values (objects, arrays, maps, sets), copies on the first write, and `finalize` walks the copy as it does for object keys, including a drafted value moved to another key.

## Acceptance

- [ ] Step 1: a test with `vi.spyOn(console, 'warn')` shows one warning for a map changed in place with no return, none when the recipe returns a new map, none for a plain object, array or primitive, and none with `DEV` false. Every case names the signal.
- [ ] Step 2: `$produce(tags, (d) => { d.set(id, tag) })` returns a new `Map`; the old map is unchanged; an unchanged recipe returns the same map and set (`toBe`).
- [ ] Order: a copied map keeps the order of its entries, `set` of an existing key keeps its position, `delete` then `set` moves it to the end.
- [ ] Values: `d.get(id).done = true` copies the value and the map, and shares the other values. A value moved to another key with `d.set(b, d.get(a))` is finalized once.
- [ ] Nesting: `draft.byId.set(...)` in a drafted object leaves the old object's map unchanged; a `Set` inside a `Map` value drafts.
- [ ] Iteration (`for...of`, `forEach`, `keys`, `values`, `entries`, `size`, `has`) reads the latest state and gives drafts of values.
- [ ] A class instance (not `Object`, `Array`, `Map` or `Set`) stays as it is, and warns in step 1.
- [ ] An e2e or compiled-page test: a `.brm` with `let tags = $signal(new Map())` and `$produce(tags, ...)` in a handler updates the rendered text after the click (`packages/brumate/test/client/` suite).
- [ ] Bytes: report the gzip size of the todos page (`pnpm bench --only brumate --scenario todos`) and of a test page that calls `$produce` on a map. A page without `$produce` adds 0 bytes; a page with `$produce` on objects only adds 0 when the collections module is not imported (see Sizing).
- [ ] `website/docs/signals.md` says `$produce` drafts maps and sets, and not instances of other classes. `docs/decisions.md` records the two rules (keys are never drafted; the warning covers only the signal's own value). A minor changeset (new behavior of an existing API on a value type that did nothing before).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: two steps in one hot file; step 2 adds about 150 lines and a state shape for two collection types, with ordering and moved-draft cases. No server and browser split, no new API.

## Bytes

- A page that does not call `$produce` loads no `produce.ts` (the compiler imports it only for a call). Adds 0.
- A page that calls `$produce` today adds the warning check, which is removed in builds. The collections module is a separate file that `produce.ts` loads with a static import only when the bundler cannot tell; to keep it at 0 for object-only pages, the worker tries `produce.ts` with `base instanceof Map || base instanceof Set` guards that call into the collections file, and measures whether the bundler drops it. If not, the module adds about 1.5 kB raw (about 0.6 kB gzip, estimate to replace by a measurement) to pages that use `$produce`, and the outcome says so. Size is recorded, not a gate (GOAL.md).

## Notes for the worker

- The name for the warning: `shared-module.ts:273-281` knows the identifier. Pass it as a third argument only when the transform runs in dev; look at how `vite.ts` passes `dev` to the transform. If no dev flag reaches `shared-module.ts`, warn without the name rather than add bytes to production.
- Do not add `enableMapSet`. See the table.
- Instances of other classes stay as they are, in both places (proposal).
- Do not draft keys.
- Keep step 1 as its own commit.
