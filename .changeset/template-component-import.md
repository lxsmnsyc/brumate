---
'brumate': patch
---

A `#template` of the same file that renders a component, or reads an import, now works when markup that calls it updates in the browser. The update part of the client code copied the template but did not import what it uses, so the first update threw `ReferenceError: <Component> is not defined`.
