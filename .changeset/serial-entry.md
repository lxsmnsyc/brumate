---
'brumate': minor
---

A serial entry, `src/serial.ts` or the `serial` option of the plugin, lets the page state, server function calls and `cached` results hold classes of the app. It exports `plugins` made with `definePlugin` from `brumate/serial`, which turn a value into data and back, and can set `depthLimit` and `disabledFeatures` of the serializer. The server and the browser load it, the compiler lets a signal hold a class that it tests with `instanceof`, and `SendableValues` tells the type checker about the class.
