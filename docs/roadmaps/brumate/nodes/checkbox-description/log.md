# Log

- Chose slots (Text slot="description" and FieldError in the children), as CheckboxGroup does, over a pass-through: one way for all field parts, and the IDs stay owned by the part.
- $setContext must be at the top level, so a grouped Checkbox re-sets the group's contexts unchanged.
- Switch had no isInvalid; added it with aria-invalid and data-invalid so the error has a state to follow.
