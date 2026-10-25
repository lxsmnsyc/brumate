# @brumate/ui

Accessible, unstyled components for brumate. They follow the behaviour and the composition of [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html), and the API of [Terracotta](https://github.com/lxsmnsyc/terracotta). The plan is in [Headless UI components](../../docs/proposals.md#headless-ui-components).

The package is private while its first phase is built.

- The parts render markup, ARIA attributes and `data-*` state, and no CSS of their own, except what a part needs to work, such as the styles that hide the content of `VisuallyHidden`.
- A part uses a feature of the platform only when at least 95% of global usage supports it.
- Each part has a `.stories.ts` file for the workbench of the dev server, at `/__brumate/workbench`.

## Parts

- `VisuallyHidden`: hides its content from sight and keeps it for screen readers.
