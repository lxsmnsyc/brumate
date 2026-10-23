---
'brumate': patch
---

Long lists update faster. Rows that the client adds find their elements without a search of the page, so creating 10,000 rows takes about 370 ms instead of 4 s. A change of order moves only the items that change places, so swapping 2 of 1,000 rows moves 2 rows instead of about 1,000.
