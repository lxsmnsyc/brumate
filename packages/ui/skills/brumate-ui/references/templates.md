# Templates as render props

A prop that renders markup is a `#template`. Markup is never a value in code or in an attribute, so a part cannot take `item=(<ListBoxItem />)`. Name a template in the page and pass its name.

## `items` and `item`

`ListBox`, `GridList`, `Tree`, `Table` (through its `TableBody`) and `NavigationTree` take `items`, each with an `id`, and an `item` template that renders one row for each.

```brm
<script>
  import ListBox from '@brumate/ui/ListBox.brm';
  import ListBoxItem from '@brumate/ui/ListBoxItem.brm';

  interface Animal {
    id: string;
    name: string;
  }

  const animals: Animal[] = [
    { id: 'cat', name: 'Cat' },
    { id: 'dog', name: 'Dog' },
  ];
</script>

<ListBox aria-label="Animals" items=animals item=animal />

#template animal(animal: Animal) {
  <ListBoxItem id=(animal.id) textValue=(animal.name)>{animal.name}</ListBoxItem>
}
```

- The template is named without a call: `item=animal`. It gets one parameter, the item.
- The parts are generic in the item type `V`. A template that is passed to a prop takes its type from the prop. A template of a `TableBody` or a `ToastRegion` needs the annotation, as above.
- `textValue` is the text for typing and for the name of the item. Set it when the content is more than text.
- With `rowHeight`, or inside a `Virtualizer`, a long list renders only the items in view.
- A `Tree` takes items with `children`, and its template renders a `TreeItem`:

```brm
<script>
  import Tree from '@brumate/ui/Tree.brm';
  import TreeItem from '@brumate/ui/TreeItem.brm';
  import Button from '@brumate/ui/Button.brm';

  interface File {
    id: string;
    name: string;
    children?: File[];
  }

  const files: File[] = [
    { id: 'docs', name: 'Documents', children: [{ id: 'cv', name: 'cv.pdf' }] },
    { id: 'notes', name: 'notes.txt' },
  ];
</script>

<Tree aria-label="Files" items=files item=file />

#template file(file: File) {
  <TreeItem textValue=(file.name)>
    #if (file.children) {
      <Button slot="chevron">&gt;</Button>
    }
    {file.name}
  </TreeItem>
}
```

## `SelectValue render`

`SelectValue` shows the text of the choice once the code loads. `render` is a template that gets `selectedKey`, `selectedText` and `isPlaceholder`, so the server renders the text too.

```brm
<script>
  import { $bind, $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';
  import Label from '@brumate/ui/Label.brm';
  import ListBox from '@brumate/ui/ListBox.brm';
  import ListBoxItem from '@brumate/ui/ListBoxItem.brm';
  import Popover from '@brumate/ui/Popover.brm';
  import Select from '@brumate/ui/Select.brm';
  import SelectValue from '@brumate/ui/SelectValue.brm';
  import type { Key } from '@brumate/ui/collection.ts';

  const sizes = [
    { id: 's', name: 'Small' },
    { id: 'm', name: 'Medium' },
  ];
  let size = $signal<Key | null>('m');
</script>

<Select selectedKey=$bind(size)>
  <Label>Size</Label>
  <Button><SelectValue render=sizeName /></Button>
  <Popover>
    <ListBox>
      #for (item of sizes by item.id) {
        <ListBoxItem id=(item.id)>{item.name}</ListBoxItem>
      }
    </ListBox>
  </Popover>
</Select>

#template sizeName(state: { selectedKey: Key | null }) {
  {sizes.find((item) => item.id === state.selectedKey)?.name ?? 'None'}
}
```

## Toasts

`ToastRegion` renders the toasts of a named queue. `toast` is a template that gets each toast, with its `key` and `content`. The region does not know the content type, so annotate the parameter with `QueuedToast<T>`. Any handler adds a toast to the queue.

```brm
<script>
  import Button from '@brumate/ui/Button.brm';
  import Text from '@brumate/ui/Text.brm';
  import Toast from '@brumate/ui/Toast.brm';
  import ToastContent from '@brumate/ui/ToastContent.brm';
  import ToastRegion from '@brumate/ui/ToastRegion.brm';
  import { toastQueue } from '@brumate/ui/toast.ts';
  import type { QueuedToast } from '@brumate/ui/toast.ts';

  interface Notice {
    title: string;
    description: string;
  }

  function save() {
    toastQueue<Notice>('app').add({ title: 'Saved', description: 'Draft is safe.' }, { timeout: 5000 });
  }
</script>

<Button onPress=save>Save</Button>
<ToastRegion queue="app" toast=notice transition />

#template notice(toast: QueuedToast<Notice>) {
  <Toast {toast}>
    <ToastContent>
      <Text slot="title">{toast.content.title}</Text>
      <Text slot="description">{toast.content.description}</Text>
    </ToastContent>
    <Button slot="close">Close</Button>
  </Toast>
}
```

## Markup is not a value

A part cannot take markup in an attribute. This fails:

```brm wrong: Expected ")"
<script>
  import Button from '@brumate/ui/Button.brm';
  import ListBox from '@brumate/ui/ListBox.brm';

  const animals = [{ id: 'cat' }];
</script>

<ListBox items=animals item=(<Button>x</Button>) />
```

Declare `#template name(item) { … }` and pass `item=name`.

## Rules

- A template is declared at the top level of the file with `#template name(parameter) { … }`, and used by its name.
- A template renders in the browser from the part's code, so it can read the page's signals.
- A `#for` inside a part needs a key: `by item.id`.
