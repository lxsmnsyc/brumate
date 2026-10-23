---
'brumate': minor
---

The dev server has a workbench at `/__brumate/workbench`. It lists the components that depend only on their props and their own state, renders each one on the server with controls for its props, and resumes it in the browser. A component that calls the server, reads the request or the route, or needs a provider is listed apart, with the reason.
