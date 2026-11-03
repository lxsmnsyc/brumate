---
'brumate': minor
---

Add `<style global>`: a block of rules with no scope attribute, so a stylesheet of unscoped selectors needs no `:global(…)` around each one. A plain `<style>` stays scoped and both can sit in one component. It works with `lang="scss"` and `lang="less"`. A `<style>` with an attribute other than `lang` and `global`, such as `scoped` or `media`, is now a compile error (BRM189), where it was ignored before, and so is `global` with a value (BRM190).
