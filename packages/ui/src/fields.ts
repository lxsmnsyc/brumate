// Helpers of the fields, which the parts call in the browser.

// The runtime registers this under a symbol, as it does for `flush`. It is missing in an older
// runtime and in an app that passes no `$bind`, and then no setter waits.
function whenSettled(): Promise<void> | undefined {
  return (globalThis as { [key: symbol]: (() => Promise<void> | undefined) | undefined })[
    Symbol.for('brumate.settled')
  ]?.();
}

/** True when the field is the first invalid field of its form, which gets focus on a submit. */
export function isFirstInvalid(field: HTMLInputElement | HTMLTextAreaElement): boolean {
  const form = field.form;
  if (!form) {
    return true;
  }
  return form.querySelector(':invalid:not(form, fieldset)') === field;
}

/** The messages of a value that `validate` returns: a message, a list, or nothing. */
export function parseMessages(result: string | string[] | true | null | undefined): string[] {
  if (Array.isArray(result)) {
    const messages: string[] = [];
    for (const message of result) {
      if (message) {
        messages.push(message);
      }
    }
    return messages;
  }
  return typeof result === 'string' && result ? [result] : [];
}

/** The IDs that aria-describedby names, without the empty ones. */
export function describedBy(...ids: (string | false | undefined | null)[]): string | undefined {
  const named: string[] = [];
  for (const id of ids) {
    if (id) {
      named.push(id);
    }
  }
  const value = named.join(' ');
  return value || undefined;
}

/** The first list of messages that has any. A field shows one source of errors at a time. */
export function firstErrors(...lists: string[][]): string[] {
  for (const list of lists) {
    if (list.length > 0) {
      return list;
    }
  }
  return [];
}

/**
 * Runs `reset` when the form of `element` resets, and returns the function that stops the
 * listening, for a `$client` to return. It returns nothing when the element has no form. The
 * form is found once, when this runs.
 *
 * A reset event comes before the browser resets the fields, and a later listener can still
 * prevent it. So `reset` and `settled` wait for the end of the event, and run only if the reset
 * was not prevented, after the browser reset the fields. `reset` writes the first value through
 * the setter of the part, as an edit does, so a setter that refuses refuses the reset too.
 * `settled` runs just after it and puts the value of the part back in the native input, which
 * the browser set to its own default.
 */
export function onFormReset(
  element: Element | null | undefined,
  reset?: () => void,
  settled?: () => void,
): (() => void) | undefined {
  const owner = (element as HTMLInputElement | null | undefined)?.form ?? element?.closest('form');
  if (!owner) {
    return undefined;
  }
  const timers = new Set<ReturnType<typeof setTimeout>>();
  function listener(event: Event) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!event.defaultPrevented) {
        reset?.();
        settled?.();
      }
    }, 0);
    timers.add(timer);
  }
  owner.addEventListener('reset', listener);
  return () => {
    owner.removeEventListener('reset', listener);
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();
  };
}

// The latest edit of each input, so only the check of the newest one touches it.
const edits = new WeakMap<Element, number>();

/** Maps a caret of the typed text to the kept text: the same place from the start or from the end. */
function fitCaret(typed: string, kept: string, caret: number): number {
  const most = Math.min(typed.length, kept.length);
  let head = 0;
  while (head < most && typed[head] === kept[head]) {
    head++;
  }
  let tail = 0;
  while (tail < most - head && typed[typed.length - 1 - tail] === kept[kept.length - 1 - tail]) {
    tail++;
  }
  if (caret <= head) {
    return caret;
  }
  if (caret >= typed.length - tail) {
    return kept.length - (typed.length - caret);
  }
  // Inside the text that the setter replaced: the end of the kept replacement.
  return kept.length - tail;
}

/**
 * Shows the text that a bound setter kept, once it has refused the text that the user typed.
 * `kept` reads the value of the part. A refusal at once puts the kept text back at once. A setter
 * that is still running, such as an async check, leaves the input alone until it settles, and
 * then puts the kept text back only if the value did not take what was typed. A later edit
 * cancels the check of an earlier one, since the later one waits for the same setters. The caret and
 * the selection stay where they still fit. `restored` runs after the text went back.
 */
export function showKept(
  input: HTMLInputElement | HTMLTextAreaElement | null | undefined,
  typed: string,
  kept: () => string,
  restored?: () => void,
): void {
  if (!input) {
    return;
  }
  const field = input;
  const edit = (edits.get(field) ?? 0) + 1;
  edits.set(field, edit);
  function restore() {
    const text = kept();
    // The input shows something else when a later edit or a value from the caller changed it.
    if (edits.get(field) !== edit || field.value !== typed || text === typed) {
      return;
    }
    const start = field.selectionStart;
    const end = field.selectionEnd;
    field.value = text;
    // Some types, such as email, have no caret to set.
    if (start !== null && end !== null && field.ownerDocument.activeElement === field) {
      try {
        field.setSelectionRange(
          fitCaret(typed, text, start),
          fitCaret(typed, text, end),
          field.selectionDirection ?? undefined,
        );
      } catch {
        // The caret stays at the end.
      }
    }
    restored?.();
  }
  const pending = whenSettled();
  if (pending) {
    void pending.then(restore);
  } else {
    restore();
  }
}
