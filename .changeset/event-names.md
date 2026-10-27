---
'brumate': patch
'@brumate/ui': patch
---

A handler in markup takes its event type from `ElementEvents` of `brumate/elements`, so a custom event that an app merges in reaches the handler. An event name that no element fires, such as `onDoubleClick` or `onFooBar`, is now a type error at the attribute. `@brumate/ui` declares its `toastchange` event.
