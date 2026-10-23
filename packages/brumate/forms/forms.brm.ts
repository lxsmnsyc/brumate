// `createForm`, the component side of progressive forms. It is a module
// function, so the compiler copies it into the component that calls it, and
// its state resumes with the page.

import { $action, $effect, $id, $memo } from 'brumate/signals';
import { DEFAULT_SUBMIT, formFields } from 'brumate/forms/core';
import type { SubmissionResult } from 'brumate/forms/core';
import type { StandardSchemaV1 } from 'brumate/server';

export type {
  Field,
  FieldAttributes,
  FieldState,
  Fields,
  IntentAttributes,
  ListItem,
  SubmissionResult,
} from 'brumate/forms/core';

/**
 * The values of a form: the input of its schema, or the type of the default
 * value when the schema does not type its input.
 */
export type FormValue<S extends StandardSchemaV1, D> =
  unknown extends StandardSchemaV1.InferInput<S> ? D : StandardSchemaV1.InferInput<S>;

/** The options of `createForm`. */
export interface FormOptions<T> {
  /**
   * The values that the fields show before a submit. It names every field
   * of the form, and a list of objects has one item, which new items take
   * the fields of.
   */
  defaultValue?: T;
}

/**
 * The state of a form that posts to a server function, which answers with
 * `parseSubmission(…).reply()`. It gives the attributes of the form, of its
 * fields and of the buttons of its lists, with the posted values and the
 * errors of the last submit. The form works without scripts, and with
 * scripts it posts without loading the page.
 *
 * ```brm
 * <script>
 *   import { createForm } from 'brumate/forms';
 *
 *   const { attrs, fields, errors, defaultSubmit } = createForm(save, Order, {
 *     defaultValue: { email: '' },
 *   });
 * </script>
 *
 * <form action=save {...attrs}>
 *   <button {...defaultSubmit}></button>
 *   <input {...fields.email.attrs} type="email">
 * </form>
 * ```
 */
export function createForm<S extends StandardSchemaV1, D = StandardSchemaV1.InferInput<S>>(
  action: (form: FormData) => Promise<SubmissionResult>,
  _schema: S,
  options: FormOptions<D> = {},
) {
  const result = $action(action);
  const id = $id();
  const fields = $memo(formFields(id, options.defaultValue as FormValue<S, D> | undefined, result));
  const errors = $memo(result && result.formErrors.length > 0 ? result.formErrors : undefined);

  // A reply that resets the form sets the fields back to their default values,
  // which the browser keeps in their attributes.
  $effect(() => {
    if (result?.reset) {
      (document.getElementById(id) as HTMLFormElement | null)?.reset();
    }
  });

  return { result, fields, errors, attrs: { id }, defaultSubmit: DEFAULT_SUBMIT };
}
