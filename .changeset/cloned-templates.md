---
'brumate': patch
---

The browser renders the body of an `#if` or a `#for` whose markup is elements, attributes and text by cloning a `<template>`, not by parsing HTML. In the rows benchmark, creating 1,000 rows takes 5.3 ms of script, down from 8.0 ms, and replacing them 11.4 ms, down from 15.1 ms.
