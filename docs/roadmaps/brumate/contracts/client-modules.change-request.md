# Change request: client-modules v1 to v2

- From node: split-client-runtime
- Status: open # open | accepted | rejected

## Problem

The map of v1 cannot be built as it is. The repo has `import/no-cycle` as an error in `.oxlintrc.json`, and the map has cycles between its modules. The calls of the functions form no cycle, but these pairs call each other across the proposed modules:

- `updates.set` calls `call` (handlers), and `handle` (handlers) calls `set`. `asyncMemo` and `effect` call `fail` (handlers), and `fail` renders a `#catch` body through `insertHTML` (blocks).
- `insertHTML` (blocks) calls `refresh` (resume), and `init` and `leavePage` (resume) call `indexMarkers` (blocks).
- `removeScope` and `leavePage` read and write the state of updates, guesses and blocks.

Evidence: a first split by the names of v1 gave dozens of `import(no-cycle)` errors from `npx oxlint`. The final layout gives none.

## Proposed change

Keep the four names of v1 and what they were for, and add the modules that the order below needs. A module imports only the modules before it in this order, so there are no cycles:

| Module               | Holds                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| client/state.ts      | the types, `options`, `scopes`, `hooks`, the registries of modules, parts and nodes, `configure`, `setHiding`, `setGuesses` |
| client/code.ts       | `loadModule`, `loadPart`, `loadComponent`, `codeReady`, `loadedFunction`                                                    |
| client/blocks.ts     | the marker observer, `indexMarkers`, `findComment`, `findElement`, `blockStart`, `rangeEnd`, `clear`, `nameComment`         |
| client/references.ts | `resolve`, `call`, `serverBuild` (moved out of handlers.ts)                                                                 |
| client/scopes.ts     | `createScope`, `removeScope`, `descendants`, `rootOf`, `resolveScope`, `inPlace`, `holderOf`                                |
| client/titles.ts     | the `<title>` observer and `title`                                                                                          |
| client/insert.ts     | `insertHTML`, `refresh`, `parseHTML` (insertHTML and refresh moved out of blocks.ts and resume.ts)                          |
| client/children.ts   | `Children`, `RenderedChildren`, `TemplateCall`, `insert`, `childrenReady`                                                   |
| client/errors.ts     | `fail`, `catchInto` (moved out of handlers.ts)                                                                              |
| client/updates.ts    | `get`, `set`, `writeSlot`, `run`, `memo`, `asyncMemo`, `effect`, `flushEffects`, `trigger`, the pending counts              |
| client/guesses.ts    | `guess`, `track`                                                                                                            |
| client/props.ts      | `prop`, `spreadProps`                                                                                                       |
| client/handlers.ts   | `handle`, `spread`, `callable`, `handlerProp`, `rpc`, `action`, `submitAction`                                              |
| client/context.ts    | `provideValue`, `consumeContext`, `updateContext`, `setGlobal`, `updateRoute`                                               |
| client/templates.ts  | `template`, `clone`, and the helpers that fill a clone                                                                      |
| client/branches.ts   | `branch`, `rekey`, `retag`, `reset`, `fill`, `offscreen`                                                                    |
| client/lists.ts      | `list`, `windowList`, `windowStart`                                                                                         |
| client/inserts.ts    | `text`, `content`, `attr`, `attrs`, `portalTo`                                                                              |
| client/components.ts | `component`, `dynamic`, `setSlots`, `setItem`                                                                               |
| client/page.ts       | `setVar`, `addHead`, `addPortal`, `addStyle`                                                                                |
| client/resume.ts     | `init`, `readRecord`, `addScopes`, `dispose`, `leavePage`, `leaveRoutes`, `remount`, `forget`, `removeRoot`                 |
| client.ts            | re-exports, and `loader`                                                                                                    |

Where v1 differs:

- `call`, `resolve` and `fail` are not in handlers.ts. `handle` is above `set`, and `set` is above them.
- `insertHTML` is in insert.ts, not blocks.ts. The marker observer, the index and the finders stay in blocks.ts. `refresh` is in insert.ts, not resume.ts.
- Each `let` that two modules write has a small function in the module that holds it: `treeChanged`, `resetIds`, `resetWrites`, `leaveGuesses`, `resetHandler`, `setHiding`, `setGuesses`, `markCloned`, `observeMarkers`, `stopObserving`, `configure`.

New order of modules, for a rule in the contract: state, code, blocks, references, scopes, titles, insert, children, errors, updates, guesses, props, handlers, context, templates, branches, lists, inserts, components, page, resume.

## Affected nodes

- ordered-updates: updates.ts and scopes.ts (`run` reads the scope tree), and `trigger` in updates.ts.
- batching: updates.ts and handlers.ts.
- fields-typed-early: resume.ts, state.ts.
- drop-marker-index: blocks.ts and insert.ts (`insertHTML` calls `indexMarkers`), and templates.ts for the clone helpers.

## Workaround in place

The PR of this node builds this layout. The contract file is not edited.

## Decision

<Filled in by the orchestrator: accepted or rejected, and why.>
