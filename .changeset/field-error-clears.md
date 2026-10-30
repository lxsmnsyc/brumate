---
'@brumate/ui': patch
---

ColorField and NumberField clear their native error and `data-invalid` once the value is valid again after a submit, as TextField does.
