# Serializable values

Values cross from the server to the browser in two ways: in the page, for the state that client code reads, and through server function calls. Both use [seroval](https://github.com/lxsmnsyc/seroval), with the web plugins of `seroval-plugins`, so they accept the same values.

- The page state is code in inline scripts, which the core runs when it starts. See [Page format](./page-format.md#state).
- Server function calls and their answers are seroval JSON. See [Server function protocol](./server-protocol.md).

## Sent

| Value                                              | Notes                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `string`, `number`, `boolean`, `null`, `undefined` | `NaN`, `Infinity` and `-0` are kept.                                                               |
| `bigint`                                           |                                                                                                    |
| Plain objects and arrays                           | Shared and cyclic references are kept. Objects with a `null` prototype are kept.                   |
| `Date`, `Map`, `Set`                               |                                                                                                    |
| `URL`, `URLSearchParams`, `Headers`                |                                                                                                    |
| `FormData`                                         | A field that holds a file is sent only in the arguments of a call.                                 |
| `Request`, `Response`                              | With their body, which is read to send it.                                                         |
| `ReadableStream`                                   | Each chunk streams as it is ready.                                                                 |
| `AbortSignal`                                      | Whether it aborted, and its reason.                                                                |
| `Event`, `CustomEvent`, `DOMException`             | The type and the options of an event, and the name and the message of an exception.                |
| Typed arrays, `ArrayBuffer`                        |                                                                                                    |
| `Error` and its subclasses                         | The name and the message only. The stack trace stays on the server.                                |
| Promises                                           | Sent as pending, and settled when the value is ready.                                              |
| Elements in `ref` signals                          | As a reference to the element that the server rendered.                                            |
| Client functions                                   | Event handlers, functions passed as props, and server function stubs, as references to their code. |
| Components                                         | As a reference to the component, for a dynamic tag such as `<{tag}>`.                              |
| `children` and `#template` markup                  | As the HTML that the server rendered.                                                              |

## Only through server functions

| Value           | Direction              | Notes                                                                                           |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `File`, `Blob`  | Arguments              | As parts of multipart form data, anywhere in the arguments, such as in a `Map` or a `FormData`. |
| Async iterables | Answers                | Each value streams as it is ready. In the page, a memo of a stream holds its first value.       |
| `FormData`      | Arguments, from a form | A form that posts to a server function sends its `FormData`.                                    |

## Not sent

| Value                                       | Instead                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Regular expressions                         | Send the source and the flags, and make the `RegExp` on the other side. A pattern from a client could take the server a long time to match. |
| Other functions                             | Keep them out of signals and memos. Call them where they are defined.                                                                       |
| Instances of classes                        | Send their data as a plain object.                                                                                                          |
| `File` and `Blob` in answers or in the page | Send a URL to the file instead.                                                                                                             |

## When a value fails

- The type checker reports a signal or memo whose type cannot be sent, at its declaration. See [TypeScript](./typescript.md#what-is-checked).
- A server function that reads a value of the component, other than imports, the module script and other server functions, is a compile error. Pass the value as an argument.
- The compiler reports a value made with `new` that client code reads, when its class cannot be sent.
- Any other value in the page that cannot be sent fails the render with an error that names the value and its component. A value in a server function call that cannot be sent fails the call.

Only values that client code reads are sent. A value that only the server reads can be anything. See [What runs where](./what-runs-where.md).
