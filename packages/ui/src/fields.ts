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

/** The first list of messages that has any, as React Aria shows one source of errors at a time. */
export function firstErrors(...lists: string[][]): string[] {
  return lists.find((list) => list.length > 0) ?? [];
}
