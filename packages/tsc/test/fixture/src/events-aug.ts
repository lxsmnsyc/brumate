// A custom event that an app merges into the events of every element.
declare module 'brumate/elements' {
  interface ElementEvents {
    itemaction: CustomEvent<string>;
  }
}

export {};
