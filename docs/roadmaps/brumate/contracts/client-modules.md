---
name: client-modules
version: 2
status: frozen
defined_by: split-client-runtime
---

# Contract: client-modules

## Purpose

The modules that split-client-runtime makes from packages/brumate/src/runtime/client.ts, so the nodes after it own the right files.

## Interface

The modules under packages/brumate/src/runtime/client/, as #274 built them:

| Module               | Holds                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| client/state.ts      | the types, `options`, `scopes`, `hooks`, the registries of modules and nodes, `configure`, `setHiding`, `setGuesses` |
| client/code.ts       | `loadModule`, `loadComponent`, `codeReady`, `loadedFunction`                                                         |
| client/blocks.ts     | the marker observer, `indexMarkers`, `findComment`, `findElement`, `blockStart`, `rangeEnd`, `clear`, `nameComment`  |
| client/references.ts | `resolve`, `call`, `serverBuild` (moved out of handlers.ts)                                                          |
| client/scopes.ts     | `createScope`, `removeScope`, `descendants`, `rootOf`, `resolveScope`, `inPlace`, `holderOf`                         |
| client/titles.ts     | the `<title>` observer and `title`                                                                                   |
| client/insert.ts     | `insertHTML`, `refresh`, `parseHTML` (insertHTML and refresh moved out of blocks.ts and resume.ts)                   |
| client/children.ts   | `Children`, `RenderedChildren`, `TemplateCall`, `insert`, `childrenReady`                                            |
| client/errors.ts     | `fail`, `catchInto` (moved out of handlers.ts)                                                                       |
| client/updates.ts    | `get`, `set`, `writeSlot`, `run`, `memo`, `asyncMemo`, `effect`, `flushEffects`, `trigger`, the pending counts       |
| client/guesses.ts    | `guess`, `track`                                                                                                     |
| client/props.ts      | `prop`, `spreadProps`                                                                                                |
| client/handlers.ts   | `handle`, `spread`, `callable`, `handlerProp`, `rpc`, `action`, `submitAction`                                       |
| client/context.ts    | `provideValue`, `consumeContext`, `updateContext`, `setGlobal`, `updateRoute`                                        |
| client/templates.ts  | `template`, `clone`, and the helpers that fill a clone                                                               |
| client/branches.ts   | `branch`, `rekey`, `retag`, `reset`, `fill`, `offscreen`                                                             |
| client/lists.ts      | `list`, `windowList`, `windowStart`                                                                                  |
| client/inserts.ts    | `text`, `content`, `attr`, `attrs`, `portalTo`                                                                       |
| client/components.ts | `component`, `dynamic`, `setSlots`, `setItem`                                                                        |
| client/page.ts       | `setVar`, `addHead`, `addPortal`, `addStyle`                                                                         |
| client/resume.ts     | `init`, `readRecord`, `addScopes`, `dispose`, `leavePage`, `leaveRoutes`, `remount`, `forget`, `removeRoot`          |
| client.ts            | re-exports, and `loader`                                                                                             |

- A module imports only the modules before it in this order, because `import/no-cycle` is an error: state, code, blocks, references, scopes, titles, insert, children, errors, updates, guesses, props, handlers, context, templates, branches, lists, inserts, components, page, resume.
- A `let` that two modules write has a setter in the module that holds it, such as `setHiding`, `resetIds` or `markCloned`.
- Later nodes: ordered-updates owns updates.ts and shares scopes.ts; batching shares updates.ts and handlers.ts; fields-typed-early owns resume.ts and shares state.ts; drop-marker-index owns blocks.ts and shares insert.ts, children.ts and templates.ts.

## Behavior

- No behavior changes. No test changes.
- The bundle size of the core does not grow.

## Stub

None. The nodes that own these modules wait for the split.

## Contract tests

The whole suite of packages/brumate.

## Changes

- v2: frozen by split-client-runtime (#274), with the module order of client-modules.change-request.md.
- v1: draft, from the adversarial review.
