/** A load of `loadUser` that has not settled, which a test settles. */
export interface UserLoad {
  id: number;
  done: (value: { name: string }) => void;
  fail: (error: Error) => void;
}

/** Loads a user. The test settles each load, and the list counts them. */
export function loadUser(id: number): Promise<{ name: string }> {
  const loads = ((globalThis as { userLoads?: UserLoad[] }).userLoads ??= []);
  return new Promise((done, fail) => {
    loads.push({ id, done, fail });
  });
}
