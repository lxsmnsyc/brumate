// The shortcut of a DialogTrigger. A shortcut is written as the keys of `prevent`: a key by its
// `event.key`, or that key after `Mod+`, `Ctrl+`, `Meta+` or `Alt+`. `Mod` is Ctrl or Meta.

/** True when the event is the shortcut. A letter matches in either case, and Shift does not count. */
export function matchesShortcut(shortcut: string, event: KeyboardEvent): boolean {
  const plus = shortcut.indexOf('+', 1);
  const modifier = plus > 0 ? shortcut.slice(0, plus) : '';
  const wanted = plus > 0 ? shortcut.slice(plus + 1) : shortcut;
  const key = event.key === ' ' ? 'Space' : event.key;
  if (key !== wanted && !(wanted.length === 1 && key.toLowerCase() === wanted.toLowerCase())) {
    return false;
  }
  switch (modifier) {
    case 'Mod':
      return (event.ctrlKey || event.metaKey) && !event.altKey;
    case 'Ctrl':
      return event.ctrlKey && !event.metaKey && !event.altKey;
    case 'Meta':
      return event.metaKey && !event.ctrlKey && !event.altKey;
    case 'Alt':
      return event.altKey && !event.ctrlKey && !event.metaKey;
    default:
      return !event.ctrlKey && !event.metaKey && !event.altKey;
  }
}

const NO_TEXT = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** True when the element takes text, so a key typed there may be meant for the field. */
export function isTyping(element: Element | null): boolean {
  if (element instanceof HTMLInputElement) {
    return !NO_TEXT.has(element.type);
  }
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}
