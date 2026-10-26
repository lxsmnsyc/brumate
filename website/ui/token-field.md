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

#template chip(segment: TokenSegment) {
  <Token>{segment.text}</Token>
}
```

- A `TokenField` holds a `Label`, a `TokenInput` and a `Text` with `slot="description"`. The input is named by the label and described by the text.
- `value` is an array of segments, each `{ type: 'text' | 'token', text }`, which the page state holds. `onChange` hears of changes. React Aria's `TokenFieldValue` is a class, which the page state cannot hold, so the value is the array of its segments.
- `pattern` is a regular expression, as a string. Text that matches it becomes a token once a space follows it, so a word that the user is still typing stays text.
- `token` is a `#template` that renders a `Token` for each token. Without it, a token is a Token with its text.
- With `name`, a form sends the text of the value, with each token as its text.
- `placeholder`, `allowsNewlines`, `isDisabled` and `isReadOnly`. `role` is `textbox`, or `searchbox` for a field that searches. The box has no popup, so it is never a `combobox`.

## Editing

- The TokenInput is an element with `contenteditable`, which the browser edits. It reads its text back into the value, and writes itself again when tokens change, with the caret where it was.
- A token is one piece. The caret goes past it, and Backspace removes it whole.
- Enter adds a new line only with `allowsNewlines`, and a paste adds its text without its markup.
- The TokenInput shows `data-focused`, `data-focus-visible`, `data-disabled`, `data-readonly` and `data-empty`, with the placeholder in `data-placeholder`, for CSS. A Token shows `data-selected` while the selection covers it, and `data-disabled`.
