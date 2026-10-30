# Introduction

Accessible, unstyled components for brumate. They resume like the rest of a brumate page: the server renders them, and the browser keeps their state. See [the cards of the parts](./index.md#parts) for a preview of each one.

## What the parts give you

- Markup with the right roles and ARIA attributes, and native elements where the browser has them, such as `<button>`, `<input type="checkbox">` and `<a>`.
- Keyboard, pointer and screen reader behavior, the same for a mouse, a touch, a key and a screen reader.
- State as `data-*` attributes, such as `data-pressed` and `data-selected`, for your CSS.
- No styles. The demos on these pages use the style of this site. See [Styling](./styling.md).

## Use a part

Import a part from `@brumate/ui`, and use it as any component:

```html
<script>
  import Button from '@brumate/ui/Button.brm';
  import { $signal } from 'brumate/signals';

  let count = $signal(0);
</script>

<Button class="button" onPress=(() => count++)>Pressed {count} times</Button>
```

- The page renders on the server, with the markup of the part.
- The code of the part and of your handler comes with the page, so the first press needs no request.
- Without scripts, a native element still works: a link follows, a box checks, and a form posts.

> [!NOTE]
> `@brumate/ui` is in the brumate repository, and is not published yet.

## A skill for agents

The package ships a skill in the Agent Skills format, for agents that write pages with the parts. Copy it into the skills of your project:

```sh
cp -r node_modules/@brumate/ui/skills/brumate-ui .claude/skills/
```

## How the parts work together

A part that holds other parts gives them their IDs and state through a context. A `TextField` names its `Label`, `Input` and `FieldError` for each other:

```html
<TextField name="email" type="email" isRequired>
  <Label>Email</Label>
  <Input />
  <Text slot="description">We send the receipt here.</Text>
  <FieldError />
</TextField>
```

- `slot` picks between parts of one type, such as `Text slot="description"`.
- State such as `isSelected` or `value` is one prop. A value starts the part's own copy, and `$bind` writes yours. See [State](./state.md).

## Browser support

A part uses a feature of the platform only when at least 95% of global usage supports it. So the parts use `inert`, `:focus-visible` and `checkVisibility()`, and not the Popover API, `@starting-style` or CSS anchor positioning.
