# Inbox

Items of the [proposals](../proposals.md) that no roadmap schedules yet, with the reason. A roadmap takes one when an app or the website needs it, as step 7 of the [Order](../proposals.md#order) says.

| Item                                                                                       | Why it waits                                                                                    |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [Named view transitions](../proposals.md#named-view-transitions)                           | Until an app animates lists or shared elements. Manual names work.                              |
| [Streaming lists](../proposals.md#streaming-lists), `#for await`                           | Until a page needs a stream that starts with it. `gather` covers the browser.                   |
| [Styles in blocks](../proposals.md#styles-in-blocks)                                       | Medium value. Inline styles and a component of its own work.                                    |
| [External scripts](../proposals.md#external-scripts)                                       | Small. Until an app needs a script of another site. Also an open question about inline scripts. |
| [Reveal order of `#defer` blocks](../proposals.md#reveal-order-of-defer-blocks)            | Until a page needs it.                                                                          |
| [Server components](../proposals.md#server-components)                                     | High value, large. Starts with a spike. Order step 6, after the client size work.               |
| [Worker functions](../proposals.md#worker-functions)                                       | After the channels of two-way realtime.                                                         |
| [Two-way realtime](../proposals.md#two-way-realtime)                                       | Until an app needs chat, presence or shared editing. About 3 weeks.                             |
| [Offline pages](../proposals.md#offline-pages)                                             | Until an app needs to work offline.                                                             |
| [Observability](../proposals.md#observability)                                             | Until an app needs traces.                                                                      |
| [Idempotent calls](../proposals.md#idempotent-calls), keys on calls sent again             | With the first feature that sends calls again: the offline queue or a reconnect.                |
| [Embedding in other sites](../proposals.md#embedding-in-other-sites)                       | Until an app needs a widget on another site.                                                    |
| [Internationalization](../proposals.md#internationalization)                               | High value, large. Until an app needs translated text.                                          |
| [Images](../proposals.md#images)                                                           | Until an app needs image imports.                                                               |
| [Markdown with components](../proposals.md#markdown-with-components), as a plugin for apps | The website plugin works for the site. Until a content app needs it.                            |
| [Content mappers for TypeScript 7](../proposals.md#content-mappers-for-typescript-7)       | PR #3, until the TypeScript 7.1 API is stable.                                                  |
| [Devtools](../proposals.md#devtools), history and a browser extension                      | Until someone needs them.                                                                       |
| [Component workbench](../proposals.md#component-workbench), stories with server answers    | Step 4, if apps ask for it.                                                                     |
| [Fixed walks](../proposals.md#later-fixed-walks)                                           | Until speed matters more than size. Branch exp/fixed-walk.                                      |
| [Agent support](../proposals.md#agent-support), the tasks run by hand                      | After the skill ships (agent-support/brm-skill).                                                |
| [Agent support](../proposals.md#later), an MCP server                                      | Until the other pieces show which tools agents use.                                             |
| Leave animations for `#for` items ([Headless UI](../proposals.md#headless-ui-components))  | Needs a hook in the list code. Until a request.                                                 |
| [Feed](../proposals.md#10-feed)                                                            | With streaming lists, or a request.                                                             |

## Built, so no roadmap needs it

- Long lists (`#for … window(h)`): the parser's `parseWindow`, used by Virtualizer, ListBox, Tree and TableBody.
- Component workbench steps 1 to 3, including story files with named props (`workbenchStories` in vite.ts).
- Components from packages: packages/brumate/src/packages.ts.
- Nested TransitionChild: packages/ui/src/TransitionChild.brm.
- Ref forwarding: #243.
