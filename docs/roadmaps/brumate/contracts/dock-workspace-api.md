---
name: dock-workspace-api
version: 2
status: frozen
defined_by: dock-split
---

# Contract: dock-workspace-api

## Purpose

What a workspace module of the dev dock exports and gets, so the shell and the workspace children (`dock-inspect`, `dock-graph`, `dock-activity`, `dock-call-detail`, `dock-issues`, `dock-page`) do not edit each other's files.

## Interface

Fixed by `dock-split` in `packages/brumate/src/runtime/devtools-panel/workspace.ts`. Modules of the dock import only types and helpers from it, and never the entry `devtools-panel.ts`.

```ts
type WorkspaceId = 'inspect' | 'activity' | 'issues' | 'page';
type TabDraw = (ctx: DockContext, into: HTMLElement) => void | Promise<void>;

interface Workspace {
  id: WorkspaceId;
  label: string;
  icon: IconName; // a key of ICONS in dom.ts
  badge?(ctx: DockContext): number | undefined; // temporary: unused, dock-shell removes it
  draw: TabDraw; // returns a promise only for the old tab bar (temporary)
  /** Temporary: the old tabs it holds. The tab bar draws the one in `shell.tab`. Dock-shell removes this. */
  tabs: Partial<Record<Tab, TabDraw>>;
}

interface DockContext {
  root: ShadowRoot;
  state: DevtoolsState;
  shell: Shell; // what the dock remembers between draws: selections, filters, graph view
  draw(): void; // draws the open workspace again
  select(workspace: WorkspaceId, target?: Tab): void; // target: a tab of the old bar (temporary)
  split(options: { key: string; min: [number, number]; start: number }): Columns;
  outline(scope?: ScopeId): void; // outlines the elements of a scope on the page; none clears
  pick(): void; // starts or stops Pick
  drawGraph(scope: Scope, info: ComponentInfo | undefined): HTMLElement;
  drawCallDetail(call: DevtoolsEntry): HTMLElement; // the stub is an empty div; the Log opens it for a call row
}

interface Columns {
  box: HTMLElement; // the element to put in the workspace
  first: HTMLElement;
  second: HTMLElement;
}
```

The shell state is `Shell`, with `work: Partial<Record<WorkspaceId, object>>` for the state of a workspace, so a child adds state without editing `workspace.ts` or `createShell` (same file); `createShell(tab)` makes one. The module-level `panel`, `showTab` and `endPick` of the old file are fields of it.

Each workspace module exports one object: `inspect` (`inspect.ts`), `activity` (`activity.ts`), `issues` (`issues.ts`), `page` (`page.ts`).

## Behavior

- A workspace draws only into the element it gets and redraws when the shell calls `draw` again. A workspace that waits for the dev server returns a promise; the shell draws again when the user left the tab meanwhile.
- A workspace keeps what it remembers in `ctx.shell` (its own state in `shell.work[id]`), not in a module variable. Caches of dev-server data at module level are allowed: `known` and `components` in `info.ts`, `mapped`, `sources` and `highlighter` in `stack.ts`.
- The Log opens a call row through `ctx.drawCallDetail` only, so `dock-call-detail` works in `devtools-panel/call-detail.ts` and never edits `activity.ts`.
- Temporary, removed by dock-shell: `Workspace.tabs`, `shell.tab`, the promise from `draw` and the unused `badge`.
- `split` keeps the sizes by `key` with the dock's size (dock-split-handle). The stub ignores the options.
- `drawGraph` and `drawCallDetail` are filled by `dock-graph` and `dock-call-detail`; until they land the context returns the old content or an empty state.
- `draw` of a workspace draws the tab in `shell.tab` when the workspace holds it (`drawTabOf`). Until dock-shell lands the tab bar stays and each of the 13 old tabs is a key of one workspace's `tabs`.

## Stub

`dock-split` ships `splitPlain()` behind `ctx.split`: a `div.split` with a `div.list` and a `div.detail`, the same DOM as before, so the existing styles apply. `ctx.drawGraph` draws the old graph (`graph.ts`, `drawGraph(ctx, id, instance, info)`) and returns an empty state for a component without a graph. `ctx.drawCallDetail` returns an empty state.

## Contract tests

`packages/brumate/test/devtools.test.ts` (unchanged) and a type check of each workspace against `Workspace`.

## Changes

- v1: initial.
- v2 (dock-split review): `shell.work`, `select` takes a `Tab`, temporary parts marked, module caches allowed, `drawCallDetail` opened by the Log, frozen.
- v1 (dock-split): types fixed. `outline` and `pick` are added to the context, `split` returns `{ box, first, second }`, `icon` is an `IconName`, and `tabs` and a `draw` that returns a promise serve the old tab bar.
