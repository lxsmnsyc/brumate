# Dates, times and colors

## Date values

A date is a `YYYY-MM-DD` string, or `null` until every segment is set. A time is a string such as `13:45`. Parts hold strings, never `Date` objects, so the state is plain data and renders on the server. `DateField`, `TimeField`, `Calendar`, `DatePicker` and the range parts compare and format with the locale (see [i18n.md](i18n.md)).

- `minValue`, `maxValue` and `isDateUnavailable` (a function from a date string to a boolean) limit the choice.
- `value` and `onChange` follow the usual shapes: `null` when a segment is emptied.
- `name` posts the value with a form from a hidden input, also before the code loads.

## DateField

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import DateField from '@brumate/ui/DateField.brm';
  import DateInput from '@brumate/ui/DateInput.brm';
  import FieldError from '@brumate/ui/FieldError.brm';
  import Label from '@brumate/ui/Label.brm';
  import Text from '@brumate/ui/Text.brm';

  let birthday = $signal<string | null>(null);
</script>

<DateField name="birthday" value=$bind(birthday)>
  <Label>Birthday</Label>
  <DateInput />
  <Text slot="description">Type it, or use the arrow keys.</Text>
  <FieldError />
</DateField>
```

`TimeField` has the same shape.

## Calendar

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import Calendar from '@brumate/ui/Calendar.brm';
  import CalendarGrid from '@brumate/ui/CalendarGrid.brm';
  import CalendarHeading from '@brumate/ui/CalendarHeading.brm';

  let date = $signal<string | null>(null);

  function weekend(value: string) {
    return [0, 6].includes(new Date(`${value}T00:00:00Z`).getUTCDay());
  }
</script>

<Calendar aria-label="Delivery date" value=$bind(date) isDateUnavailable=weekend>
  <header>
    <Button slot="previous">‹</Button>
    <CalendarHeading />
    <Button slot="next">›</Button>
  </header>
  <CalendarGrid />
</Calendar>
```

- `Calendar` needs `aria-label`. `onChange` gets each date that is picked, and `onFocusChange` each date that gets focus.
- `RangeCalendar` and `DateRangePicker` hold a start and an end.

## DatePicker

A `DateField` with a button that opens a `Calendar` in a `Popover` with a `Dialog`.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import Calendar from '@brumate/ui/Calendar.brm';
  import CalendarGrid from '@brumate/ui/CalendarGrid.brm';
  import CalendarHeading from '@brumate/ui/CalendarHeading.brm';
  import DateInput from '@brumate/ui/DateInput.brm';
  import DatePicker from '@brumate/ui/DatePicker.brm';
  import Dialog from '@brumate/ui/Dialog.brm';
  import Group from '@brumate/ui/Group.brm';
  import Label from '@brumate/ui/Label.brm';
  import Popover from '@brumate/ui/Popover.brm';

  let departure = $signal<string | null>(null);
</script>

<DatePicker value=$bind(departure)>
  <Label>Departure</Label>
  <Group>
    <DateInput />
    <Button aria-label="Calendar">▾</Button>
  </Group>
  <Popover>
    <Dialog>
      <Calendar>
        <header>
          <Button slot="previous">‹</Button>
          <CalendarHeading />
          <Button slot="next">›</Button>
        </header>
        <CalendarGrid />
      </Calendar>
    </Dialog>
  </Popover>
</DatePicker>
```

## Colors

A color is a string of CSS, such as `#e2445a` or `hsl(210, 50%, 40%)`. The value keeps the format it was given. An edit makes `value` and `onChange` change only when it makes another color.

- `ColorField` edits hex, or one `channel` (`hue`, `saturation`, `lightness`, `brightness`, `red`, `green`, `blue`, `alpha`) with `colorSpace` (`rgb`, `hsl`, `hsb`). `value` is `null` when it is empty.
- `ColorSlider` adjusts one `channel`. `ColorArea` adjusts two (`xChannel` and `yChannel`). `ColorWheel` adjusts the hue. Each holds a `ColorThumb`.
- `ColorSwatch` shows a color, and `ColorSwatchPicker` with `ColorSwatchPickerItem` picks one from a list.
- `ColorPicker` holds one color for the parts inside it. It renders no element.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import ColorArea from '@brumate/ui/ColorArea.brm';
  import ColorField from '@brumate/ui/ColorField.brm';
  import ColorPicker from '@brumate/ui/ColorPicker.brm';
  import ColorSwatch from '@brumate/ui/ColorSwatch.brm';
  import ColorThumb from '@brumate/ui/ColorThumb.brm';
  import Input from '@brumate/ui/Input.brm';
  import Label from '@brumate/ui/Label.brm';

  let color = $signal('hsb(210, 80%, 90%)');
</script>

<ColorPicker value=$bind(color)>
  <ColorArea xChannel="saturation" yChannel="brightness" aria-label="Saturation and brightness">
    <ColorThumb />
  </ColorArea>
  <ColorField>
    <Label>Hex</Label>
    <Input />
  </ColorField>
  <ColorSwatch />
</ColorPicker>
<p>The color is {color}.</p>
```

- A part inside a picker shows the picker's color and writes it. A part with a `value` of its own keeps it.
- A `ColorSlider` or `ColorArea` without a `Label` needs `aria-label` (a slider falls back to the channel name).
