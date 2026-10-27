# TokenField

A field of text with tokens in it, such as mentions, tags or commands, which the user types and the field turns into tokens.

```brm demo TokenFieldDemo

```

```html
<TokenField pattern="[#@]\S+" placeholder="Write a message" value=$bind(message)>
  <Label>Message</Label>
  <TokenInput token=chip />
  <Text slot="description">Type a @name or a #tag, then a space.</Text>
</TokenField>

#template chip(segment) {
  <Token>{segment.text}</Token>
}
```

- A `TokenField` holds a `Label`, a `TokenInput` and a `Text` with `slot="description"`. The input is named by the label and described by the text.
- `value` is an array of segments, each `{ type: 'text' | 'token', text }`, which the page state holds. A class could not be held by the page state, so the value is the array of its segments.
- `pattern` is a regular expression, as a string. Text that matches it becomes a token once a space follows it, so a word that the user is still typing stays text.
- `token` is a `#template` that renders a `Token` for each token. Without it, a token is a Token with its text.
- With `name`, a form sends the text of the value, with each token as its text.
- `role` is `textbox`, or `searchbox` for a field that searches. The box has no popup, so it is never a `combobox`.

## Anatomy

```html
<TokenField>
  <Label />
  <TokenInput>
    <Token />
  </>
  <Text slot="description" />
</>
```

The `Token` is rendered by the `token` template for each token. The `Label` and the `Text` are optional.

## Props

### TokenField

```props TokenField

```

### TokenInput

```props TokenInput

```

### Token

```props Token

```

## Data attributes

### TokenField

| Attribute       | When                    |
| --------------- | ----------------------- |
| `data-disabled` | The field is disabled.  |
| `data-readonly` | The field is read only. |

### TokenInput

| Attribute            | When                                 |
| -------------------- | ------------------------------------ |
| `data-focused`       | It has focus.                        |
| `data-focus-visible` | Its focus shows as a ring.           |
| `data-disabled`      | The field is disabled.               |
| `data-readonly`      | The field is read only.              |
| `data-empty`         | The field has no segments.           |
| `data-placeholder`   | Holds the placeholder text, for CSS. |

### Token

| Attribute       | When                            |
| --------------- | ------------------------------- |
| `data-selected` | The selection covers the token. |
| `data-disabled` | The field is disabled.          |

## Keyboard

The browser edits the text of the box, so its usual keys work. These are the keys that the field changes.

| Key         | Action                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| `Tab`       | Moves focus to the box.                                                 |
| `Backspace` | Removes the token before the caret whole, as one piece.                 |
| `Enter`     | Adds a new line when the field has `allowsNewlines`, else does nothing. |

## Controlled and uncontrolled

`value` holds the segments. `value=([...])` starts the field's own value, and `value=$bind(signal)` writes your signal. `onChange` gets the segments each time they change. See [State](./state.md).

## Styling

Style the box with the data attributes above, and show the placeholder from `data-placeholder` with `[data-empty]::before`. See [Styling](./styling.md).

## Editing

- The TokenInput is an element with `contenteditable`, which the browser edits. It reads its text back into the value, and writes itself again when tokens change, with the caret where it was.
- A token is one piece. The caret goes past it, and Backspace removes it whole.
- Enter adds a new line only with `allowsNewlines`, and a paste adds its text without its markup.
