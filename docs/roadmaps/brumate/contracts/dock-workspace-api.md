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

Draft. `dock-split` fixes the exact types in `packages/brumate/src/runtime/devtools-panel/workspace.ts`.

```ts
interface Workspace {
  id: 'inspect' | 'activity' | 'issues' | 'page';
  label: string;
  icon: string;
  badge?(ctx: DockContext): number | undefined;
  draw(ctx: DockContext, into: HTMLElement): void;
}
interface DockContext {
  root: ShadowRoot;
  state: DevtoolsState;
  select(workspace: Workspace['id'], target?: string): void;
  split(options: { key: string; min: [number, number]; start: number }): { first: HTMLElement; second: HTMLElement };
  drawGraph(scope: Scope, info: ComponentInfo | undefined): HTMLElement;
  drawCallDetail(call: DevtoolsEntry): HTMLElement;
}
```

## Behavior

- A workspace draws only into the element it gets and redraws when the shell calls `draw` again.
- `split` keeps the sizes by `key` with the dock's size.
- `drawGraph` and `drawCallDetail` are filled by `dock-graph` and `dock-call-detail`; until they land the context returns the old content or an empty state.

## Stub

`dock-split` ships a `split()` that returns two plain columns, and the old graph code behind `drawGraph`.

## Contract tests

`packages/brumate/test/devtools.test.ts` (unchanged) and a type check of each workspace against `Workspace`.

## Changes

- v1: initial.
