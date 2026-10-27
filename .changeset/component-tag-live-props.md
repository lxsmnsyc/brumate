---
'brumate': patch
---

A dynamic tag that names a component, such as `<{as} label=(label) />`, passes the props that change to the component, as a component written by name does. The component reads them also when it names the prop, not only when it spreads the rest.

Several handlers of one event on such a tag, from rest props and from the tag, all run, in that order.
