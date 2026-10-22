// Trusted Types. A site whose Content Security Policy has
// `require-trusted-types-for 'script'` refuses a string in `innerHTML` and
// in the text of a script. The core passes the markup that it inserts, and
// the scripts that it copies to run them, through a policy named `brumate`.
// The markup is what brumate's own render code made, with every value
// escaped, and the scripts come from the server with the page, so the
// policy passes them as they are.

/** The name of the policy, for `trusted-types brumate` in the policy of the site. */
export const POLICY = 'brumate';

interface Policy {
  createHTML(html: string): string;
  createScript(code: string): string;
}

/** The policy, made on the first insert. Null where the browser has no Trusted Types. */
let policy: Policy | null | undefined;

function ensure(): Policy | null {
  if (policy !== undefined) {
    return policy;
  }
  const factory = (
    globalThis as {
      trustedTypes?: { createPolicy(name: string, rules: Policy): Policy };
    }
  ).trustedTypes;
  policy = null;
  if (factory) {
    try {
      policy = factory.createPolicy(POLICY, {
        createHTML: (html) => html,
        createScript: (code) => code,
      });
    } catch (error) {
      // The policy of the site names other policies, so the inserts below fail too.
      console.error(
        `brumate: the Content Security Policy does not allow the Trusted Types policy "${POLICY}". Add "trusted-types ${POLICY}" to it`,
        error,
      );
    }
  }
  return policy;
}

/** Markup that the core made, as the browser accepts it in `innerHTML`. */
export function trustedHTML(html: string): string {
  return ensure()?.createHTML(html) ?? html;
}

/** The code of a script that came with the page, as the browser accepts it in a script's text. */
export function trustedScript(code: string): string {
  return ensure()?.createScript(code) ?? code;
}
