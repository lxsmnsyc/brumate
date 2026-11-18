// The contract of the workspaces of the dock (docs/roadmaps/brumate/contracts/dock-workspace-api.md).
// A workspace module exports one `Workspace`. The shell gives it a `DockContext` and an element to
// draw into, and draws again when something changes.

import type { Scope } from '../client.ts';
import type { DevtoolsEntry, DevtoolsState, ErrorEntry } from '../devtools.ts';
import type { ScopeId } from '../shared.ts';
import { element } from './dom.ts';
import type { IconName } from './dom.ts';
import { collectModules, known, roots } from './info.ts';
import type { ComponentInfo } from './info.ts';

/** The ID of a workspace. */
export type WorkspaceId = 'inspect' | 'activity' | 'issues' | 'page';

/** The tabs of the tab bar that the workspaces replace. Dock-shell removes them. */
export type Tab =
  | 'overview'
  | 'errors'
  | 'scopes'
  | 'elements'
  | 'graph'
  | 'log'
  | 'timeline'
  | 'state'
  | 'effects'
  | 'navigation'
  | 'server'
  | 'blocks';

/** Draws one tab into an element. A tab that waits for the dev server returns a promise. */
export type TabDraw = (ctx: DockContext, into: HTMLElement) => void | Promise<void>;

export interface Workspace {
  id: WorkspaceId;
  label: string;
  icon: IconName;
  /** A count for the navigation, or nothing. */
  badge?(ctx: DockContext): number | undefined;
  /** Draws the workspace into the element. It returns a promise when it waits for the dev server. */
  draw: TabDraw;
  /** The old tabs that the workspace holds. The tab bar draws the one in `shell.tab`. */
  tabs: Partial<Record<Tab, TabDraw>>;
}

/** The two columns that `split` returns, in a box. */
export interface Columns {
  box: HTMLElement;
  first: HTMLElement;
  second: HTMLElement;
}

export interface SplitOptions {
  /** Names the split, to keep its size. */
  key: string;
  /** The least size of each side, in pixels. */
  min: [number, number];
  /** The size of the first side at first, in pixels. */
  start: number;
}

export interface DockContext {
  root: ShadowRoot;
  state: DevtoolsState;
  /** What the dock remembers between draws. */
  shell: Shell;
  /** Draws the open workspace again. */
  draw(): void;
  /** Opens a workspace. The target names a tab of the old tab bar, until the shell replaces it. */
  select(workspace: WorkspaceId, target?: Tab): void;
  /** Two columns in a box. */
  split(options: SplitOptions): Columns;
  /** Outlines the elements of a scope on the page, or none without a scope. */
  outline(scope?: ScopeId): void;
  /** Starts or stops Pick. */
  pick(): void;
  /** The graph of a component, drawn from one of its instances. */
  drawGraph(scope: Scope, info: ComponentInfo | undefined): HTMLElement;
  /** The detail of a server function call. */
  drawCallDetail(call: DevtoolsEntry): HTMLElement;
}

/** What the dock remembers: one object that the context carries. */
export interface Shell {
  panel: HTMLElement | undefined;
  /** Switches the tab of the open panel. */
  showTab: ((tab: Tab) => void) | undefined;
  /** Stops picking, with its outline and card, when the panel closes. */
  endPick: (() => void) | undefined;
  tab: Tab;
  /** The error and the place of its stack that the Errors tab shows. */
  selectedError: ErrorEntry | undefined;
  selectedFrame: number;
  /** The ID of the component that Graph shows. */
  selected: string | undefined;
  selectedScope: ScopeId | undefined;
  editing: { scope: ScopeId; slot: number } | undefined;
  paused: boolean;
  filter: string;
  logSearch: string;
  shown: Set<DevtoolsEntry['kind']>;
  /** The log as it was when Pause was pressed. */
  frozen: DevtoolsEntry[] | undefined;
  /** The element that Pick found, for the Elements tab. */
  picked: Element | undefined;
  /** The node of the graph that was clicked, and the pan and zoom of the graph. */
  graphNode: number | undefined;
  view: { x: number; y: number; scale: number; fitted: string };
  /** The timer that draws the graph again when the marks of a write expire. */
  cooling: ReturnType<typeof setTimeout> | undefined;
  /** The state of a workspace that is not part of the shell, by workspace. A child adds its own. */
  work: Partial<Record<WorkspaceId, object>>;
}

/** The kinds of entries that the log shows. */
export const KINDS: DevtoolsEntry['kind'][] = ['handler', 'write', 'call'];

/** A shell in its first state. */
export function createShell(tab: Tab): Shell {
  return {
    panel: undefined,
    showTab: undefined,
    endPick: undefined,
    tab,
    selectedError: undefined,
    selectedFrame: -1,
    selected: undefined,
    selectedScope: undefined,
    editing: undefined,
    paused: false,
    filter: '',
    logSearch: '',
    shown: new Set(KINDS),
    frozen: undefined,
    picked: undefined,
    graphNode: undefined,
    view: { x: 0, y: 0, scale: 1, fitted: '' },
    cooling: undefined,
    work: {},
  };
}

/** Draws the tab of the shell, when the workspace holds it. */
export function drawTabOf(
  tabs: Workspace['tabs'],
  ctx: DockContext,
  into: HTMLElement,
): void | Promise<void> {
  return tabs[ctx.shell.tab]?.(ctx, into);
}

/** A select of the components on the page, for Graph. */
export function chooser(ctx: DockContext, current: string | undefined): HTMLElement {
  const { state, shell } = ctx;
  const select = element('select', { 'aria-label': 'Component' });
  for (const id of collectModules(roots(state))) {
    const info = known.get(id);
    const option = element('option', { value: id }, info ? `${info.name} · ${info.file}` : id);
    option.selected = id === current;
    select.append(option);
  }
  select.addEventListener('change', () => {
    shell.selected = select.value;
    shell.graphNode = undefined;
    ctx.draw();
  });
  return select;
}
