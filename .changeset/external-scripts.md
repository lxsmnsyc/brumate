---
'brumate': minor
---

A `.brm` file can hold a script of another site and say when it loads: `<script src="https://…" trigger="idle|visible|interaction|load">`, or `<script inline trigger="…">` for code written in the file. In `#head`, a script without `trigger` is an element that runs as HTML does, and a client navigation keeps it when its HTML is the same, whatever the nonce. Other scripts are written as `<template b-script>` and the loader starts them once per page, under the nonce and the `brumate` Trusted Types policy. A build with no script in markup has none of the code. New errors `BRM212` to `BRM216`.
