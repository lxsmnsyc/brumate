---
'brumate': minor
---

A context that a provider sets once, to a constant or a value only the server uses, is no longer live in the browser. Code that reads it ships only what it computes from it, and the page state no longer carries its value. A context stays live when a signal or a function is in the value, when the provider runs in a block that the browser renders, or when a component that the browser renders reads it. New export: `analyzeProjectAll`, which finds the live props and the live contexts together. `CompileOptions` takes `liveContexts`.
