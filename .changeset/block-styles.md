---
'brumate': minor
'@brumate/language-core': minor
---

- A `<style>` at the top level of a block body styles only the elements of that block and of the blocks inside it. The `<style>` of the file is the style of the outermost block, and `<style global>` and `:global(…)` work in any block.
- Its `${}` reads the item and the signals of the block script, and a change updates only the instance that reads it.
- The editor type-checks `${}` in a block style.
