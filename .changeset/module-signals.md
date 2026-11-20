---
'brumate': minor
---

`$signal` and `$memo` work at the top level of a `.brm.ts` module and of `<script module>`. They give one shared value per module, which components read like their own signals and write only through functions that the module exports (a `<script module>` signal can also be written by the script of its own file). A signal compiles to `store()` and a memo to `derived()` of `brumate/store`, so nothing is added to the runtime. A write through an import is BRM117 with advice, a top-level form that cannot compile is BRM211, and `brumate check` reports a module signal that a plain `.ts` file imports as BRM208.
