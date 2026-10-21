import { toJSONAsync } from 'seroval';
import { Upload, disabledFeatures, plugins, replaceDeep } from './shared.ts';
import { fromChunkStream } from './stream.ts';

/**
 * True for a file or a blob. One from another frame, or another DOM, is an
 * instance of another `Blob` class, so its methods tell instead.
 */
function isBlob(value: unknown): value is Blob {
  if (value instanceof Blob) {
    return true;
  }
  const blob = value as Partial<Blob> | null;
  return (
    typeof blob === 'object' &&
    blob !== null &&
    typeof blob.size === 'number' &&
    typeof blob.type === 'string' &&
    typeof blob.arrayBuffer === 'function' &&
    typeof blob.slice === 'function'
  );
}

/**
 * Calls a server function. It is a separate module, so pages that never call
 * one never load seroval's serializer.
 *
 * Files and blobs in the arguments, in arrays and plain objects, go as parts
 * of multipart form data. `signal` aborts the call.
 */
export async function call(
  prefix: string,
  id: string,
  args: unknown[],
  signal?: AbortSignal,
): Promise<unknown> {
  const files: Blob[] = [];
  const sent = replaceDeep(args, (value) =>
    isBlob(value) ? new Upload(files.push(value) - 1) : undefined,
  );
  const json = JSON.stringify(await toJSONAsync(sent, { plugins, disabledFeatures }));
  let init: RequestInit;
  if (files.length > 0) {
    const form = new FormData();
    form.set('args', json);
    // A blob of another DOM is copied, because form data takes only its own.
    const blobs = await Promise.all(
      files.map((file: Blob) =>
        // Typed as a Blob, so the check narrows a blob of another DOM to never.
        file instanceof Blob
          ? file
          : (file as Blob)
              .arrayBuffer()
              .then((data) => new Blob([data], { type: (file as Blob).type })),
      ),
    );
    for (const [index, blob] of blobs.entries()) {
      form.set(`file${index}`, blob, (files[index] as Partial<File>).name ?? 'blob');
    }
    init = { headers: { 'x-brumate-args': 'form' }, body: form };
  } else {
    init = { headers: { 'content-type': 'application/json' }, body: json };
  }
  return post(prefix, id, { ...init, signal });
}

/**
 * Sends a form to a server function, and returns its result. The form data
 * goes as it is, files included, as when the browser posts the form.
 */
export async function submit(prefix: string, id: string, form: FormData): Promise<unknown> {
  return post(prefix, id, { headers: { 'x-brumate-result': '1' }, body: form });
}

/** Posts to a server function, and reads its answer. */
async function post(prefix: string, id: string, init: RequestInit): Promise<unknown> {
  return answer(
    id,
    await fetch(`${prefix}/${encodeURIComponent(id)}`, { ...init, method: 'POST' }),
  );
}

/** Reads the answer of a server function: its result, a redirect or an error. */
async function answer(id: string, response: Response): Promise<unknown> {
  // The server functions whose memos load again, from `refresh` on the server. The core listens.
  const refreshed = response.headers.get('x-brumate-refresh');
  if (refreshed) {
    document.dispatchEvent(new CustomEvent('brumate:refresh', { detail: refreshed.split(',') }));
  }
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
  // Promises and async iterables in the result settle as the rest of the answer arrives.
  return fromChunkStream(response.body!);
}
