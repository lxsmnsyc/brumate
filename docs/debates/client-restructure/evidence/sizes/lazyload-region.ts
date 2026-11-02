function trigger(scope: Scope, slot: number): void {
  for (const check of waiters.keys()) {
    check();
  }
  const id = findRoot(scope).m!;
  const children = childrenReady(scope);
  if (modules.has(id) && loadedParts.has(`${id}:update`) && loadingCode.size === 0 && !children) {
    pass(() => queueWrite(scope, slot));
    return;
  }
  // The first write to a component loads its update code. Later writes wait in order, and for
  // the code of the page, which the updates can render and call. The writes of one pass that
  // wait, such as the props of a child, join its list and run as one pass, so a child computes once.
  // `waiting` is set only while a pass runs.
  if (waiting) {
    // Its code starts to load now, so the pass waits no longer than the first write.
    waiting.push([scope, slot, updateCode(scope, slot).catch((error) => fail(scope, error))]);
    return;
  }
  const from = origin;
  const via = viaContext;
  const list: [Scope, number, Promise<unknown>?][] = [[scope, slot]];
  if (running > 0) {
    waiting = list;
  }
  const loading = loadModule(id)
    .then(async (loaded) => {
      await (loaded.g[scope.k]?.[slot] && loadPart(loaded, 'update'));
      const waits: unknown[] = [...loadingCode, children];
      for (const [, , load] of list) {
        waits.push(load);
      }
      await Promise.allSettled(waits);
      const before = origin;
      const viaBefore = viaContext;
      origin = from;
      viaContext = via;
      try {
        pass(() => {
          for (const [target, at] of list) {
            queueWrite(target, at);
          }
        });
      } finally {
        origin = before;
        viaContext = viaBefore;
      }
    })
    .catch((error: unknown) => {
      // The write cannot run. Its effects do not wait for it any longer.
      fail(scope, error);
      flushEffects();
    });
  loadingUpdates.add(loading);
  void loading.finally(() => loadingUpdates.delete(loading));
}

/** Loads the code of a component, its update code when something reads the slot, and its children. */
async function updateCode(scope: Scope, slot: number): Promise<unknown> {
  await loadUpdate(scope, slot);
  return childrenReady(scope);
}

/** Loads the module of a component and its update code, when something reads the slot. */
function loadUpdate(scope: Scope, slot?: number): Promise<unknown> {
  return loadModule(findRoot(scope).m!).then((loaded) => {
    const reads = loaded.g[scope.k];
    return (slot === undefined ? reads : reads?.[slot]) && loadPart(loaded, 'update');
  });
}

/**
 * Loads the update code that a write of a handler can need, so its writes run before it returns.
 * A handler that is not in `w` of its module writes only the slots of its own component, and
 * waits for the code of that component. A handler in `w` also waits for the components above it, which a
 * write of a bound prop reaches, and for the scope that its children render in.
 */
export async function updateReady(scope: Scope | undefined, ref?: string): Promise<unknown> {
  if (!scope) {
    return;
  }
  const root = findRoot(scope);
  const own = ref && !(await loadModule(root.m!)).w?.includes(ref.split('#')[1]!);
  return Promise.all([
    loadUpdate(scope),
    own ? loadUpdate(root) : Promise.all([updateReady(scope.p ?? scope.o), updateReady(scope.t)]),
  ]);
}

/** The writes of the pass that runs that wait for code, to run as one pass of their own. */
let waiting: [Scope, number, Promise<unknown>?][] | undefined;

/** The updates that wait for their code. */
const loadingUpdates = new Set<Promise<unknown>>();

/**
 * Resolves when the updates of the writes so far have run, including those
 * whose code is loading. `transition` of `brumate/events` waits for it.
 */
export async function updated(): Promise<void> {
  while (loadingUpdates.size > 0) {
    // oxlint-disable-next-line no-await-in-loop -- An update can start more loads.
    await Promise.allSettled(loadingUpdates);
  }
}

(globalThis as { [key: symbol]: unknown })[Symbol.for('brumate.updated')] = updated;

