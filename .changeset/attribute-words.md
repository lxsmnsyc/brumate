---
'brumate': minor
---

`true` and `false` render as words for attributes that say their state in their value: `aria-*` and `data-*`, `contenteditable`, `draggable`, `spellcheck` and `writingsuggestions` say `"true"` or `"false"`, `translate` says `"yes"` or `"no"`, and `autocomplete` and `autocorrect` say `"on"` or `"off"`. Before, `false` removed them and `true` left them empty, so `aria-hidden=true` did not hide anything. Other attributes, such as `disabled`, are still there for `true` and left out for `false`, and `null` and `undefined` still leave any attribute out.
