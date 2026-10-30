# Log: code-examples

- Read every example of website/docs. Most already use `{name}`, `ref=$bind`, `prevent` and blocks.
- grep for `name=name` (backreference) found three cases that `{name}` covers. Changed them.
- Pages changed: async-data.md (`<Recommendations {user} />`, one example line only), components.md (Meter: `{value}`, `{max}`), markup.md (`<input {id}>`).
- Left as is: `for=id`, `data-theme=theme`, `data-id=id` (the shorthand needs a name that is also the attribute), `onClick=reset` (names differ), and the BRM111 error example.
- The README has no brm example.
