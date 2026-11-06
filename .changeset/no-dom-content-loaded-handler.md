---
'brumate': patch
---

`<document onDOMContentLoaded>` is a compile error ([BRM201](https://brumate-docs.vercel.app/docs/errors#brm201)). The compiler lower-cased the name, so the handler listened to `domcontentloaded`, which the browser never fires, and page code loads after the HTML. The same holds for the `webkit*` animation and transition names, the `DOM*` mutation events and `DOMMouseScroll`; the error names what to write instead, such as `$client(fn, 'load')` or `onAnimationEnd`.
