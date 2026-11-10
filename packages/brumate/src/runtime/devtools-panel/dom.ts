// Elements, icons and the small parts that the workspaces share.

export function element<K extends keyof HTMLElementTagNameMap>(
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

export function svg(
  tag: string,
  attributes: Record<string, string | number>,
  ...children: Node[]
): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  node.append(...children);
  return node;
}

/**
 * The icons of the panel: strokes on a grid of 24, in the colour of the text.
 */
export const ICONS = {
  overview:
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.75"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.75"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.75"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.75"/>',
  errors:
    '<path d="M10.3 4.6a2 2 0 0 1 3.4 0l7 12.2a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3z"/><path d="M12 9.5v4"/><path d="M12 16.8v.2"/>',
  scopes:
    '<rect x="9" y="3" width="6" height="5" rx="1.25"/><rect x="3" y="16" width="6" height="5" rx="1.25"/><rect x="15" y="16" width="6" height="5" rx="1.25"/><path d="M12 8v4M6 16v-2.25A1.75 1.75 0 0 1 7.75 12h8.5A1.75 1.75 0 0 1 18 13.75V16"/>',
  elements: '<path d="M5 4.5 18 10l-5.5 2L10 17.5z"/><path d="m13 13 5.5 5.5"/>',
  graph:
    '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6"/>',
  log: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/>',
  loading: '<path d="M4 6h7M8 12h9M13 18h7"/>',
  state:
    '<ellipse cx="12" cy="6" rx="7.5" ry="2.75"/><path d="M4.5 6v6c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75V6"/><path d="M4.5 12v6c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75v-6"/>',
  effects: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4h-4"/>',
  navigation:
    '<path d="M4 7h11M4 7l3.5-3.5M4 7l3.5 3.5"/><path d="M20 17H9M20 17l-3.5-3.5M20 17l-3.5 3.5"/>',
  server:
    '<rect x="4" y="4" width="16" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.5"/><path d="M7.5 7.25h.01M7.5 16.75h.01" stroke-width="2.6"/>',
  timeline: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.6M10 3h4"/>',
  blocks:
    '<path d="M12 3.5 3.5 8 12 12.5 20.5 8z"/><path d="M3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16"/>',
  flash:
    '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="2.5"/>',
  pick: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  close: '<path d="m6 9.5 6 6 6-6"/>',
  trash:
    '<path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  fit: '<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l9-11h-6z"/>',
  open: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
} as const;

/** The name of an icon. */
export type IconName = keyof typeof ICONS;

/** An icon by its name, for a button or a tab. */
export function icon(name: IconName, size = 14): SVGElement {
  const node = svg('svg', {
    class: 'icon',
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  node.innerHTML = ICONS[name];
  return node;
}

/** A button with an icon, and its text or, for an icon alone, its label for screen readers. */
export function iconButton(
  name: IconName,
  text: string,
  attributes: Record<string, string> = {},
  iconOnly = false,
): HTMLButtonElement {
  const button = element(
    'button',
    { class: `tool${iconOnly ? ' only' : ''}`, ...attributes },
    icon(name),
  );
  if (iconOnly) {
    button.setAttribute('aria-label', text);
    button.title ||= text;
  } else {
    button.append(text);
  }
  return button;
}

export function pill(text: string, color = ''): HTMLElement {
  return element('span', { class: `pill ${color}` }, text);
}

/** A row of cells, as a table row. */
export function row(cells: (Node | string)[], tag: 'td' | 'th' = 'td'): HTMLElement {
  const items: HTMLElement[] = [];
  for (const cell of cells) {
    items.push(element(tag, {}, cell));
  }
  return element('tr', {}, ...items);
}

/** A card of a number, with a label above and a note below. */
export function card(label: string, value: string, note: string): HTMLElement {
  return element(
    'div',
    { class: 'card' },
    element('div', { class: 'label' }, label),
    element('div', { class: 'value' }, value),
    element('div', { class: 'note' }, note),
  );
}

/** A square of colour and its meaning, for a legend. */
export function key(color: string, text: string): HTMLElement {
  return element('span', {}, element('i', { style: `background: ${color}` }), text);
}
