---
name: props-table
version: 1
status: frozen
defined_by: docs-generator
---

# Contract: props-table

## Purpose

The format of the generated and written tables on a page of website/ui, so the four docs nodes write the same sections.

## Interface

### The line of the props table

A page writes the props table of a part as an empty code block with the info string `props` and the name of the part:

````md
```props Button
```
````

The name is the file of the part in packages/ui/src without `.brm`. The generator reads the module script of that file (the part-props contract), so the table follows the exported type. A part that has `as` is read from `<Name>OwnProps`, and any other part from `<Name>Props`. The block is replaced by the table, as `brm demo` is replaced by a demo.

### The sections of a page

Every section is an `##` heading, in this order. A page leaves out a section that has nothing to say, and never reorders them.

1. The title (`#`), then a sentence on what the part is, then its demo (`brm demo Name`). No heading for these.
2. `## Anatomy`: the parts that the page covers, nested. Left out for a single part.
3. `## Props`: one `props` block. A page with several parts has an `###` heading with the name of each part, and one block under it.
4. `## Data attributes`: the data attribute table.
5. `## Keyboard`: the keyboard table.
6. `## Controlled and uncontrolled`: prose. Which props hold the state (`isOpen`, `value`), which one starts it (`defaultValue`), and the change handler. Left out for a part with no state.
7. `## Styling`: prose. The data attributes and CSS custom properties to style, and the classes. A part with a section for styling links to [Styling](../../website/ui/styling.md) instead of repeating it.

Other sections (`## In other parts`, and so on) come after these.

### The props table

The generated table has four columns and one row for each prop, in the order of the type:

| Prop   | Type                  | Default    | Description      |
| ------ | --------------------- | ---------- | ---------------- |
| `name` | The type, as written. | See below. | The doc comment. |

- Prop: the name, in code. A prop that the type does not mark optional gets `required` in the Default column.
- Type: the source of the annotation, with each run of white space as one space. `T` stays `T`.
- Default: the source of the default in the destructuring of `$props`, such as `'button'` or `false`. Empty when there is none.
- Description: the doc comment of the prop, as one paragraph. A backtick pair in it becomes code. Empty when there is no comment, and a page for a part with a prop with no comment is not complete.
- `as` is one row, first. Its type is `AsTarget` and its default is the default of the type parameter `T` of the part. Its description is "Renders another element or a component. The other props are those of the target." The generator never lists the props of the target.
- A member without a name (`[attribute: string]: unknown`) gets no row.

Example, for `Button`:

| Prop        | Type                              | Default    | Description                                                                          |
| ----------- | --------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `as`        | `AsTarget`                        | `'button'` | Renders another element or a component. The other props are those of the target.     |
| `type`      | `'button' \| 'submit' \| 'reset'` | `'button'` |                                                                                      |
| `isPending` | `boolean`                         |            | Pending: the button keeps its focus and presses nothing, such as while a form sends. |
| `onPress`   | `(event: PressEvent) => void`     |            |                                                                                      |

### The anatomy

An `html` code block (which the site highlights as `.brm`) with the tags of the parts, nested as a caller nests them. A part with no children is `<Name />`, and a part with children closes with `</>`. The only attribute is one that places the part, such as `slot="close"`. No other props, no text.

````md
## Anatomy

```html
<DialogTrigger>
  <Button />
  <Modal>
    <Dialog>
      <Heading slot="title" />
      <Button slot="close" />
    </>
  </>
</>
```
````

A line after the block says what is optional, in one sentence.

### The data attribute table

A Markdown table with two columns, `Attribute` and `When`. One row for each attribute, in the order the part sets them, grouped by part when the page has several (an `###` heading under `## Data attributes` for each).

- Attribute: the name in code, such as `data-pressed`. A value gets its form: `data-orientation="horizontal"`.
- When: one sentence that starts with a capital and ends with a period. It says when the attribute is present, in terms of what the user does or the state of the part.

```md
## Data attributes

| Attribute       | When                              |
| --------------- | --------------------------------- |
| `data-pressed`  | A pointer or a key holds it down. |
| `data-disabled` | It is disabled.                   |
```

### The keyboard table

A Markdown table with two columns, `Key` and `Action`. One row for each key or combination, in the order of the reader's path: Tab first, then the keys of the part.

- Key: the value of `KeyboardEvent.key` in code (`Enter`, `Space`, `Escape`, `ArrowDown`, `Home`). A combination joins the keys with `+` (`Shift + Tab`). Keys that do the same are in one cell, joined by `or` (`Enter` or `Space`).
- Action: one sentence in the present tense, with a capital and a period, from the point of view of the part (`Presses the button.`).

```md
## Keyboard

| Key                | Action                                    |
| ------------------ | ----------------------------------------- |
| `Tab`              | Moves focus to the button.                |
| `Enter` or `Space` | Presses the button. Space never scrolls the page. |
```

## Behavior

- A prop's description is its doc comment. Its default comes from the destructuring of `$props`.
- A part whose type cannot be read, or that has no exported type of that name, is an error of the build with the name of the part. The generator never prints an empty table.
- The table is HTML in the page, so it adds no code to the client.
- The anatomy, data attribute and keyboard tables are written by hand. Only the props table is generated.

## Stub

None. The generator is website/plugins/props-table.ts, and the button page (website/ui/button.md) is the reference.

## Contract tests

website/test/props-table.test.ts reads the rows of Button and checks them against `ButtonOwnProps`, and checks that the button page keeps the order of the sections.

## Changes

- v1: frozen by docs-generator.
