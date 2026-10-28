# Outcome: ui-docs-pages-forms

## Built

Five of the ten Forms pages: Checkbox, Switch, CheckboxGroup, RadioGroup and Form. The node stays `active` for the other five.

| Page          | Anatomy                                      | Use cases                                                      | Styled                                       | Controlled and uncontrolled                                 |
| ------------- | -------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| Checkbox      | skipped, one element                         | consent in a sign-up form, select all                          | CheckboxStyled                               | CheckboxStateDemo, four shapes and a form reset             |
| Switch        | skipped, one element                         | a settings panel, a switch that saves                          | SwitchStyled                                 | SwitchStateDemo, four shapes and a form reset               |
| CheckboxGroup | CheckboxGroupAnatomy                         | a filter bar, a limit of choices                               | CheckboxGroupStyled (chips, required, error) | CheckboxGroupStateDemo, four shapes and a form reset        |
| RadioGroup    | RadioGroupAnatomy                            | a plan and a number of seats, a required choice in a form      | RadioGroupStyled (cards)                     | RadioGroupStateDemo, four shapes and a form reset           |
| Form          | FormAnatomy (Input marked through a wrapper) | a sign-up form with validation, a filter bar, a settings panel | FormStyled                                   | no state of its own; says so, links to State and Form reset |

- The state demos use two signals, one for "writes your signal" and one for "asks you first", so Lock and Reset show a refused write on its own.
- The sign-up form uses native validation (`isRequired`, `type="email"`, `minLength`, `validate` for the repeated password), a server error through `validationErrors`, and a pending submit Button. Its handler starts with `if (saving) return`. The page says that a pending Button is `type="button"`, that a form of one text field can send again on Enter, and that Chrome sends no implicit submit from a form of several fields with no submit button. It does not claim that the part prevents a second submit. When #330 (pending-submit) lands, update form.md, FormSignupDemo, FormStyled and this file.
- Form reset is described as state.md does. These five pages make no claim about NumberField.
- Checkbox and Switch: the pages do not mention a `form` prop.
- Colors are in `light-dark()` and system colors. The styled demos draw their focus ring as two bands. They set `outline: none` where the site's global `[data-focus-visible]` outline would draw a third one. No change to website/src/routes/ui/_layout.brm.
- e2e/suites/website.mjs: one flow for the five pages in both schemes (styled CSS shows, callouts equal the listed pieces, axe finds nothing).

## Deviations

- The brief lists ten pages. Five are left (below), since 24 demos for five pages is one review.
- Checkbox and Switch have no anatomy picture: one element, no pieces (the same call as Button in #326).

## Found in Chrome, not fixed here

- A refused write on a Checkbox, a Switch, a CheckboxGroup or a RadioGroup (a `$bind` request that ignores the new value) draws the kept value, but the hidden input of the clicked box or radio keeps the browser's new state until the next reset. A form would post it. Checked on the state demos and on the limit demo. The four pages say so. This is the same family as `ui-refused-write-sync`, for clicks and not for resets. The node `ui-refused-write-sync` (#332) fixes it.
- A pending submit Button is `type="button"` (see ui-docs-pages-controls). The node `pending-submit` is on main.

- A standalone Checkbox and a Switch do not tie a description or an error to their input: only a CheckboxGroup gives `describedBy`. The consent demo shows its note as plain text. The node `checkbox-description` adds it.

## Stubs left

- The five pages of Forms: text-field, search-field, token-field, number-field, slider.
