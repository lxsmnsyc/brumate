---
'brumate': patch
---

A client navigation keeps the head elements that carry a CSP nonce. The nonce is left out when the head of the new page is compared with the loaded one, so styles do not reapply and a head script does not run again.
