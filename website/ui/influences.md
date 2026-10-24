# Design influences

The parts take their ideas from the projects below. Each one decided some of what the parts do, and how you use them.

## React Aria

[React Aria](https://react-spectrum.adobe.com/react-aria/) by Adobe is the reference for behavior. Its components and their tests decide how a part responds to a pointer, a key and a screen reader:

- Press handling that is the same for a mouse, a touch, a pen, a key and a screen reader, with `onPressStart`, `onPressEnd` and `onPress`.
- Hover that ignores touch, and a focus ring that shows only for the keyboard.
- Parts that hold other parts and give them their IDs and state through contexts, with `slot` to tell parts of one type apart.
- State as `data-*` attributes, and the names of props, such as `isDisabled` and `isSelected`.
- The direction of a locale from its script.

Where a part behaves differently, it is because of how brumate runs a page. See [How the parts resume](./resuming.md).

## Terracotta

[Terracotta](https://github.com/lxsmnsyc/terracotta), headless components for SolidJS, is where the API comes from:

- An `as` prop on every part, so it can render another element.
- Render props, here as a `#template` prop, so your markup reads the state of a part.
- The split between state that a part keeps and state that you keep. Here it is one prop, which a value starts and `$bind` controls. See [State](./state.md).
- `Transition` and `TransitionChild` of Terracotta 2.x: the class props of each step, waits that read the running animations of the element, `inert` while content leaves, and children that enter after their parent and leave before it.

## WAI-ARIA Authoring Practices

The [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) decide the roles, the states and the keys of each pattern, such as the roving tabindex of a toolbar and the arrow keys of a radio group.

## Headless UI

[Headless UI](https://headlessui.com/) names the states of a transition as `data-closed`, `data-enter` and `data-leave`, so CSS can animate without a list of classes.

## The platform

A part uses a native element where the browser has one, such as `<button>`, `<a>`, `<input type="checkbox">` and `<form>`. It works without scripts, a screen reader knows it, and a form posts it. A part uses a feature of the platform only when at least 95% of global usage supports it.
