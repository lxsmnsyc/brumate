// Signals and memos at the top level of a module. They compile to the stores of `brumate/store`:
//
//   export let items = $signal<number[]>([]);   // export const items = $$store<number[]>([])
//   export const total = $memo(items.length);   // export const total = $$derived([items], ([items]) => (items.length))
//
// - Code of the module reads a signal with `items.get()` and writes it with `items.set(…)`.
// - A memo is a `memoStore`, whose value can load: `$memo(await load(id))` gives it an async
//   function.
// - A component that imports a signal reads it like `$store(items)`, one way: it can write a
//   signal of its own `<script module>`, and no signal of an import. It reads a memo as a memo of
//   its own over the load of the store, which follows the values of the store's sources.
// - In `<script module>`, the store has the name `$$ms_items`, and the instance script reads it
//   under the name `items`.

import { parseSync } from 'oxc-parser';
import type { SFCFile } from './ast.ts';
import { MACROS, SIGNALS_MODULE } from './macros.ts';
import {
  ModuleError,
  forEachReference,
  isReactiveModule,
  parseModule,
  relocate,
  resolveFromDisk,
  scripts,
} from './modules.ts';
import type { ReactiveModule, ResolveModule } from './modules.ts';
import { children, getPatternNames } from './oxc.ts';
import type { oxc } from './oxc.ts';
import { parse } from './parser.ts';

/** The module of stores. */
const STORE_MODULE = 'brumate/store';
/** The module of the runtime that holds `produce`. */
const CLIENT_MODULE = 'brumate/client';
const STORE = '$$store';
const DERIVED = '$$derived';
/** The store of a memo: it holds an error, and its value can load. */
const HELD = 'memoStore';
const PRODUCE = '$$produce';
const GATED = '$$gated';
const TIMED = '$$timed';
const OPTIMISTIC = '$$optimistic';

/** The compile-time functions that declare a value at the top level, and what each makes. */
const FORMS: ReadonlyMap<string, 'signal' | 'memo'> = new Map([
  ['$signal', 'signal'],
  ['$memo', 'memo'],
  ['$gate', 'memo'],
  ['$debounced', 'memo'],
  ['$throttled', 'memo'],
  ['$optimistic', 'signal'],
]);
/** The prefix of the store of a signal of `<script module>`. */
const PREFIX = '$$ms_';
/** The `$store` that the importer side calls. */
const READ = '$$ms_read';
/** The `$memo` that the importer side calls. */
const MEMO = '$$ms_memo';
/** The prefix of the slot that holds the values of the sources of a memo. */
const INPUTS = '$$ms_in_';

/**
 * The declaration that reads a module value in a component. A signal and the forms other than
 * `$memo` read the store with `$store`. A memo is a memo of the component over the load of the
 * store, which computes again when the values of its sources change, so `#loading`, `await`,
 * `$isPending` and `$resolve` work on it as on a memo of the component.
 */
function readSignal(name: string, store: string, signal: ModuleSignal, own: boolean): string {
  if (signal.form === '$memo') {
    const inputs = `${INPUTS}${name}`;
    return `const ${inputs} = ${READ}(${store}.i);\nconst ${name} = ${MEMO}(${signal.awaits ? 'await ' : ''}${store}.p(${inputs}));`;
  }
  // A signal of the file is written with `let`: the write calls the `set` of the store. A signal of
  // an import is read-only.
  return `${own && signal.kind === 'signal' ? 'let' : 'const'} ${name} = ${READ}(${store});`;
}

/** A signal or a memo at the top level of a module. */
export interface ModuleSignal {
  kind: 'signal' | 'memo';
  /** True for the value of `$optimistic`, which is written with `=` only. */
  optimistic?: boolean;
  /** The form that made it, such as `$memo`. */
  form?: string;
  /** True for a memo that awaits, which an importer declares as `$memo(await …)`. */
  awaits?: boolean;
  /** The name of the binding that holds the store. */
  binding: string;
  /** The name that the module exports it as. */
  exported?: string;
  /** For a signal that the module imports from another module, where it comes from. */
  from?: { specifier: string; name: string };
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** What the transform of the top level of one program gives. */
export interface SignalPlan {
  edits: Edit[];
  /** The signals and memos of the program, by the name that the code uses. */
  signals: Map<string, ModuleSignal>;
  /** The imports that the new code needs. */
  header: string;
}

/** The message of a write to a memo of a module. */
function MEMO_WRITE(name: string): string {
  return `Cannot assign to module memo "${name}". A memo is read-only`;
}

/** Type nodes hold names of types, which stay as they are. */
const WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

/** The local names of the compile-time functions that a program imports. */
function macroNames(program: oxc.Program): Map<string, string> {
  const names = new Map<string, string>();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== SIGNALS_MODULE) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ImportSpecifier') {
        continue;
      }
      const imported =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value;
      if (MACROS.has(imported)) {
        names.set(specifier.local.name, imported);
      }
    }
  }
  return names;
}

function isScope(node: oxc.Node): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression'
  );
}

/** The error of a form that a module cannot compile. */
function topLevelError(name: string, reason: string, fix: string, offset: number): ModuleError {
  return new ModuleError(`${name} cannot be compiled in a module${reason}. ${fix}`, offset);
}

/** The message of a write through an import. */
function importWrite(name: string, specifier: string): string {
  return `Cannot assign to module signal "${name}". Export a function from ${specifier} that writes it, and call that function`;
}

/** The form that a top-level compile-time function can take instead. */
function advice(macro: string): string {
  switch (macro) {
    case '$signal':
      return 'Declare a signal on its own, as in "let count = $signal(0)"';
    case '$memo':
      return 'Declare a memo on its own, as in "const double = $memo(count * 2)"';
    case '$gate':
      return 'Declare a gated value on its own, as in "const query = $gate(input, (prev, next) => next.length >= 2)"';
    case '$debounced':
    case '$throttled':
      return `Declare a timed value on its own, as in "const typed = ${macro}(input, 300)"`;
    case '$optimistic':
      return 'Declare an optimistic value on its own, as in "let shown = $optimistic(list)"';
    default:
      return `Call ${macro} in a component, or in a module function that a component calls with const { … } = name()`;
  }
}

/** True when the identifier is a name in a type, not a value. */
function inType(node: oxc.Node, parents: Map<oxc.Node, oxc.Node>): boolean {
  for (let at = parents.get(node); at; at = parents.get(at)) {
    if (at.type.startsWith('TS') && !WRAPPERS.has(at.type)) {
      return true;
    }
    if (at.type === 'Program') {
      return false;
    }
  }
  return false;
}

/**
 * Plans the transform of the top level of a program. Returns undefined when the program declares
 * no signal or memo there. Throws a `ModuleError` for a form that the top level cannot take.
 */
export function planModuleSignals(
  program: oxc.Program,
  source: string,
  scriptModule: boolean,
  path?: string,
  resolve: ResolveModule = resolveFromDisk,
): SignalPlan | undefined {
  // A module that imports itself again through others is planned once.
  if (path !== undefined) {
    if (planning.has(path)) {
      return undefined;
    }
    planning.add(path);
  }
  try {
    return plan(program, source, scriptModule, path, resolve);
  } finally {
    if (path !== undefined) {
      planning.delete(path);
    }
  }
}

/** The modules that are being planned, so a cycle of imports stops. */
const planning = new Set<string>();

/** The functions that a program declares at its top level, by name. */
function topLevelFunctions(program: oxc.Program): Map<string, oxc.Node> {
  const functions = new Map<string, oxc.Node>();
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' && statement.declaration
        ? statement.declaration
        : statement;
    if (declaration.type === 'FunctionDeclaration' && declaration.id) {
      functions.set(declaration.id.name, declaration);
    } else if (declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        const init = declarator.init;
        if (
          declarator.id.type === 'Identifier' &&
          (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression')
        ) {
          functions.set(declarator.id.name, init);
        }
      }
    }
  }
  return functions;
}

/** What a memo follows to find the signals that its expression reads. */
interface Walk {
  path: string | undefined;
  signals: Map<string, ModuleSignal>;
  functions: Map<string, oxc.Node>;
  imports: Map<string, { specifier: string; imported: string }>;
}

function importsOf(program: oxc.Program): Map<string, { specifier: string; imported: string }> {
  const imports = new Map<string, { specifier: string; imported: string }>();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') {
      continue;
    }
    for (const item of statement.specifiers) {
      if (item.type === 'ImportSpecifier') {
        imports.set(item.local.name, {
          specifier: statement.source.value,
          imported: item.imported.type === 'Identifier' ? item.imported.name : item.imported.value,
        });
      }
    }
  }
  return imports;
}

/** True for a name that is a write target of a pattern, as `other` in `[other] = values`. */
function inPattern(node: oxc.Node, parents: Map<oxc.Node, oxc.Node>): boolean {
  const parent = parents.get(node);
  if (!parent) {
    return false;
  }
  switch (parent.type) {
    case 'ArrayPattern':
    case 'RestElement':
      return true;
    case 'AssignmentPattern':
      return parent.left === node;
    case 'Property':
      return parent.value === node && parents.get(parent)?.type === 'ObjectPattern';
    case 'ForOfStatement':
    case 'ForInStatement':
      return parent.left === node;
    default:
      return false;
  }
}

/**
 * Rewrites a write of a signal in `edits`: an assignment, an update and `$produce`. Returns
 * undefined when the identifier is not written, and true when it uses `$produce`.
 */
function rewriteWrite(
  identifier: oxc.IdentifierReference,
  store: string,
  context: { source: string; parents: Map<oxc.Node, oxc.Node>; macros: Map<string, string> },
  edits: Edit[],
): boolean | undefined {
  const { source, parents, macros } = context;
  const parent = parents.get(identifier);
  if (parent?.type === 'CallExpression' && parent.arguments[0] === identifier) {
    // `$produce(items, recipe)` becomes `items.set($$produce(items.get(), recipe))`.
    const callee = parent.callee;
    if (callee.type === 'Identifier' && macros.get(callee.name) === '$produce') {
      edits.push({
        start: callee.start,
        end: identifier.end,
        text: `${store}.set(${PRODUCE}(${store}.get()`,
      });
      edits.push({ start: parent.end, end: parent.end, text: ')' });
      return true;
    }
  }
  if (parent?.type === 'AssignmentExpression' && parent.left === identifier) {
    // The operator sits between the name and the value.
    const between = source.slice(identifier.end, parent.right.start);
    const operator = parent.operator;
    const at = identifier.end + between.indexOf(operator) + operator.length;
    if (operator === '=') {
      edits.push({ start: identifier.start, end: at, text: `${store}.set(` });
    } else {
      const binary = operator.slice(0, -1);
      edits.push({
        start: identifier.start,
        end: at,
        text: `${store}.set(${store}.get() ${binary} (`,
      });
      edits.push({ start: parent.end, end: parent.end, text: ')' });
    }
    edits.push({ start: parent.end, end: parent.end, text: ')' });
    return false;
  }
  if (parent?.type === 'UpdateExpression') {
    const step = parent.operator === '++' ? '+' : '-';
    const statement = parents.get(parent)?.type === 'ExpressionStatement';
    edits.push({
      start: parent.start,
      end: parent.end,
      text:
        parent.prefix || statement
          ? `${store}.set(${store}.get() ${step} 1)`
          : `(($v) => (${store}.set($v ${step} 1), $v))(${store}.get())`,
    });
    return false;
  }
  return undefined;
}

function linkParents(root: oxc.Node): Map<oxc.Node, oxc.Node> {
  const parents = new Map<oxc.Node, oxc.Node>();
  function link(node: oxc.Node): void {
    for (const [, child] of children(node)) {
      parents.set(child, node);
      link(child);
    }
  }
  link(root);
  return parents;
}

function plan(
  program: oxc.Program,
  source: string,
  scriptModule: boolean,
  path: string | undefined,
  resolve: ResolveModule,
): SignalPlan | undefined {
  const macros = macroNames(program);
  const signals = new Map<string, ModuleSignal>();
  const ownImports = importsOf(program);
  // The signals that the module imports from another module of reactive logic.
  if (path !== undefined) {
    for (const [local, { specifier, imported }] of ownImports) {
      if (!specifier.startsWith('.') || !isReactiveModule(specifier)) {
        continue;
      }
      const module = resolve(specifier, path);
      const signal = module && findModuleSignals(module, resolve).get(imported);
      if (signal) {
        signals.set(local, {
          kind: signal.kind,
          binding: local,
          from: { specifier, name: imported },
        });
      }
    }
  }

  function macroOf(node: oxc.Node | null | undefined): string | undefined {
    return node?.type === 'CallExpression' && node.callee.type === 'Identifier'
      ? macros.get(node.callee.name)
      : undefined;
  }

  // A compile-time function that runs when the module loads cannot work: it needs a component.
  function reject(node: oxc.Node): void {
    if (isScope(node)) {
      return;
    }
    const macro = macroOf(node);
    // `$untrack` compiles away: its argument reads the signals without tracking them.
    if (macro && macro !== '$untrack') {
      throw topLevelError(
        macro,
        ' at the top level, except in a declaration of a signal, a memo, a gate, a debounced or throttled value, or an optimistic value',
        advice(macro),
        node.start,
      );
    }
    for (const [, child] of children(node)) {
      reject(child);
    }
  }

  // The declarations first, so a memo knows the signals that it can read.
  const declarations: {
    declaration: oxc.VariableDeclaration;
    exported: oxc.Node | undefined;
    macro: string;
  }[] = [];
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' && statement.declaration
        ? statement.declaration
        : statement;
    if (declaration.type !== 'VariableDeclaration') {
      if (
        statement.type !== 'ImportDeclaration' &&
        statement.type !== 'ExportAllDeclaration' &&
        !(statement.type === 'ExportNamedDeclaration' && !statement.declaration)
      ) {
        reject(statement);
      }
      continue;
    }
    let found = false;
    let formMacro = '';
    for (const declarator of declaration.declarations) {
      const macro = macroOf(declarator.init);
      const made = macro === undefined ? undefined : FORMS.get(macro);
      if (macro === undefined || made === undefined) {
        if (declarator.init) {
          reject(declarator.init);
        }
        continue;
      }
      formMacro = macro;
      if (declarator.id.type !== 'Identifier') {
        // The forms of a component keep the errors that they have there.
        if (macro !== '$signal' && macro !== '$memo') {
          throw new ModuleError(`${macro} cannot be destructured`, declarator.id.start);
        }
        throw topLevelError(
          macro,
          ' at the top level with a pattern',
          advice(macro),
          declarator.start,
        );
      }
      if (declaration.declarations.length > 1) {
        throw topLevelError(
          macro,
          ' at the top level beside other declarations',
          advice(macro),
          declaration.start,
        );
      }
      // A value that handlers write is declared with let, as in a component.
      const expected = macro === '$optimistic' ? 'let' : 'const';
      if (macro !== '$signal' && declaration.kind !== expected) {
        if (macro !== '$memo') {
          throw new ModuleError(`Declare ${macro} with ${expected}`, declaration.start);
        }
        throw topLevelError(
          macro,
          ` at the top level with ${declaration.kind}`,
          advice(macro),
          declaration.start,
        );
      }
      signals.set(declarator.id.name, {
        kind: made,
        form: macro,
        ...(macro === '$optimistic' ? { optimistic: true } : {}),
        binding: scriptModule ? `${PREFIX}${declarator.id.name}` : declarator.id.name,
        ...(statement === declaration ? {} : { exported: declarator.id.name }),
      });
      found = true;
    }
    if (found) {
      declarations.push({
        declaration,
        exported: statement === declaration ? undefined : statement,
        macro: formMacro,
      });
    }
  }
  if (signals.size === 0) {
    return undefined;
  }
  // `export { name }` exports a signal after the fact.
  for (const statement of program.body) {
    if (
      statement.type === 'ExportNamedDeclaration' &&
      !statement.declaration &&
      !statement.source
    ) {
      for (const specifier of statement.specifiers) {
        const local = specifier.local.type === 'Identifier' ? specifier.local.name : '';
        const signal = signals.get(local);
        if (signal) {
          signal.exported =
            specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : specifier.exported.value;
        }
      }
    }
  }

  // The parent of each node, to tell a write from a read.
  const parents = linkParents(program as oxc.Node);

  const edits: Edit[] = [];
  let usesStore = false;
  let usesDerived = false;
  let usesProduce = false;
  let usesGated = false;
  let usesTimed = false;
  let usesOptimistic = false;
  /** The imports of signals of other modules, by module and name, shared by every memo. */
  const dependencies = new Map<string, { local: string; line: string }>();
  const functions = topLevelFunctions(program);
  const own: Walk = { path, signals, functions, imports: ownImports };
  const contexts = new Map<string, Walk>();

  /** The context of another module, to follow the helpers that a memo calls in it. */
  function contextOf(specifier: string, name: string, from: string | undefined, at: number): Walk {
    const module = from === undefined ? undefined : resolve(specifier, from);
    if (!module) {
      throw topLevelError(
        name,
        ' because the memo cannot follow it',
        'Pass the signals that it reads as arguments, as in "$memo(total(items))"',
        at,
      );
    }
    let context = contexts.get(module.path);
    if (!context) {
      const inner = parseModule(module).program;
      const innerPlan = planModuleSignals(inner, module.source, false, module.path, resolve);
      context = {
        path: module.path,
        signals: innerPlan?.signals ?? new Map(),
        functions: topLevelFunctions(inner),
        imports: importsOf(inner),
      };
      contexts.set(module.path, context);
    }
    return context;
  }

  /** Finds the signals that an expression reads, through the functions that it calls. */
  function memoSources(argument: oxc.Node, reads: string[], stores: string[]): void {
    const seen = new Set<oxc.Node>();
    function add(context: Walk, name: string, at: number): void {
      const signal = context.signals.get(name)!;
      if (context === own) {
        if (!reads.includes(name)) {
          reads.push(name);
          stores.push(signal.binding);
        }
        return;
      }
      // A signal of another module comes in under its own import.
      let target: { specifier: string; name: string } | undefined;
      if (signal.from) {
        target = { specifier: signal.from.specifier, name: signal.from.name };
      } else if (signal.exported) {
        target = { specifier: `./${context.path!.split('/').pop()}`, name: signal.exported };
      }
      if (!target) {
        throw topLevelError(
          name,
          ' because the memo cannot follow it',
          `Export it from ${context.path!.split('/').pop()}, so this module can read it`,
          at,
        );
      }
      const specifier = relocate(target.specifier, context.path!, path!);
      const key = `${specifier}#${target.name}`;
      let dependency = dependencies.get(key);
      if (!dependency) {
        const local = `$$dep_${target.name}_${dependencies.size}`;
        dependency = {
          local,
          line: `import { ${target.name} as ${local} } from '${specifier}';`,
        };
        dependencies.set(key, dependency);
      }
      // Each memo lists the store once, whichever memo imported it first.
      if (!reads.includes(dependency.local)) {
        reads.push(dependency.local);
        stores.push(dependency.local);
      }
    }
    function walk(node: oxc.Node, context: Walk): void {
      forEachReference(node, (identifier) => {
        const name = identifier.name;
        if (context === own && isUntracked(identifier)) {
          return;
        }
        if (context.signals.has(name)) {
          add(context, name, identifier.start);
          return;
        }
        const helper = context.functions.get(name);
        if (helper) {
          if (!seen.has(helper)) {
            seen.add(helper);
            walk(helper, context);
          }
          return;
        }
        const from = context.imports.get(name);
        if (from && from.specifier.startsWith('.') && isReactiveModule(from.specifier)) {
          const inner = contextOf(from.specifier, name, context.path, identifier.start);
          const helperNode = inner.functions.get(from.imported);
          if (!helperNode) {
            // An import that is not a function, or a signal that the module does not declare.
            if (!inner.signals.has(from.imported)) {
              throw topLevelError(
                name,
                ' because the memo cannot follow it',
                'Pass the signals that it reads as arguments, as in "$memo(total(items))"',
                identifier.start,
              );
            }
            return;
          }
          if (!seen.has(helperNode)) {
            seen.add(helperNode);
            walk(helperNode, inner);
          }
        }
      });
    }
    walk(argument, own);
  }
  // `$untrack(expr)` reads without tracking: the call compiles to its argument, and the signals it
  // reads are not sources of a memo.
  const untracked: { start: number; end: number }[] = [];
  function findUntracked(node: oxc.Node): void {
    if (macroOf(node) === '$untrack') {
      const call = node as oxc.CallExpression;
      if (call.arguments.length !== 1 || call.arguments[0]!.type === 'SpreadElement') {
        throw topLevelError(
          '$untrack',
          ' with other than one expression',
          'Write one expression, as in "$untrack(input.length)"',
          call.start,
        );
      }
      untracked.push({ start: call.start, end: call.end });
      edits.push({ start: call.callee.start, end: call.callee.end, text: '' });
    }
    for (const [, child] of children(node)) {
      findUntracked(child);
    }
  }
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') {
      findUntracked(statement);
    }
  }
  function isUntracked(node: oxc.Node): boolean {
    for (const range of untracked) {
      if (node.start >= range.start && node.end <= range.end) {
        return true;
      }
    }
    return false;
  }
  // The arguments of memos, where parameters give the values and nothing else changes.
  const memoArguments: oxc.Node[] = [];
  /** The names that each memo gets as parameters. */
  const memoReads = new Map<oxc.Node, string[]>();
  for (const { declaration, exported, macro } of declarations) {
    const declarator = declaration.declarations[0]!;
    const call = declarator.init as oxc.CallExpression;
    const name = (declarator.id as oxc.IdentifierName).name;
    const signal = signals.get(name)!;
    // `let` becomes `const`: the binding holds the store for good.
    edits.push({
      start: declaration.start,
      end: declaration.start + declaration.kind.length,
      text: 'const',
    });
    if (scriptModule) {
      edits.push({ start: declarator.id.start, end: declarator.id.end, text: signal.binding });
      // `export let x` gives the store the name `x` again, for importers of the file.
      if (exported) {
        edits.push({ start: exported.start, end: declaration.start, text: '' });
        edits.push({
          start: declaration.end,
          end: declaration.end,
          text: ` export { ${signal.binding} as ${name} };`,
        });
      }
    }
    if (macro === '$signal') {
      usesStore = true;
      edits.push({ start: call.callee.start, end: call.callee.end, text: STORE });
      continue;
    }
    if (macro === '$optimistic') {
      // `$optimistic(source)` follows the store of a module memo. The errors are those of a component.
      const [source] = call.arguments;
      if (!source) {
        throw new ModuleError(`${macro} needs a value`, call.start);
      }
      if (call.arguments.length > 1) {
        throw new ModuleError(`${macro} takes one argument`, call.start);
      }
      if (source.type !== 'Identifier') {
        throw new ModuleError(
          '$optimistic needs the name of a value, such as a memo',
          source.start,
        );
      }
      const followed = signals.get(source.name);
      if (followed?.kind === 'signal') {
        throw new ModuleError(
          '$optimistic follows a memo, an action or a prop, not a signal',
          source.start,
        );
      }
      if (!followed) {
        throw topLevelError(
          '$optimistic',
          ' with a source that is no memo of a module',
          'Follow a memo that the module declares or imports, as in "let shown = $optimistic(list)"',
          source.start,
        );
      }
      usesOptimistic = true;
      edits.push({ start: call.callee.start, end: call.callee.end, text: OPTIMISTIC });
      // The store of the memo, not its value.
      edits.push({ start: source.start, end: source.end, text: followed.binding });
      memoArguments.push(source);
      continue;
    }
    const [argument, extra] = call.arguments;
    const count = macro === '$memo' ? 1 : 2;
    // The forms of a component keep the errors that they have there, and so their codes.
    if (macro === '$memo') {
      if (!argument || call.arguments.length !== 1 || argument.type === 'SpreadElement') {
        throw topLevelError(
          macro,
          ' at the top level with other than one argument',
          advice(macro),
          call.start,
        );
      }
    } else if (macro === '$gate') {
      if (
        !argument ||
        argument.type === 'SpreadElement' ||
        call.arguments.length !== count ||
        (extra?.type !== 'ArrowFunctionExpression' && extra?.type !== 'FunctionExpression')
      ) {
        throw new ModuleError(
          '$gate takes a value and a function, as in $gate(value, (prev, next) => next > prev)',
          call.start,
        );
      }
    } else {
      if (!argument || argument.type === 'SpreadElement' || call.arguments.length !== count) {
        throw new ModuleError(`${macro} takes a value and a wait in milliseconds`, call.start);
      }
      const ms = extra?.type === 'Literal' && typeof extra.value === 'number' ? extra.value : NaN;
      // A timer cannot wait longer than 2^31 - 1 ms, and fires at once for a longer wait.
      if (!(ms >= 0 && ms <= 2147483647)) {
        throw new ModuleError(
          `The wait of ${macro} must be a number of milliseconds, such as 300`,
          extra?.start ?? call.start,
        );
      }
    }
    // A memo awaits as in a component. The other forms take a value that is ready.
    let awaits = false;
    function findAwait(node: oxc.Node): void {
      if (node.type === 'AwaitExpression') {
        if (macro === '$memo') {
          awaits = true;
          return;
        }
        if (macro === '$gate') {
          throw new ModuleError(
            '$gate takes a value that is ready. Use $memo for a promise or a server function',
            node.start,
          );
        }
        throw topLevelError(
          macro,
          ' at the top level with await',
          'Keep the loaded value in a $signal, or read it in a component with $memo',
          node.start,
        );
      }
      if (!isScope(node)) {
        for (const [, child] of children(node)) {
          findAwait(child);
        }
      }
    }
    findAwait(argument);
    memoArguments.push(argument);
    // The module signals that the expression reads, and that the functions it calls read, are
    // the sources. Parameters of the same names give their values, so the expression stays as is.
    const reads: string[] = [];
    const stores: string[] = [];
    memoSources(argument, reads, stores);
    memoReads.set(argument, reads);
    // The callee, the type arguments and the opening parenthesis become the sources and the
    // function. The closing parenthesis of the function goes before that of the call, or before
    // the next argument.
    const typed = (call as { typeArguments?: oxc.Node }).typeArguments;
    const open = source.indexOf('(', typed?.end ?? call.callee.end);
    let helper = TIMED;
    if (macro === '$memo') {
      helper = DERIVED;
    } else if (macro === '$gate') {
      helper = GATED;
    }
    usesGated ||= macro === '$gate';
    usesTimed ||= macro === '$debounced' || macro === '$throttled';
    usesDerived ||= macro === '$memo';
    if (awaits) {
      signal.awaits = true;
    }
    edits.push({
      start: call.callee.start,
      end: open + 1,
      text: `${helper}([${stores.join(', ')}], ${awaits ? 'async ' : ''}([${reads.join(', ')}]) => (`,
    });
    if (macro === '$memo') {
      edits.push({ start: call.end - 1, end: call.end - 1, text: ')' });
    } else {
      edits.push({ start: argument.end, end: argument.end, text: ')' });
      if (macro === '$throttled') {
        edits.push({ start: extra!.end, end: extra!.end, text: ', true' });
      }
    }
  }

  // Reads and writes in the code of the module.
  /** True where a parameter of the memo holds the value, so the name stays as it is. */
  function insideMemo(node: oxc.Node): boolean {
    for (const argument of memoArguments) {
      if (node.start >= argument.start && node.end <= argument.end) {
        // An untracked read is not a parameter, unless the memo also reads the name as a source.
        return (
          !isUntracked(node) ||
          !!memoReads.get(argument)?.includes((node as oxc.IdentifierName).name)
        );
      }
    }
    return false;
  }
  function rewrite(identifier: oxc.IdentifierReference, shorthand: boolean): void {
    const signal = signals.get(identifier.name);
    if (!signal || insideMemo(identifier) || inType(identifier, parents)) {
      return;
    }
    if (inPattern(identifier, parents)) {
      throw topLevelError(
        identifier.name,
        ' in a destructuring write',
        `Write it with an assignment of its own, as in "${identifier.name} = value"`,
        identifier.start,
      );
    }
    const store = signal.binding;
    const update = parents.get(identifier);
    if (signal.optimistic && update?.type === 'UpdateExpression') {
      throw new ModuleError(
        `Assign to "${identifier.name}" with = instead of ${update.operator}`,
        update.start,
      );
    }
    const written = rewriteWrite(identifier, store, { source, parents, macros }, edits);
    if (written !== undefined) {
      if (signal.from) {
        throw new ModuleError(
          importWrite(identifier.name, signal.from.specifier),
          identifier.start,
        );
      }
      if (signal.kind === 'memo') {
        throw new ModuleError(MEMO_WRITE(identifier.name), identifier.start);
      }
      usesProduce ||= written;
      return;
    }
    edits.push({
      start: identifier.start,
      end: identifier.end,
      text: shorthand ? `${identifier.name}: ${store}.get()` : `${store}.get()`,
    });
  }
  for (const statement of program.body) {
    if (
      statement.type === 'ImportDeclaration' ||
      statement.type === 'ExportAllDeclaration' ||
      (statement.type === 'ExportNamedDeclaration' && !statement.declaration) ||
      statement.type.startsWith('TS')
    ) {
      continue;
    }
    forEachReference(statement, rewrite);
  }

  const header: string[] = [];
  const names: string[] = [];
  if (usesStore) {
    names.push(`store as ${STORE}`);
  }
  if (usesDerived) {
    names.push(`${HELD} as ${DERIVED}`);
  }
  if (usesGated) {
    names.push(`gated as ${GATED}`);
  }
  if (usesTimed) {
    names.push(`timed as ${TIMED}`);
  }
  if (names.length > 0) {
    header.push(`import { ${names.join(', ')} } from '${STORE_MODULE}';`);
  }
  const client: string[] = [];
  if (usesProduce) {
    client.push(`produce as ${PRODUCE}`);
  }
  if (usesOptimistic) {
    client.push(`optimisticStore as ${OPTIMISTIC}`);
  }
  if (client.length > 0) {
    header.push(`import { ${client.join(', ')} } from '${CLIENT_MODULE}';`);
  }
  for (const { line } of dependencies.values()) {
    header.push(line);
  }
  return { edits, signals, header: header.join(' ') };
}

/** Applies edits to a source, and tells where each offset of the result comes from. */
export function applyEdits(
  source: string,
  edits: Edit[],
): { text: string; origin: (offset: number) => number } {
  const sorted = edits.toSorted((a, b) => a.start - b.start || a.end - b.end);
  // Each piece: where it starts in the result, and the offset that it maps to.
  const pieces: { start: number; length: number; from: number; linear: boolean }[] = [];
  let text = '';
  let position = 0;
  for (const edit of sorted) {
    if (edit.start < position) {
      continue;
    }
    const kept = source.slice(position, edit.start);
    pieces.push({ start: text.length, length: kept.length, from: position, linear: true });
    text += kept;
    pieces.push({ start: text.length, length: edit.text.length, from: edit.start, linear: false });
    text += edit.text;
    position = edit.end;
  }
  const rest = source.slice(position);
  pieces.push({ start: text.length, length: rest.length, from: position, linear: true });
  text += rest;
  return {
    text,
    origin(offset) {
      let low = 0;
      let high = pieces.length - 1;
      while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (pieces[middle]!.start <= offset) {
          low = middle;
        } else {
          high = middle - 1;
        }
      }
      const piece = pieces[low]!;
      return piece.linear ? piece.from + Math.min(offset - piece.start, piece.length) : piece.from;
    },
  };
}

function parseTypeScript(module: ReactiveModule): oxc.Program {
  const result = parseSync(module.path, module.source, { lang: 'ts', preserveParens: false });
  const error = result.errors[0];
  if (error) {
    throw new ModuleError(`${error.message} (${module.path})`, 0);
  }
  return result.program;
}

const found = new WeakMap<ReactiveModule, Map<string, ModuleSignal>>();

/**
 * The signals and memos that a module exports, by exported name. Empty for a module that has none,
 * and for one that does not parse.
 */
export function findModuleSignals(
  module: ReactiveModule,
  resolve: ResolveModule = resolveFromDisk,
): Map<string, ModuleSignal> {
  let result = found.get(module);
  if (!result) {
    result = new Map();
    if (module.path.endsWith('.brm')) {
      // A component: the signals of its `<script module>`, which it exports under their names.
      try {
        const file = parse(module.source, { filename: module.path });
        if (file.moduleScript) {
          const plan = planModuleSignals(
            file.moduleScript.program,
            module.source,
            true,
            module.path,
            resolve,
          );
          for (const signal of plan?.signals.values() ?? []) {
            if (signal.exported && !signal.from) {
              result.set(signal.exported, signal);
            }
          }
        }
      } catch {
        // The compile of the component reports the error.
      }
    } else if (module.source.includes(SIGNALS_MODULE)) {
      try {
        const plan = planModuleSignals(
          parseTypeScript(module),
          module.source,
          false,
          module.path,
          resolve,
        );
        for (const signal of plan?.signals.values() ?? []) {
          if (signal.exported && !signal.from) {
            result.set(signal.exported, signal);
          }
        }
      } catch {
        // The transform of the module reports the error.
      }
    }
    found.set(module, result);
  }
  return result;
}

/** The code of a module with its signals and memos compiled, or undefined when it has none. */
export function transformModuleSignals(
  module: ReactiveModule,
  resolve: ResolveModule = resolveFromDisk,
): string | undefined {
  if (!module.source.includes(SIGNALS_MODULE)) {
    return undefined;
  }
  const program = parseTypeScript(module);
  const plan = planModuleSignals(program, module.source, false, module.path, resolve);
  if (!plan) {
    return undefined;
  }
  const { text } = applyEdits(module.source, plan.edits);
  return `${plan.header}\n${text}`;
}

/** A name of a component that reads a module signal. */
export interface SignalName {
  /** The module that the name is imported from. Undefined for a signal of `<script module>`. */
  specifier?: string;
  memo: boolean;
}

/** What a component looks like after its module signals compile. */
export interface SignalExpansion {
  source: string;
  /** The offset of the old source that an offset of the new one comes from. */
  origin: (offset: number) => number;
  /** The names of the variables that read a module signal, by the module that holds it. */
  names: Map<string, SignalName>;
  /** The modules whose signals the component imports. */
  modules: ReactiveModule[];
}

function escapePattern(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The offset after the opening tag of a script. */
function afterTag(source: string, start: number): number {
  return start + source.slice(start).indexOf('>') + 1;
}

/**
 * Compiles the module signals of a component. Those of its `<script module>` get a store of their
 * own, and the instance script reads them like `$store`. The names that it imports from a module
 * with signals do the same. Returns undefined when it has none.
 */
export function expandSignals(
  file: SFCFile,
  path: string,
  resolve: ResolveModule,
  fromModule: (offset: number) => boolean = () => false,
): SignalExpansion | undefined {
  const source = file.source;
  const edits: Edit[] = [];
  const names = new Map<string, SignalName>();
  const modules: ReactiveModule[] = [];
  const declarations: string[] = [];

  // `<script module>`.
  const moduleScript = file.moduleScript;
  let own: SignalPlan | undefined;
  if (moduleScript) {
    own = planModuleSignals(moduleScript.program, source, true, path, resolve);
  }
  if (moduleScript && own) {
    edits.push(...own.edits);
    if (own.header) {
      edits.push({
        start: afterTag(source, moduleScript.start),
        end: afterTag(source, moduleScript.start),
        text: `\n${own.header}`,
      });
    }
  }

  // The names that the instance script imports from a module with signals.
  const program = file.instanceScript?.program;
  const imported: { local: string; imported: string; specifier: string; kind: string }[] = [];
  if (program) {
    for (const statement of program.body) {
      if (statement.type !== 'ImportDeclaration') {
        continue;
      }
      const specifier = statement.source.value;
      const reactive =
        isReactiveModule(specifier) ||
        specifier.endsWith('.brm') ||
        (!specifier.startsWith('.') &&
          specifier !== SIGNALS_MODULE &&
          isReactiveModule(resolve(specifier, path)?.path ?? ''));
      if (!reactive) {
        continue;
      }
      const module = resolve(specifier, path);
      if (!module) {
        continue;
      }
      const exports = findModuleSignals(module, resolve);
      for (const item of statement.specifiers) {
        if (item.type !== 'ImportSpecifier') {
          continue;
        }
        const name = item.imported.type === 'Identifier' ? item.imported.name : item.imported.value;
        const signal = exports.get(name);
        if (!signal) {
          continue;
        }
        if (!modules.includes(module)) {
          modules.push(module);
        }
        imported.push({ local: item.local.name, imported: name, specifier, kind: signal.kind });
        names.set(item.local.name, { specifier, memo: signal.kind === 'memo' });
        edits.push({
          start: item.start,
          end: item.end,
          text: `${name} as ${PREFIX}${item.local.name}`,
        });
        declarations.push(
          readSignal(item.local.name, `${PREFIX}${item.local.name}`, signal, false),
        );
      }
    }
  }

  // The signals of `<script module>` that the rest of the file reads.
  if (moduleScript && own) {
    const outside = source.slice(0, moduleScript.start) + source.slice(moduleScript.end);
    const taken = new Set<string>();
    for (const statement of program?.body ?? []) {
      if (statement.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations) {
          for (const id of getPatternNames(declarator.id)) {
            taken.add(id.name);
          }
        }
      } else if (
        (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
        statement.id
      ) {
        taken.add(statement.id.name);
      }
    }
    for (const [name, signal] of own.signals) {
      if (
        signal.from ||
        taken.has(name) ||
        !new RegExp(`(?<![\\w$.])${escapePattern(name)}(?![\\w$])`).test(outside)
      ) {
        continue;
      }
      names.set(name, { memo: signal.kind === 'memo' });
      declarations.push(readSignal(name, signal.binding, signal, true));
    }
  }

  // A module function that a component copies writes a module signal through its store.
  const writable = new Map<string, string>();
  for (const item of imported) {
    if (item.kind === 'signal') {
      writable.set(item.local, `${PREFIX}${item.local}`);
    }
  }
  if (writable.size > 0 && program) {
    const macros = macroNames(program);
    let produce = false;
    for (const script of scripts(file)) {
      const parents = linkParents(script as oxc.Node);
      forEachReference(script, (identifier) => {
        const store = writable.get(identifier.name);
        if (!store || !fromModule(identifier.start) || inType(identifier, parents)) {
          return;
        }
        produce ||= rewriteWrite(identifier, store, { source, parents, macros }, edits) === true;
      });
    }
    if (produce) {
      declarations.unshift(`import { produce as ${PRODUCE} } from '${CLIENT_MODULE}';`);
    }
  }
  if (declarations.length === 0 && !(own && edits.length > 0)) {
    return undefined;
  }
  if (declarations.length > 0) {
    const body = declarations.join('\n');
    const memo = body.includes(`${MEMO}(`) ? `, $memo as ${MEMO}` : '';
    const text = `import { $store as ${READ}${memo} } from '${SIGNALS_MODULE}';\n${body}`;
    if (file.instanceScript && program) {
      // After the imports, which can use the names that the declarations read.
      let at = afterTag(source, file.instanceScript.start);
      for (const statement of program.body) {
        if (statement.type === 'ImportDeclaration') {
          at = Math.max(at, statement.end);
        }
      }
      edits.push({ start: at, end: at, text: `\n${text}` });
    } else {
      const at = moduleScript?.end ?? 0;
      edits.push({ start: at, end: at, text: `\n<script>\n${text}\n</script>\n` });
    }
  }
  const applied = applyEdits(source, edits);
  return { source: applied.text, origin: applied.origin, names, modules };
}

/** A module signal that a plain file imports, by the name that the file gives it. */
export interface SignalImport {
  /** The name in the module. */
  name: string;
  start: number;
  end: number;
  specifier: string;
}

/**
 * The module signals that a script file imports from a module. A plain `.ts` file gets the store
 * object, while TypeScript says that the value is its type.
 */
export function findSignalImports(
  source: string,
  file: string,
  resolve: ResolveModule,
): SignalImport[] {
  if (!source.includes('.brm.')) {
    return [];
  }
  const result = parseSync(file, source, { lang: /\.[cm]?js$/.test(file) ? 'js' : 'ts' });
  if (result.errors.length > 0) {
    return [];
  }
  const imports: SignalImport[] = [];
  for (const statement of result.program.body) {
    if (statement.type !== 'ImportDeclaration' || !isReactiveModule(statement.source.value)) {
      continue;
    }
    const module = resolve(statement.source.value, file);
    if (!module) {
      continue;
    }
    const exports = findModuleSignals(module, resolve);
    for (const item of statement.specifiers) {
      if (item.type !== 'ImportSpecifier') {
        continue;
      }
      const name = item.imported.type === 'Identifier' ? item.imported.name : item.imported.value;
      if (exports.has(name)) {
        imports.push({ name, start: item.start, end: item.end, specifier: statement.source.value });
      }
    }
  }
  return imports;
}
