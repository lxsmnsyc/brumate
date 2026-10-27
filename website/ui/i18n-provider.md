# I18nProvider

Gives the parts inside it a locale and its direction.

```brm demo I18nProviderDemo

```

- `locale` is a language tag, such as `ar-EG`. The default is `en-US`, so the server and the browser format numbers the same way.
- The direction comes from the script of the locale. A [Toolbar](./toolbar.md) turns its arrow keys around right to left, and a [Popover](./popover.md#placement) reads `start` and `end` in it.
- `timeZone` is an IANA time zone, such as `Asia/Tokyo`. It decides what today is in the date parts. Without it, the server uses its own time zone for the first render and the browser takes its own after that.
- `strings` replaces the words of the date parts with a whole set, in one prop. See [Date strings](#date-strings).
- It renders only its children. Put `lang` and `dir` on an element yourself, such as `<html>`.

## Date strings

The date parts read their words from the locale: the placeholders of the segments, the names of the segments for screen readers, and the labels of the Calendar and the DatePicker. English, German, French, Spanish, Japanese and Chinese have a table. Another language shows English words in the order and with the numbers of its locale.

The server looks up the table once and writes only that language into the page, so the browser never loads the other languages. To use your own words, pass the whole set as `strings`. Start from `stringsOf` to change a few:

```html
<script>
  import { stringsOf } from '@brumate/ui/date-strings.ts';

  const strings = { ...stringsOf('de-DE'), previous: 'Früher', next: 'Später' };
</script>

<I18nProvider locale="de-DE" {strings}>…</I18nProvider>
```

| Key              | Words for                                                  |
| ---------------- | ---------------------------------------------------------- |
| `placeholders`   | `year`, `month` and `day` when they are not set.           |
| `segmentNames`   | The name of each segment for screen readers.               |
| `empty`          | The spoken value of a segment that is not set.             |
| `previous`       | The Button that shows earlier months.                      |
| `next`           | The Button that shows later months.                        |
| `calendar`       | The Button of a DatePicker that opens the Calendar.        |
| `today`          | The start of the label of today's cell.                    |
| `selected`       | The end of the label of a selected cell.                   |
| `firstAvailable` | The end of the label of the first date that can be picked. |
| `lastAvailable`  | The end of the label of the last date that can be picked.  |

## Props

```props I18nProvider

```

## Styling

An `I18nProvider` renders no element, so it has nothing to style. Put `lang` and `dir` on an element yourself.
