# Outcome: ui-docs-pages-controls

## Built

The Buttons group, six of the sixteen pages of the node: Button, ToggleButton, ToggleButtonGroup, Link, FileTrigger and DropZone. The pages of Forms (TextField, SearchField, TokenField, NumberField, Slider, Checkbox, CheckboxGroup, RadioGroup, Switch, Form) are not done. The node stays `active` for them.

The PR stops here because each page needs a styled example, two use cases and often a state demo, which is 22 demos for six pages. The Forms pages also depend on the reset code of ui-form-reset, which is not on main yet.

| Page | Anatomy | Use cases | Styled | Controlled and uncontrolled |
| --- | --- | --- | --- | --- |
| Button | skipped, one element | pending save in a form, buttons in a toolbar | ButtonStyled | skipped, no state; says so and links to State |
| ToggleButton | skipped, one element | filters, formatting toolbar | ToggleButtonStyled | live demo of the four shapes |
| ToggleButtonGroup | ToggleButtonGroupAnatomy | view switch, multiple filters | ToggleButtonGroupStyled (segmented control) | live demo of the four shapes |
| Link | skipped, one element | navigation, link in a sentence and one without `href` | LinkStyled | skipped, no state |
| FileTrigger | skipped, draws no element | list of files, photo with preview | FileTriggerStyled | skipped, keeps no value; `onSelect` explained |
| DropZone | DropZoneAnatomy (FileTrigger has no number, and the page says so) | images only with `getDropOperation`, text snippets | DropZoneStyled | skipped, keeps no value; callbacks explained |

- Every claim was read against packages/ui/src. Reset: ToggleButton and ToggleButtonGroup have no reset handler on main, and the pages say so and link to state.md. Rewrite when ui-form-reset lands, if it changes them.
- One e2e flow in e2e/suites/website.mjs covers the six pages in both schemes: the styled CSS shows, the callouts equal the listed pieces, and axe finds nothing.
- Colors use `light-dark()`. No change to website/src/routes/ui/_layout.brm.

## Deviations

- The brief asked for about sixteen pages. Ten are left.
- The screenshots are of Button, ToggleButtonGroup and DropZone, not TextField and Checkbox, which are not done.

## Stubs left

- The ten pages of Forms: text-field, search-field, token-field, number-field, slider, checkbox, checkbox-group, radio-group, switch, form.
