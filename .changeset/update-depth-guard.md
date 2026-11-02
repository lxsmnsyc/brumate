---
'brumate': patch
---

An effect or an update that writes a value it reads no longer hangs the tab. After 1000 rounds of effects in one change, or 10000 rounds of updates as before, the page stops the loop and sends an error to the nearest `#try`, or to `onError` and the `brumate:error` event when no `#try` is around it. The message names the effect or update and its component, points to `$untrack`, and has the code BRM187.
