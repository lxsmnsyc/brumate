# ProgressBar

The progress of a task.

```brm demo ProgressBarDemo

```

- It takes the props of a [Meter](./meter.md): `value`, `minValue`, `maxValue`, `formatOptions` and `valueLabel`.
- `isIndeterminate` is a task of no known length. It has no value, and shows `data-indeterminate`.
- It sets `--percentage` for CSS. See [Styling](./styling.md#bars).

## Anatomy

```html
<ProgressBar>
  <Label />
</>
```

The `Label` is optional. Without one, name the bar with `aria-label`.

## Props

```props ProgressBar

```

## Data attributes

| Attribute            | When                      |
| -------------------- | ------------------------- |
| `data-indeterminate` | It has `isIndeterminate`. |

## Styling

Draw the bar with `--percentage`, from `0%` to `100%`, or with the `content` template. An indeterminate bar sets no `--percentage`, so style it by `[data-indeterminate]`. See [Styling](./styling.md#bars).
