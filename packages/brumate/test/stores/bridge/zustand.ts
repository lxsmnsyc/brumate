// A small stand-in for `createStore` of zustand/vanilla, with the same shape: the store holds the
// state and its actions, `setState` merges, and `subscribe` calls the listener on each change.
type Listener<T> = (state: T, previous: T) => void;

export interface StoreApi<T> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: Listener<T>) => () => void;
}

export function createStore<T>() {
  return (initializer: (set: StoreApi<T>['setState'], get: () => T) => T): StoreApi<T> => {
    const listeners = new Set<Listener<T>>();
    let state: T;
    const setState: StoreApi<T>['setState'] = (partial) => {
      const next = typeof partial === 'function' ? partial(state) : partial;
      if (!Object.is(next, state)) {
        const previous = state;
        state = Object.assign({}, state, next);
        for (const listener of listeners) {
          listener(state, previous);
        }
      }
    };
    state = initializer(setState, () => state);
    return {
      getState: () => state,
      setState,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };
}
