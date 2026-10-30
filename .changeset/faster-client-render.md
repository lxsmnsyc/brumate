---
'brumate': patch
---

The browser renders most markup by cloning a `<template>`, not by parsing HTML. This holds for bodies of `#if`, `#for`, `#switch`, `#repeat`, `#head` and `#portal`, children of a component, dynamic tags, spreads, attributes with text and code, and child components. In the rows benchmark, creating 1,000 rows takes 5.3 ms of script, down from 8.0 ms, and replacing them 11.4 ms, down from 15.1 ms. New items of a list go in the page with less work and less garbage.
