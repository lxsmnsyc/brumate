---
'brumate': minor
---

`$signal`, `$memo`, `$gate`, `$debounced`, `$throttled`, `$optimistic` and `$untrack` work at the top level of a `.brm.ts` module and of `<script module>`. They give one shared value per module, which components read like their own values and write only through functions that the module exports (a `<script module>` signal or optimistic value can also be written by the script of its own file). A signal compiles to a store, a memo, a gate and a debounced or throttled value to stores of `brumate/store`, and an optimistic value to a store of `brumate/client`, so a module that uses none of them adds nothing to the page.

A throw in a module memo, gate or debounced or throttled value is held, as in a component: the write that caused it does not throw, the other values of the change still update, and each read of the value throws the error to the nearest `#try` of the component that reads it. `derived` of `brumate/store` is unchanged.

A debounced or throttled module value is pending while it waits, so `$isPending` and `$resolve` of a component work on it, and `$resolve` takes the names that a component imports from a module as signals or memos.

A module memo takes the values of a component memo: a promise, `await` and an async iterable. It loads once for every reader, one load per change of the module signals that it reads, and the server requests share that load. A component reads an imported memo as a memo of its own, so `#loading`, `await`, `$isPending`, `$resolve`, `#try` and BRM182 work on it. The page state carries the values of the signals that the memo reads, and the browser loads again only when its own values differ.

The forms of a module that a component form also has keep its errors and codes (BRM085 to BRM092, BRM120, BRM161, BRM202 and BRM203). A form that a module cannot compile, such as `$effect`, `$client`, a form that needs a component, `await` in a gate or a timed value, or a source of `$optimistic` that is no memo of a module, is BRM211. A write through an import is BRM117 with advice, and `brumate check` reports a module signal that a plain `.ts` file imports as BRM208.
