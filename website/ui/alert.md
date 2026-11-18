---
summary: A message that a screen reader announces as it appears.
---

# Alert

A message that a screen reader announces as it appears, such as a banner for a failed save.

```brm demo AlertDemo

```

- It is a `<div role="alert">` with no state. A screen reader reads it when it enters the page.
- `role="alert"` makes it an assertive live region, with `aria-atomic="true"`, so a screen reader reads all of its text when the text changes or when it enters the page. Readers differ on a live region that is empty when the page loads and filled later, so render the `Alert` with `#if` only while there is a message.
- To announce the same message twice, wrap it in `#key (value)` with a value that changes: the old one leaves and a new one enters, which a reader announces even when the text is the same. In the demo, each press of Save announces again.
- `as` changes the element, such as `as="p"`. Other props, such as `aria-live`, go to it.

## Anatomy

An `Alert` is one element, so this page has no anatomy picture.

```brm
<Alert />
```

## Props

```props Alert

```

## Data attributes

An `Alert` sets no data attribute.

## Keyboard

An `Alert` takes no focus and no keys. It is announced where it is, without moving focus. For a message that people must answer, use a [Dialog](./dialog.md) with `role="alertdialog"`.

## Controlled and uncontrolled

An `Alert` has no state, so this page has no controlled and uncontrolled shapes. Whether it exists is your state: render it with `#if`. See [State](./state.md) for the parts that have state.

## Styling

Style it with a class. It has no data attribute. See [Styling](./styling.md). It has no stylesheet sample of its own, since it is a plain element.

## Use cases

### A banner for a failed save

Show the `Alert` inside the form, near the button that failed, and remove it when the problem is gone, as the demo above does. A field's message belongs in a [FieldError](./text-field.md), which is tied to the field. A notice that goes by itself belongs in a [Toast](./toast.md).
