// The core keeps only what every page needs: it reads the state, runs handlers and updates.
// Each helper that compiled code calls is an export of its own, so a build leaves out the ones
// that no component calls. Features that change how the core reads the page, such as client
// navigation and hot updates, live in their own modules and set `hooks` when they load.
//
// The code is in `client/`, one module for each feature. A module imports only the modules that
// come before it in this order, so there are no cycles: state, code, blocks, references, scopes,
// titles, insert, children, errors, updates, guesses, props, handlers, context, templates,
// branches, lists, inserts, components, page, resume. This module exports what compiled code and
// the other modules of the package use.
import { setGlobal, updateRoute } from './client/context.ts';
import { handle, submitAction } from './client/handlers.ts';
import { dispose, init } from './client/resume.ts';

export { navigationContext, routeContext } from './context.ts';
export {
  affix,
  attribute,
  classAttribute,
  escape,
  internal,
  mergeAttributes,
  onAttribute,
  raw,
  vars,
} from './html.ts';
export type { Raw } from './html.ts';
export { produce } from './produce.ts';
// For `client-routes.ts`, which reads the core with `import()`.
export { SCOPE_IDS as scopeIds, unbind } from './shared.ts';
export { createContext } from './context.ts';
export { nameComment } from './client/blocks.ts';
export { branch, fill, offscreen, rekey, reset, retag } from './client/branches.ts';
export type { HiddenBody } from './client/branches.ts';
export { children, insert } from './client/children.ts';
export { loadModule, loadPart } from './client/code.ts';
export {
  component,
  componentNodes,
  dynamic,
  dynamicNodes,
  elementAt,
  foreignNodes,
  place,
  setItem,
  setSlots,
} from './client/components.ts';
export type { Component } from './client/components.ts';
export {
  consumeContext,
  provideValue,
  setGlobal,
  updateContext,
  updateRoute,
} from './client/context.ts';
export { fail } from './client/errors.ts';
export { guess, track } from './client/guesses.ts';
export { action, handle, handlerProp, rpc, spread, submitAction } from './client/handlers.ts';
export { attr, attrs, content, portalTo, restRef, text, writeText } from './client/inserts.ts';
export { list, toList, windowList, windowStart } from './client/lists.ts';
export { addHead, addPortal, addStyle, deferInBrowser, setVar } from './client/page.ts';
export { prop, spreadProps } from './client/props.ts';
export {
  dispose,
  forget,
  init,
  leavePage,
  leaveRoutes,
  remount,
  removeRoot,
} from './client/resume.ts';
export {
  afterInsert,
  createScope,
  descendants,
  makeId,
  removeScope,
  getScope,
  setOwner,
  sink,
} from './client/scopes.ts';
export { DEVTOOLS, build, hooks, rpcPrefix, scopes, skew } from './client/state.ts';
export type { ClientModule, CoreOptions, DevtoolsHooks, Part, Scope } from './client/state.ts';
export {
  appendText,
  branchNodes,
  clone,
  fillBranch,
  fillList,
  keep,
  keepText,
  listNodes,
  markBlock,
  nodes,
  putText,
  setAttr,
  setAttrText,
  setContent,
  setOn,
  setSpread,
  template,
} from './client/templates.ts';
export { title } from './client/titles.ts';
export {
  asyncMemo,
  binding,
  bindings,
  cells,
  effect,
  get,
  isBound,
  memo,
  pending,
  resolve,
  set,
  timed,
  update,
  updated,
} from './client/updates.ts';

/**
 * What the loader calls. It is one export, so the loader's import of the core
 * names one export, and a build keeps the rest only when components call them.
 */
export const loader: {
  init: typeof init;
  handle: typeof handle;
  dispose: typeof dispose;
  submitAction: typeof submitAction;
  setGlobal: typeof setGlobal;
  updateRoute: typeof updateRoute;
} = { init, handle, dispose, submitAction, setGlobal, updateRoute };
