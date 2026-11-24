---
'brumate': minor
---

- `<script src="https://…" trigger="idle|visible|interaction|load">` loads a script of another site at that moment.
- `<script inline trigger="…">` does the same for code written in the `.brm` file.
- The loader starts each of these scripts once per page, under the page nonce and the `brumate` Trusted Types policy.
- In `#head`, a script without `trigger` is a plain element that runs as in HTML. A client navigation keeps it when its HTML is the same, whatever the nonce.
- A build with no script in markup ships none of this code.
- New errors `BRM212` to `BRM216`.
