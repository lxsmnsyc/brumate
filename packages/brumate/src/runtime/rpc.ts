import { fromJSON, toJSONAsync } from 'seroval';
import { disabledFeatures, plugins } from './shared.ts';

/**
 * Calls a server function. It is a separate module, so pages that never call
 * one never load seroval's serializer.
 */
export async function call(prefix: string, id: string, args: unknown[]): Promise<unknown> {
  return answer(
    id,
    await fetch(`${prefix}/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(await toJSONAsync(args, { plugins, disabledFeatures })),
    }),
  );
}

/**
 * Sends a form to a server function, and returns its result. The form data
 * goes as it is, files included, as when the browser posts the form.
 */
export async function submit(prefix: string, id: string, form: FormData): Promise<unknown> {
  return answer(
    id,
    await fetch(`${prefix}/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'x-brumate-result': '1' },
      body: form,
    }),
  );
}

/** Reads the answer of a server function: its result, a redirect or an error. */
async function answer(id: string, response: Response): Promise<unknown> {
  const location = response.headers.get('x-brumate-redirect');
  if (location !== null) {
    window.location.assign(location);
    // The page is leaving, so the call never settles.
    return new Promise(() => {});
  }
  if (!response.ok) {
    let message = `Server function "${id}" failed with status ${response.status}`;
    try {
      message = ((await response.json()) as { error: string }).error;
    } catch {
      // The body is not the error of a server function.
    }
    throw Object.assign(new Error(message), { name: 'ServerError', status: response.status });
  }
  return fromJSON(await response.json(), { plugins, disabledFeatures });
}
