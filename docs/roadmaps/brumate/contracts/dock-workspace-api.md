---
name: dock-workspace-api
version: 1
status: draft
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
  badge?(ctx: DockContext): number | undefined;
  draw: TabDraw;
  /** The old tabs it holds. The tab bar draws the one in `shell.tab`. Dock-shell removes this. */
  tabs: Partial<Record<Tab, TabDraw>>;
}

interface DockContext {
  root: ShadowRoot;
  state: DevtoolsState;
  shell: Shell; // what the dock remembers between draws: selections, filters, graph view
  draw(): void; // draws the open workspace again
  select(workspace: WorkspaceId, target?: string): void; // target: a tab name of the old tab bar
  split(options: { key: string; min: [number, number]; start: number }): Columns;
  outline(scope?: ScopeId): void; // outlines the elements of a scope on the page; none clears
  pick(): void; // starts or stops Pick
  drawGraph(scope: Scope, info: ComponentInfo | undefined): HTMLElement;
  drawCallDetail(call: DevtoolsEntry): HTMLElement;
}

interface Columns {
  box: HTMLElement; // the element to put in the workspace
  first: HTMLElement;
  second: HTMLElement;
}
```

The shell state is `Shell` (same file); `createShell(tab)` makes one. The module-level `panel`, `showTab` and `endPick` of the old file are fields of it.

Each workspace module exports one object: `inspect` (`inspect.ts`), `activity` (`activity.ts`), `issues` (`issues.ts`), `page` (`page.ts`).

## Behavior

- A workspace draws only into the element it gets and redraws when the shell calls `draw` again. A workspace that waits for the dev server returns a promise; the shell draws again when the user left the tab meanwhile.
- A workspace keeps what it remembers in `ctx.shell`, not in a module variable.
- `split` keeps the sizes by `key` with the dock's size (dock-split-handle). The stub ignores the options.
- `drawGraph` and `drawCallDetail` are filled by `dock-graph` and `dock-call-detail`; until they land the context returns the old content or an empty state.
- `draw` of a workspace draws the tab in `shell.tab` when the workspace holds it (`drawTabOf`). Until dock-shell lands the tab bar stays and each of the 13 old tabs is a key of one workspace's `tabs`.

## Stub

`dock-split` ships `splitPlain()` behind `ctx.split`: a `div.split` with a `div.list` and a `div.detail`, the same DOM as before, so the existing styles apply. `ctx.drawGraph` draws the old graph (`graph.ts`, `drawGraph(ctx, id, instance, info)`) and returns an empty state for a component without a graph. `ctx.drawCallDetail` returns an empty state.

## Contract tests

`packages/brumate/test/devtools.test.ts` (unchanged) and a type check of each workspace against `Workspace`.

## Changes

- v1: initial.
- v1 (dock-split): types fixed. `outline` and `pick` are added to the context, `split` returns `{ box, first, second }`, `icon` is an `IconName`, and `tabs` and a `draw` that returns a promise serve the old tab bar.
