// The panel of the devtools overlay: the scopes of the page with their
// values, a log of handlers, loaded parts and writes, and the inspect report
// of a component. It reads the core through the hooks in `devtools.ts`.

import type { Scope } from './client.ts';
import { preview } from './devtools.ts';
import type { DevtoolsState } from './devtools.ts';

/** What the dev server tells about a component: see the inspect endpoint of the plugin. */
interface ComponentInfo {
  name: string;
  file: string;
  /** Each scope of the component, by its number in the compiled component. */
  scopes: Record<number, { label: string; slots: string[] }>;
  /** The inspect report as text. */
  text: string;
}

const STYLE = `
:host { all: initial; }
.panel { position: fixed; right: 12px; bottom: 52px; z-index: 2147483647; width: min(460px, calc(100vw - 24px)); height: min(60vh, 560px); display: flex; flex-direction: column; background: #111; color: #eee; font: 12px/1.5 ui-monospace, monospace; border: 1px solid #8884; border-radius: 8px; box-shadow: 0 8px 32px #0006; overflow: hidden; }
.tabs { display: flex; gap: 4px; padding: 6px; border-bottom: 1px solid #8883; }
.tabs button { font: inherit; color: inherit; background: none; border: 1px solid transparent; border-radius: 4px; padding: 2px 8px; cursor: pointer; }
.tabs button[aria-selected="true"] { border-color: #8886; background: #fff1; }
.body { flex: 1; overflow: auto; padding: 8px; }
.component { margin-bottom: 10px; }
.component > button { font: inherit; font-weight: 600; color: #9cf; background: none; border: 0; padding: 0; cursor: pointer; }
.scope { margin-left: 12px; padding-left: 8px; border-left: 1px solid #8883; }
.scope-label { color: #aaa; }
.slot { white-space: pre; }
.slot .name { color: #fc9; }
.written { animation: flash 0.8s; }
@keyframes flash { from { background: #fd04; } to { background: transparent; } }
.entry { white-space: pre-wrap; border-bottom: 1px solid #8882; padding: 2px 0; }
.entry .time { color: #888; margin-right: 6px; }
.entry.handler .kind { color: #9cf; }
.entry.part .kind { color: #9e9; }
.entry.write .kind { color: #fc9; }
pre { margin: 0; white-space: pre-wrap; }
.empty { color: #888; }
`;

type Tab = 'scopes' | 'log' | 'report';

const components = new Map<string, Promise<ComponentInfo | undefined>>();

/** Asks the dev server about a component, once. */
function componentInfo(state: DevtoolsState, id: string): Promise<ComponentInfo | undefined> {
  let info = components.get(id);
  if (!info) {
    info = fetch(`${state.endpoint}/${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? (response.json() as Promise<ComponentInfo>) : undefined))
      .catch(() => undefined);
    components.set(id, info);
  }
  return info;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

let panel: HTMLElement | undefined;

/** Opens the panel, or closes it when it is open. */
export function togglePanel(root: ShadowRoot, state: DevtoolsState): void {
  if (panel) {
    panel.remove();
    panel = undefined;
    state.changed = undefined;
    return;
  }
  let tab: Tab = 'scopes';
  let selected: string | undefined;
  const body = element('div', { class: 'body' });
  const tabs = element('div', { class: 'tabs', role: 'tablist' });
  for (const [name, label] of [
    ['scopes', 'Scopes'],
    ['log', 'Log'],
    ['report', 'Report'],
  ] as const) {
    const button = element('button', { role: 'tab', 'data-tab': name }, label);
    button.addEventListener('click', () => {
      tab = name;
      draw();
    });
    tabs.append(button);
  }
  panel = element('div', { class: 'panel' }, element('style', {}, STYLE), tabs, body);
  root.append(panel);

  /** A scope with its slots and the scopes inside it, other than components. */
  const drawScope = (scope: Scope, info: ComponentInfo | undefined): HTMLElement => {
    const plan = info?.scopes[scope.k];
    const box = element(
      'div',
      { class: state.written.has(scope.id) ? 'scope written' : 'scope' },
      element(
        'div',
        { class: 'scope-label' },
        `scope ${scope.id}${plan ? ` · ${plan.label}` : ''}`,
      ),
    );
    scope.s.forEach((value, slot) => {
      box.append(
        element(
          'div',
          { class: 'slot' },
          element('span', { class: 'name' }, plan?.slots[slot] ?? `slot ${slot}`),
          ` = ${preview(value)}`,
        ),
      );
    });
    for (const child of scope.children) {
      if (child.m === undefined) {
        box.append(drawScope(child, info));
      }
    }
    return box;
  };

  const drawScopes = async (): Promise<void> => {
    const roots = [...(state.scopes?.values() ?? [])].filter((scope) => scope.m !== undefined);
    const infos = await Promise.all(roots.map((scope) => componentInfo(state, scope.m!)));
    const list = element('div');
    roots.forEach((scope, index) => {
      const info = infos[index];
      const name = element('button', {}, info ? `${info.name} (${info.file})` : scope.m!);
      name.title = 'Show the report of this component';
      name.addEventListener('click', () => {
        selected = scope.m;
        tab = 'report';
        draw();
      });
      list.append(element('div', { class: 'component' }, name, drawScope(scope, info)));
    });
    if (roots.length === 0) {
      list.append(element('div', { class: 'empty' }, 'No scopes yet. The first event loads them.'));
    }
    body.replaceChildren(list);
  };

  const drawLog = (): void => {
    const list = element('div');
    for (const entry of state.log.toReversed()) {
      list.append(
        element(
          'div',
          { class: `entry ${entry.kind}` },
          element('span', { class: 'time' }, `${(entry.time / 1000).toFixed(2)}s`),
          element('span', { class: 'kind' }, entry.kind),
          ` ${entry.text}`,
        ),
      );
    }
    if (state.log.length === 0) {
      list.append(element('div', { class: 'empty' }, 'Nothing has happened yet.'));
    }
    body.replaceChildren(list);
  };

  const drawReport = async (): Promise<void> => {
    const id = selected ?? [...(state.scopes?.values() ?? [])].find((scope) => scope.m)?.m;
    const info = id ? await componentInfo(state, id) : undefined;
    body.replaceChildren(
      info
        ? element('pre', {}, info.text)
        : element('div', { class: 'empty' }, 'Choose a component in Scopes.'),
    );
  };

  let queued = false;
  const draw = (): void => {
    for (const button of tabs.querySelectorAll('button')) {
      button.setAttribute('aria-selected', String(button.dataset.tab === tab));
    }
    if (tab === 'log') {
      drawLog();
      return;
    }
    // Marks of writes show once, on the next draw of the scopes.
    void (tab === 'scopes' ? drawScopes() : drawReport()).then(() => state.written.clear());
  };
  // Changes come in bursts, so the panel draws once per frame.
  state.changed = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (panel) {
          draw();
        }
      });
    }
  };
  draw();
}
