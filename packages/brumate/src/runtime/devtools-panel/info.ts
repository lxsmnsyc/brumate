// What the dev server says about the components, and helpers that read the scopes of the page.

import type { Scope } from '../client.ts';
import { findRootScope, preview } from '../devtools.ts';
import type { BlockEntry, DevtoolsState } from '../devtools.ts';
import { element, icon } from './dom.ts';

/** What the dev server tells about a component: see the inspect endpoint of the plugin. */
export interface ComponentInfo {
  name: string;
  file: string;
  /** Each scope of the component, by its number in the compiled component. */
  scopes: Record<number, { label: string; slots: string[]; readers?: string[][] }>;
  graph?: {
    nodes: GraphNode[];
    /** Pairs of node indexes: the first is read by the second. */
    edges: [number, number][];
  };
  /** The inspect report as text. */
  text: string;
  /** The absolute path of the file, for the editor. */
  path?: string;
  /** The URL that the browser loads the client code of the component from. */
  url?: string;
  /** Each anchor of each scope: what it is, its place in the file and what its updates read. */
  anchors?: Record<number, Record<number, { label: string; at?: string; reads: string[] }>>;
}

/** A node of the graph of a component. */
export interface GraphNode {
  kind: string;
  label: string;
  scope: number;
  slot?: number;
  /** Its place in the file, or in the file of the module that gave the code to the component. */
  at?: { line: number; column: number; file?: string };
}

const components = new Map<string, Promise<ComponentInfo | undefined>>();
export const known: Map<string, ComponentInfo> = new Map();

/** Asks the dev server about a component, once. */
export function componentInfo(
  state: DevtoolsState,
  id: string,
): Promise<ComponentInfo | undefined> {
  let info = components.get(id);
  if (!info) {
    info = fetch(`${state.endpoint}/${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? (response.json() as Promise<ComponentInfo>) : undefined))
      .then((value) => {
        if (value) {
          known.set(id, value);
        }
        return value;
      })
      .catch(() => undefined);
    components.set(id, info);
  }
  return info;
}

/** The IDs of the components that instances in a list belong to. */
export function collectModules(instances: Scope[]): Set<string> {
  const ids = new Set<string>();
  for (const scope of instances) {
    ids.add(scope.m!);
  }
  return ids;
}

/** How many blocks of the page are in a state. */
export function countBlocks(blocks: Iterable<BlockEntry>, blockState: BlockEntry['state']): number {
  let count = 0;
  for (const block of blocks) {
    if (block.state === blockState) {
      count++;
    }
  }
  return count;
}

/** The infos of many components, in the order of their IDs. */
export function loadComponents(
  state: DevtoolsState,
  ids: Iterable<string>,
): Promise<(ComponentInfo | undefined)[]> {
  const pending: Promise<ComponentInfo | undefined>[] = [];
  for (const id of ids) {
    pending.push(componentInfo(state, id));
  }
  return Promise.all(pending);
}

/** The value of a name that a scope or one of the scopes around it holds. */
export function readValue(scope: Scope, name: string): string | undefined {
  for (let current: Scope | undefined = scope; current; current = current.p) {
    const slots = known.get(findRootScope(current).m ?? '')?.scopes[current.k]?.slots;
    const slot = slots?.indexOf(name) ?? -1;
    if (slot !== -1) {
      return preview(current.s[slot]);
    }
    if (current.m !== undefined) {
      break;
    }
  }
  return undefined;
}

/** A button that opens a place of a file in the editor, through the dev server. */
export function source(info: ComponentInfo | undefined, at = '1:1'): Node | string {
  if (!info) {
    return '';
  }
  const label = at === '1:1' ? info.file : `${info.file}:${at}`;
  if (!info.path) {
    return element('span', { class: 'mono sub' }, label);
  }
  const open = element(
    'button',
    { class: 'link', title: 'Open in the editor' },
    label,
    icon('open', 12),
  );
  open.addEventListener('click', () => {
    void fetch(`/__open-in-editor?file=${encodeURIComponent(`${info.path}:${at}`)}`);
  });
  return open;
}

/** A button that opens the place of a graph node in the editor. */
export function place(info: ComponentInfo, at: NonNullable<GraphNode['at']>): Node | string {
  const label = `line ${at.line}`;
  const file = at.file ?? info.path;
  if (!file) {
    return element('span', { class: 'mono sub' }, label);
  }
  const open = element(
    'button',
    { class: 'link', title: `Open ${at.file ?? info.file}:${at.line}:${at.column}` },
    label,
    icon('open', 12),
  );
  open.addEventListener('click', () => {
    void fetch(`/__open-in-editor?file=${encodeURIComponent(`${file}:${at.line}:${at.column}`)}`);
  });
  return open;
}

/** The scopes of a component instance, without the components inside it. */
export function countScopes(scope: Scope): number {
  let count = 1;
  for (const child of scope.children ?? []) {
    if (child.m === undefined) {
      count += countScopes(child);
    }
  }
  return count;
}

/** The scopes of component instances. */
export function roots(state: DevtoolsState): Scope[] {
  const result: Scope[] = [];
  for (const scope of state.scopes?.values() ?? []) {
    if (scope.m !== undefined) {
      result.push(scope);
    }
  }
  return result;
}

/** The scope with an ID, or nothing when the browser does not have it. */
export function findScope(state: DevtoolsState, id: string): Scope | undefined {
  return state.scopes?.get(/^-?\d+$/.test(id) ? Number(id) : id);
}

/** What the dev server says about an anchor of a scope, with the component that has it. */
/** An anchor of a scope: what it is, its place in the file and what its updates read. */
export type Anchor = NonNullable<NonNullable<ComponentInfo['anchors']>[number]>[number];

export async function findAnchor(
  state: DevtoolsState,
  scope: Scope,
  anchor: number,
): Promise<{ info: ComponentInfo | undefined; component: Scope; place: Anchor | undefined }> {
  const component = findRootScope(scope);
  const info = component.m ? await componentInfo(state, component.m) : undefined;
  return { info, component, place: info?.anchors?.[scope.k]?.[anchor] };
}

/** The names that an anchor reads, with their values in the scope. */
export function drawReads(scope: Scope, reads: string[]): Node[] {
  const pills: Node[] = [];
  for (const name of reads) {
    const value = readValue(scope, name);
    pills.push(
      element(
        'span',
        { class: 'pill', style: 'margin: 0 4px 2px 0' },
        element('span', { class: 'name' }, name),
        value === undefined ? '' : ` = ${value}`,
      ),
    );
  }
  return pills;
}
