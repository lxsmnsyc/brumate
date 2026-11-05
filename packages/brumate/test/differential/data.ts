// The data of the differential test: the pages it skips, the props of the pages it renders, and
// the divergences it knows between the server render and the browser render.

/** Pages that the test skips, with the reason for each. */
export const OPT_OUTS: Record<string, string> = {};

function skip(reason: string, names: string[]): void {
  for (const name of names) {
    OPT_OUTS[name] = reason;
  }
}

skip('The server render throws without the props of a parent: a function, a list or an object.', [
  'Broken',
  'CtxReaderMid',
  'DiamondBindChild',
  'DiamondChild',
  'DiamondChildrenKid',
  'DiamondChildrenWrap',
  'DiamondContextLeaf',
  'DiamondContextMid',
  'FnReadChild',
  'FnReadEffectChild',
  'GapBlockCard',
  'KeptItems',
  'LateList',
  'PromiseChild',
  'PromiseChildDestructured',
  'ReinsertLabel',
  'RowList',
  'SourcedList',
  'SpikeListBox',
  'TemplateSwitch',
  'TemplateToggle',
  'TplContextList',
  'TryTemplateList',
  'TryTemplateToggle',
  'packed',
  'revealParts',
  'sourced',
  'spreadChildrenList',
  'spreadChildrenMove',
  'spreadChildrenPick',
  'spreadChildrenTwice',
  'todos',
]);

skip(
  'The server render throws without the context that a parent provides, since a context has no default.',
  [
    'ContextAs',
    'CounterButtons',
    'CtxWriterLoopMid',
    'FnReadContextMid',
    'SpikeButton',
    'SpikeLabel',
    'SpikePopover',
    'SpikeValue',
    'Themed',
    'ThemedLive',
    'TplReader',
    'TplRelay',
    'themedLater',
    'themedStoreLater',
  ],
);

skip('The server render waits for a promise that only the test settles, from a data module.', [
  'AwaitInner',
  'LoadUser',
  'MarkupKid',
  'TryWaitKid',
  'TryWaitSelf',
  'WaitBroken',
  'WaitConst',
  'WaitDerived',
  'WaitDestr',
  'WaitLabel',
  'WaitPromiseChild',
  'WaitSide',
  'WaitUser',
  'awaited',
  'loadingOnInPlace',
  'startsErrors',
  'startsHoisted',
  'startsLater',
  'startsOverlap',
  'startsRejects',
]);

skip(
  'Uses the request, the session or the serial entry, which a render in the browser does not have.',
  ['preference', 'serialMoney', 'session', 'stream'],
);

skip('A child that throws on purpose; the pages that render it cover where the error goes.', [
  'AwaitReadKid',
  'AwaitShownKid',
  'GapMarkupFailKid',
  'PrimitiveAwaitFailKid',
  'memoErrorAwaitOutside',
]);

skip('The rows of a table need a table around them, and the host of the browser render is a div.', [
  'WinBody',
  'windowedChildren',
]);

skip('A child of a polymorphic page that renders only with the `as` and children of its parent.', [
  'AsButton',
]);

skip('Reads the request with `getEvent`, which a render in the browser does not have.', [
  'deferred',
  'deferredNested',
  'deferredParent',
]);

skip('Needs a prop that holds a record of promises, which the test does not make.', [
  'RevealPart',
  'revealBackwards',
  'revealOrder',
  'revealTogether',
  'streamedCatchTwo',
]);

/** The props of the pages that take data. The browser render gets the same values. */
export const PROPS: Record<string, Record<string, unknown>> = {
  counter: {},
  todos: {
    initial: [
      { id: '1', title: 'Write the docs', done: true, at: new Date('2026-10-01T00:00:00Z') },
      { id: '2', title: 'Build <the> compiler', done: false, at: new Date('2026-10-20T00:00:00Z') },
    ],
  },
  blocks: { items: ['one', 'two'], tab: 'b' },
  compact: {
    initial: [
      { id: '1', label: 'One', note: '' },
      { id: '2', label: 'Two', note: 2 },
    ],
  },
};

export interface Cause {
  /** `remove`: a special case that one write path would not need. `accepted`: it stays. */
  verdict: 'remove' | 'accepted';
  /** What differs, and why. */
  reason: string;
}

/** Why a page differs, by name. Each cause is one divergence. */
export const CAUSES: Record<string, Cause> = {
  'lazy-ref': {
    verdict: 'accepted',
    reason:
      'A ref slot of a resumed page holds the scope and anchor of its element, and the core reads the element when it needs it. The browser render holds the element.',
  },
  'ref-setter-relay': {
    verdict: 'remove',
    reason:
      'A setter ref ($bind(signal, fn)) on a component: the resumed page calls fn with the element of the component, and the browser render does not call it.',
  },
  'ref-loop': {
    verdict: 'remove',
    reason:
      'A ref inside a list whose source reads the signal that the ref writes loops without end in the browser render; the resumed page settles.',
  },
  'memo-throw': {
    verdict: 'remove',
    reason:
      'A $memo that throws in its first run: the server stores the error in the memo and a #try that reads it catches it. The browser render throws out of the component.',
  },
  'memo-reject': {
    verdict: 'remove',
    reason:
      'A memo awaited where it is declared, in a #try, whose promise rejects: both renders show the #catch body, and only the browser render also reports the error to onError.',
  },
  'pending-read': {
    verdict: 'remove',
    reason:
      'A memo or a function prop that reads a property of a memo that is still pending: the server holds back the markup, and the first browser render reads undefined and throws.',
  },
  'await-in-script': {
    verdict: 'accepted',
    reason:
      'A component with an await in its script or markup in a child that the browser renders: the browser reports that only the server can render it.',
  },
  'class-order': {
    verdict: 'remove',
    reason:
      'The tokens of a class attribute come in another order, such as base off tail on the server and base tail off in the browser. Both name the same classes.',
  },
  'debounce-start': {
    verdict: 'remove',
    reason:
      '$isPending of a $debounced value is false in the server render and true in the first browser render, which starts the timer.',
  },
  'template-context': {
    verdict: 'remove',
    reason:
      'A #template that a child calls reads the context at the place of its definition (the default) in the browser render, and the value that the child provides in the server render.',
  },
  'defer-template': {
    verdict: 'accepted',
    reason:
      'A #defer block: the server render leaves a template element in the page, and the browser render has none. The visible markup is the same.',
  },
  'try-rollback': {
    verdict: 'remove',
    reason:
      'A #try body that fails keeps its #portal content, its title and its #head tags in the browser render. The server render drops them with the body.',
  },
  'function-prop-reads': {
    verdict: 'remove',
    reason:
      'A function prop that a child reads runs one more time in the browser render than on the server.',
  },
  'awaited-slot': {
    verdict: 'accepted',
    reason:
      'The value of an await $memo is a slot of the browser render. The server renders it and sends no slot for it.',
  },
  'loading-scopes': {
    verdict: 'accepted',
    reason:
      'A #loading body that is pending: the browser render has scopes for the body that the resumed page does not have yet. The visible markup is the same.',
  },
  'error-stack': {
    verdict: 'accepted',
    reason:
      'An error that a #catch prints with its stack names the files that threw, and the files of the two renders differ.',
  },
};

/** The pages that differ from their server render, with the cause of each. */
export const DIVERGENCES: Record<string, string> = {};

function diverge(cause: string, names: string[]): void {
  for (const name of names) {
    DIVERGENCES[name] = cause;
  }
}

diverge('lazy-ref', [
  'RefRelay',
  'SetterRefRelay2',
  'refForward',
  'refVisibleForward',
  'refVisibleLoading',
  'restRefCastPage',
  'restRefChangePage',
  'restRefPage',
  'restRefTagPage',
  'restRefTagPageSwap',
]);
diverge('ref-setter-relay', [
  'setterRefChangePage',
  'setterRefPage',
  'setterRefRelay3Page',
  'setterRefRelayPage',
  'setterRefRestPage',
]);
diverge('ref-loop', ['refLoop']);
diverge('memo-throw', [
  'memoErrorResume',
  'memoErrorResumeShown',
  'memoErrorServerOutside',
  'memoErrorServerScript',
  'memoErrorServerTwo',
]);
diverge('memo-reject', ['memoErrorAwaitServer']);
diverge('pending-read', ['fnReadAsync', 'loadingChain', 'loadingOnChain']);
diverge('await-in-script', ['PromiseLateChild', 'promiseLate']);
diverge('class-order', ['classes']);
diverge('debounce-start', ['timing']);
diverge('template-context', ['tplContextListPage']);
diverge('defer-template', ['deferredLater']);
diverge('try-rollback', ['tryRollback']);
diverge('function-prop-reads', ['fnReadUntrack']);
diverge('awaited-slot', ['awaitedStream']);
diverge('loading-scopes', ['RelayLoading', 'sourcedLoading']);
diverge('error-stack', ['catchLeak']);
