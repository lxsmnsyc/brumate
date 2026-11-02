---
'brumate': patch
---

In a browser render, a memo with `await` inside now shows its value once it settles, even when its expression gives a string or an array, as in ``$memo(`Hi ${(await load()).name}`)``. Before, the text and attributes that read it stayed empty. Its rejection now goes to the nearest `#catch`, or to the page once when no `#try` catches it, also when nothing reads the memo.
