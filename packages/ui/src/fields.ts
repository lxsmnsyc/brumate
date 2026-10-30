// Helpers of the fields, which the parts call in the browser.

/** True when the field is the first invalid field of its form, which gets focus on a submit. */
export function isFirstInvalid(field: HTMLInputElement | HTMLTextAreaElement): boolean {
  const form = field.form;
  if (!form) {
    return true;
  }
  return form.querySelector(':invalid:not(form, fieldset)') === field;
}

/** The messages of a value that `validate` returns: a message, a list, or nothing. */
export function messagesOf(result: string | string[] | true | null | undefined): string[] {
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
