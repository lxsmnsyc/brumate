---
'brumate': patch
---

On the server, each `const x = await $memo(...)` starts its load as soon as the values it reads are ready, not where its run of awaits starts. A load moves up to right after the last statement that declares a name it reads or can change one, such as `q = x`, `params.set()` or a call of a local function, so two independent awaits with a statement between them load at the same time. Each `await` still waits where it is written, the statements between run once and in their order, and an error of the load or a throw of its expression comes where the `await` is. `$effect`, `$client`, imports and types no longer end a run of awaits.
