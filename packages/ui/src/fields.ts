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
    return result.filter(Boolean);
  }
  return typeof result === 'string' && result ? [result] : [];
}

/** The IDs that aria-describedby names, without the empty ones. */
export function describedBy(...ids: (string | false | undefined | null)[]): string | undefined {
  const value = ids.filter(Boolean).join(' ');
  return value || undefined;
}

/** The first list of messages that has any. A field shows one source of errors at a time. */
export function firstErrors(...lists: string[][]): string[] {
  return lists.find((list) => list.length > 0) ?? [];
}

/**
 * Runs `reset` when the form of `element` resets, and returns the function that stops the
 * listening, for a `$client` to return. It returns nothing when the element has no form.
 *
 * `reset` runs first, as a reset event comes before the browser resets the fields. It writes the
 * first value through the setter of the part, as an edit does, so a setter that refuses refuses
 * the reset too. `settled` runs once the browser has reset the fields, and puts the value of the
 * part back in the native field, which the browser set to its own default.
 */
export function onFormReset(
  element: Element | null | undefined,
  reset: () => void,
  settled?: () => void,
): (() => void) | undefined {
  const owner = (element as HTMLInputElement | null | undefined)?.form ?? element?.closest('form');
  if (!owner) {
    return undefined;
  }
  function listener() {
    reset();
    if (settled) {
      setTimeout(settled, 0);
    }
  }
  owner.addEventListener('reset', listener);
  return () => owner.removeEventListener('reset', listener);
}
