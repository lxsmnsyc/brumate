// Reactive logic in modules. A `.brm.ts` module exports functions that use
// compile-time functions, such as `$signal`. A component calls one at the top
// level of a script and destructures what it returns:
//
//   const { count, increment } = counter(5);
//
// The compiler copies the body of the function in place of the call, before
// it analyzes the component. Its signals and memos become values of the
// component, so the graph stays static and nothing else changes.
//
// - Locals of the function get new names, so they cannot clash with names of
//   the component. What it returns takes the names of the destructuring.
// - A parameter whose argument is a name reads that name, so a signal passed
//   in stays reactive. Other arguments become constants.
// - Names that the function reads from its module are imported into the
//   component, from paths relative to the component.

import { parseSync } from 'oxc-parser';
import type { SFCFile } from './ast.ts';
import { MACROS, SIGNALS_MODULE } from './macros.ts';
import { builtin } from './node.ts';
import { children, getPatternNames } from './oxc.ts';
import type { oxc } from './oxc.ts';
import { forEachNode } from './project.ts';

/** A module of reactive logic, read by its path. */
export interface ReactiveModule {
  /** The absolute path of the module. */
  path: string;
  source: string;
}

/** Finds a module that a file imports, or returns undefined if it cannot. */
export type ResolveModule = (specifier: string, importer: string) => ReactiveModule | undefined;

/** True for the specifier of a module of reactive logic, such as `./counter.brm.ts`. */
export function isReactiveModule(specifier: string): boolean {
  return /\.brm\.[cm]?[jt]s$/.test(specifier);
}

/** Reads a module next to the importer from the file system, where there is one. */
export const resolveFromDisk: ResolveModule = (specifier, importer) => {
  const fs = builtin('node:fs');
  const path = builtin('node:path');
  if (!fs || !path || !specifier.startsWith('.')) {
    return undefined;
  }
  const file = path.resolve(path.dirname(importer), specifier);
  try {
    return { path: file, source: fs.readFileSync(file, 'utf8') };
  } catch {
    return undefined;
  }
};

/** Where an offset of the expanded source comes from. */
export interface Origin {
  /** The module that the code comes from, or undefined for the component. */
  module?: ReactiveModule;
  /** The offset in the component, or in the module. */
  offset: number;
  /** The call in the component that the code of a module replaces. */
  call?: { start: number; end: number };
  /** True for code of a module function that another module function calls. */
  nested?: boolean;
}

/** The source of a component with its calls of module functions replaced. */
export interface Expansion {
  source: string;
  origin: (offset: number) => Origin;
  /** The modules that the component reads, so a change to one compiles it again. */
  modules: ReactiveModule[];
  /** Each call, by the offset of its statement in the source before this expansion. */
  calls: ModuleCall[];
}

/** What a name of a module function is in the component that calls it. */
export type CallName = { name: string } | { literal: string };

/** A call of a module function, and what each name of the function became. */
export interface ModuleCall {
  /** The offset of the statement of the call. */
  start: number;
  /** The path of the module. */
  module: string;
  /** The name of the function. */
  fn: string;
  names: Map<string, CallName>;
}

/** True for an argument that can be written into the code as it is, such as `'name'` or `-1`. */
function isLiteral(node: oxc.Node): boolean {
  if (node.type === 'Literal') {
    return !('regex' in node && node.regex);
  }
  if (node.type === 'TemplateLiteral') {
    return node.expressions.length === 0;
  }
  return (
    node.type === 'UnaryExpression' &&
    (node.operator === '-' || node.operator === '+') &&
    node.argument.type === 'Literal' &&
    typeof node.argument.value === 'number'
  );
}

/** The names that code assigns to, such as `start` in `start = 1` or `start++`. */
function assignedNames(node: oxc.Node, names: Set<string> = new Set()): Set<string> {
  if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
    names.add(node.left.name);
  } else if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier') {
    names.add(node.argument.name);
  }
  for (const [, child] of children(node)) {
    assignedNames(child, names);
  }
  return names;
}

/** An error in a module function or in a call of one. */
export class ModuleError extends Error {
  /** The offset in the component of the call that the error is about. */
  readonly offset: number;

  constructor(message: string, offset: number) {
    super(message);
    this.name = 'ModuleError';
    this.offset = offset;
  }
}

interface Piece {
  /** The offset of the piece in the expanded source. */
  start: number;
  length: number;
  origin: Origin;
  /** True when each character maps to the next one of the origin, as for copied code. */
  linear: boolean;
}

/** Builds the expanded source, and remembers where each piece comes from. */
class Builder {
  text = '';
  readonly pieces: Piece[] = [];

  add(text: string, origin: Origin, linear: boolean): void {
    if (text) {
      this.pieces.push({ start: this.text.length, length: text.length, origin, linear });
      this.text += text;
    }
  }

  origin(offset: number): Origin {
    let low = 0;
    let high = this.pieces.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.pieces[middle]!.start <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    const piece = this.pieces[low];
    if (!piece) {
      return { offset };
    }
    const delta = piece.linear ? Math.min(offset - piece.start, piece.length) : 0;
    return { ...piece.origin, offset: piece.origin.offset + delta };
  }
}

export interface ModuleInfo {
  module: ReactiveModule;
  program: oxc.Program;
  /** Imports by local name. `imported` is the exported name, `default` or `*`. */
  imports: Map<string, { specifier: string; imported: string }>;
  /** Names declared at the top level, with the name each is exported as, if it is. */
  declarations: Map<string, string | undefined>;
  /** Exported functions of reactive logic, by exported name. */
  functions: Map<string, oxc.Function | oxc.ArrowFunctionExpression>;
}

export function parseModule(module: ReactiveModule): ModuleInfo {
  const result = parseSync(module.path, module.source, { lang: 'ts', preserveParens: false });
  const error = result.errors[0];
  if (error) {
    throw new ModuleError(`${error.message} (${module.path})`, 0);
  }
  const program = result.program;
  const imports = new Map<string, { specifier: string; imported: string }>();
  const declarations = new Map<string, string | undefined>();
  const functions = new Map<string, oxc.Function | oxc.ArrowFunctionExpression>();
  const declare = (node: oxc.Node, exported: boolean): void => {
    switch (node.type) {
      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          for (const id of getPatternNames(declarator.id)) {
            declarations.set(id.name, exported ? id.name : undefined);
          }
          const init = declarator.init;
          if (
            exported &&
            declarator.id.type === 'Identifier' &&
            (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression')
          ) {
            functions.set(declarator.id.name, init);
          }
        }
        break;
      case 'FunctionDeclaration':
        if (node.id) {
          declarations.set(node.id.name, exported ? node.id.name : undefined);
          if (exported) {
            functions.set(node.id.name, node);
          }
        }
        break;
      case 'ClassDeclaration':
      case 'TSInterfaceDeclaration':
      case 'TSTypeAliasDeclaration':
      case 'TSEnumDeclaration':
        if (node.id) {
          declarations.set(node.id.name, exported ? node.id.name : undefined);
        }
        break;
      default:
        break;
    }
  };
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) {
        let imported: string;
        if (specifier.type === 'ImportDefaultSpecifier') {
          imported = 'default';
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          imported = '*';
        } else {
          imported =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
        }
        imports.set(specifier.local.name, { specifier: statement.source.value, imported });
      }
    } else if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
      declare(statement.declaration, true);
    } else {
      declare(statement, false);
    }
  }
  // `export { name }` exports a declaration after the fact.
  for (const statement of program.body) {
    if (
      statement.type === 'ExportNamedDeclaration' &&
      !statement.declaration &&
      !statement.source
    ) {
      for (const specifier of statement.specifiers) {
        const local = specifier.local.type === 'Identifier' ? specifier.local.name : '';
        const exported =
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value;
        if (declarations.has(local)) {
          declarations.set(local, exported);
        }
      }
    }
  }
  return { module, program, imports, declarations, functions };
}

/** Joins and normalizes paths with `/`. */
function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') {
      parts.pop();
    } else if (part !== '.' && part !== '') {
      parts.push(part);
    } else if (part === '' && parts.length === 0) {
      parts.push('');
    }
  }
  return parts.join('/');
}

function directory(path: string): string {
  return path.slice(0, path.lastIndexOf('/') + 1);
}

/** A specifier of the module, relative to the component. Package names stay as they are. */
export function relocate(specifier: string, module: string, component: string): string {
  if (!specifier.startsWith('.')) {
    return specifier;
  }
  const target = normalize(`${directory(module)}${specifier}`).split('/');
  const from = normalize(directory(component)).split('/').filter(Boolean);
  let common = 0;
  const to = target.filter(Boolean);
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) {
    common++;
  }
  const up = from.slice(common).map(() => '..');
  const rest = to.slice(common);
  const result = [...up, ...rest].join('/');
  return result.startsWith('.') ? result : `./${result}`;
}

/**
 * Scope-aware renaming. Walks a node and calls `visit` for each identifier
 * that reads or writes a name, with the scopes of names declared inside the
 * node, so a name that a nested function or block declares again is left alone.
 */
export function forEachReference(
  node: oxc.Node,
  visit: (identifier: oxc.IdentifierReference, shorthand: boolean) => void,
  shadowed: Set<string> = new Set(),
): void {
  const declaredIn = (statements: oxc.Node[]): Set<string> => {
    const names = new Set(shadowed);
    for (const statement of statements) {
      if (statement.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations) {
          for (const id of getPatternNames(declarator.id)) {
            names.add(id.name);
          }
        }
      } else if (
        (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
        statement.id
      ) {
        names.add(statement.id.name);
      }
    }
    return names;
  };
  const walk = (current: oxc.Node, scope: Set<string>): void => {
    switch (current.type) {
      case 'Identifier': {
        const identifier = current as oxc.IdentifierReference;
        if (!scope.has(identifier.name)) {
          visit(identifier, false);
        }
        return;
      }
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        const inner = new Set(scope);
        for (const param of current.params) {
          for (const id of getPatternNames(
            param.type === 'TSParameterProperty' ? param.parameter : param,
          )) {
            inner.add(id.name);
          }
        }
        if (current.type === 'FunctionExpression' && current.id) {
          inner.add(current.id.name);
        }
        for (const param of current.params) {
          walkPattern(param, inner);
        }
        if (current.body) {
          walk(current.body, current.body.type === 'BlockStatement' ? inner : inner);
        }
        return;
      }
      case 'BlockStatement':
      case 'Program': {
        const inner = declaredIn(current.body);
        for (const name of scope) {
          inner.add(name);
        }
        for (const statement of current.body) {
          walk(statement, inner);
        }
        return;
      }
      case 'CatchClause': {
        const inner = new Set(scope);
        if (current.param) {
          for (const id of getPatternNames(current.param)) {
            inner.add(id.name);
          }
        }
        walk(current.body, inner);
        return;
      }
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement': {
        const head = current.type === 'ForStatement' ? current.init : current.left;
        const inner = head?.type === 'VariableDeclaration' ? declaredIn([head]) : new Set<string>();
        for (const name of scope) {
          inner.add(name);
        }
        for (const [, child] of children(current)) {
          walk(child, inner);
        }
        return;
      }
      case 'VariableDeclarator':
        walkPattern(current.id, scope);
        if (current.init) {
          walk(current.init, scope);
        }
        return;
      case 'MemberExpression':
        walk(current.object, scope);
        if (current.computed) {
          walk(current.property, scope);
        }
        return;
      case 'Property':
        if (current.shorthand && current.value.type === 'Identifier') {
          const identifier = current.value as oxc.IdentifierReference;
          if (!scope.has(identifier.name)) {
            visit(identifier, true);
          }
          return;
        }
        if (current.computed) {
          walk(current.key, scope);
        }
        walk(current.value, scope);
        return;
      case 'MethodDefinition':
      case 'PropertyDefinition':
        if (current.computed) {
          walk(current.key, scope);
        }
        if (current.value) {
          walk(current.value, scope);
        }
        return;
      case 'LabeledStatement':
        walk(current.body, scope);
        return;
      case 'BreakStatement':
      case 'ContinueStatement':
        return;
      default:
        for (const [key, child] of children(current)) {
          // Type annotations name types, which are imported like values.
          if (key !== 'typeAnnotation' || child.type !== 'Identifier') {
            walk(child, scope);
          }
        }
    }
  };
  // A pattern declares names, and its default values read names.
  const walkPattern = (pattern: oxc.Node, scope: Set<string>): void => {
    switch (pattern.type) {
      case 'Identifier':
        if (pattern.typeAnnotation) {
          walk(pattern.typeAnnotation, scope);
        }
        return;
      case 'AssignmentPattern':
        walkPattern(pattern.left, scope);
        walk(pattern.right, scope);
        return;
      case 'ObjectPattern':
        for (const property of pattern.properties) {
          if (property.type === 'RestElement') {
            walkPattern(property.argument, scope);
          } else {
            if (property.computed) {
              walk(property.key, scope);
            }
            walkPattern(property.value, scope);
          }
        }
        return;
      case 'ArrayPattern':
        for (const element of pattern.elements) {
          if (element) {
            walkPattern(element, scope);
          }
        }
        return;
      case 'RestElement':
        walkPattern(pattern.argument, scope);
        return;
      default:
        walk(pattern, scope);
    }
  };
  walk(node, shadowed);
}

/** A call of a module function in a script of the component. */
interface Call {
  statement: oxc.VariableDeclaration;
  call: oxc.CallExpression;
  pattern: oxc.ObjectPattern;
  /** The local name of the function in the component. */
  local: string;
}

/** The scripts of a component: its instance script, and the scripts of its blocks. */
function scripts(file: SFCFile): oxc.Program[] {
  const result: oxc.Program[] = [];
  if (file.instanceScript) {
    result.push(file.instanceScript.program);
  }
  const visit = (nodes: SFCFile['children']): void => {
    forEachNode(nodes, (node) => {
      if ('body' in node && node.body && 'script' in node.body && node.body.script) {
        result.push(node.body.script.program);
      }
    });
  };
  visit(file.children);
  for (const template of file.templates) {
    if (template.body.script) {
      result.push(template.body.script.program);
    }
    visit(template.body.children);
  }
  return result;
}

/**
 * Replaces the calls of module functions in a component with their bodies.
 * Returns undefined when the component calls none. `path` is the path of the
 * component, which relative imports of modules start from.
 */
export function expandModules(
  file: SFCFile,
  path: string,
  resolve: ResolveModule,
): Expansion | undefined {
  const source = file.source;
  const program = file.instanceScript?.program;
  if (!program) {
    return undefined;
  }
  // A specifier of a package, such as `brumate/forms`, names a module when its export is one.
  const reactive = (specifier: string): boolean =>
    isReactiveModule(specifier) ||
    (!specifier.startsWith('.') &&
      specifier !== SIGNALS_MODULE &&
      isReactiveModule(resolve(specifier, path)?.path ?? ''));
  // The module functions that the component imports, by local name.
  const imported = new Map<string, { specifier: string; name: string }>();
  // The local names of compile-time functions in the component.
  const macroNames = new Map<string, string>();
  const topNames = new Set<string>();
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) {
        topNames.add(specifier.local.name);
        if (specifier.type !== 'ImportSpecifier') {
          continue;
        }
        const name =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value;
        if (reactive(statement.source.value)) {
          imported.set(specifier.local.name, { specifier: statement.source.value, name });
        } else if (statement.source.value === SIGNALS_MODULE && MACROS.has(name)) {
          macroNames.set(name, specifier.local.name);
        }
      }
    } else if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        for (const id of getPatternNames(declarator.id)) {
          topNames.add(id.name);
        }
      }
    } else if (
      (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
      statement.id
    ) {
      topNames.add(statement.id.name);
    }
  }
  if (imported.size === 0) {
    return undefined;
  }

  // Each call must be the value of a destructuring at the top level of a script.
  const calls: Call[] = [];
  const allowed = new Set<oxc.Node>();
  for (const script of scripts(file)) {
    for (const statement of script.body) {
      if (statement.type !== 'VariableDeclaration') {
        continue;
      }
      for (const declarator of statement.declarations) {
        const init = declarator.init;
        if (init?.type !== 'CallExpression' || init.callee.type !== 'Identifier') {
          continue;
        }
        if (!imported.has(init.callee.name)) {
          continue;
        }
        if (declarator.id.type !== 'ObjectPattern' || statement.declarations.length !== 1) {
          throw new ModuleError(
            `Destructure what ${init.callee.name} returns, as in const { value } = ${init.callee.name}(…)`,
            init.start,
          );
        }
        if (statement.kind !== 'const') {
          throw new ModuleError(
            `Declare what ${init.callee.name} returns with const`,
            statement.start,
          );
        }
        allowed.add(init);
        calls.push({ statement, call: init, pattern: declarator.id, local: init.callee.name });
      }
    }
  }
  for (const script of scripts(file)) {
    const find = (node: oxc.Node): void => {
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        imported.has(node.callee.name) &&
        !allowed.has(node)
      ) {
        throw new ModuleError(
          `Call ${node.callee.name} at the top level of a script, as in const { value } = ${node.callee.name}(…). Its signals become values of the component, so it cannot run in a function, a condition or a loop`,
          node.start,
        );
      }
      for (const [, child] of children(node)) {
        find(child);
      }
    };
    find(script);
  }
  if (calls.length === 0) {
    return undefined;
  }

  const modules = new Map<string, ModuleInfo>();
  const used = new Set(topNames);
  const unique = (name: string): string => {
    let candidate = name;
    for (let index = 2; used.has(candidate); index++) {
      candidate = `${name}${index}`;
    }
    used.add(candidate);
    return candidate;
  };
  // Imports that the copied code needs, by local name in the component.
  const imports = new Map<string, { specifier: string; imported: string }>();
  const macrosToImport = new Set<string>();

  // The imports that the copied code needs go right after `<script>`. They are known once every call is copied.
  const importsOffset =
    file.instanceScript!.start + source.slice(file.instanceScript!.start).indexOf('>') + 1;

  const expanded: ModuleCall[] = [];

  function inline(call: Call, builder: Builder): void {
    const site = { start: call.statement.start, end: call.statement.end };
    const generated = (text: string): void =>
      builder.add(text, { offset: call.statement.start }, false);
    const { specifier, name } = imported.get(call.local)!;
    const module = resolve(specifier, path);
    if (!module) {
      throw new ModuleError(`Cannot read ${specifier}`, call.call.start);
    }
    let info = modules.get(module.path);
    if (!info) {
      info = parseModule(module);
      modules.set(module.path, info);
    }
    const fn = info.functions.get(name);
    if (!fn) {
      throw new ModuleError(
        `${specifier} does not export a function named ${name}`,
        call.call.start,
      );
    }
    const body = fn.body;
    if (body?.type !== 'BlockStatement') {
      throw new ModuleError(`${name} needs a body that ends with return { … }`, call.call.start);
    }
    const last = body.body.at(-1);
    const returned = last?.type === 'ReturnStatement' ? last.argument : undefined;
    if (returned?.type !== 'ObjectExpression') {
      throw new ModuleError(
        `${name} must end with return { … }, an object of what it gives`,
        call.call.start,
      );
    }
    const checkReturns = (node: oxc.Node): void => {
      if (node === last) {
        return;
      }
      if (node.type === 'ReturnStatement') {
        throw new ModuleError(`${name} can return only at its end`, call.call.start);
      }
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        return;
      }
      for (const [, child] of children(node)) {
        checkReturns(child);
      }
    };
    for (const statement of body.body) {
      checkReturns(statement);
    }

    const origin = (offset: number): Origin => ({ module, offset, call: site });
    const renames = new Map<string, string>();
    // What each name of the function is in the component: a name, or a literal argument.
    const names = new Map<string, CallName>();
    const before: string[] = [];

    // What the component destructures, by the key that the function returns.
    const wanted = new Map<string, string>();
    for (const property of call.pattern.properties) {
      if (
        property.type === 'RestElement' ||
        property.computed ||
        property.key.type !== 'Identifier' ||
        property.value.type !== 'Identifier'
      ) {
        throw new ModuleError(
          `Destructure ${name} with plain names, as in const { value, other: renamed } = ${name}(…)`,
          property.start,
        );
      }
      wanted.set(property.key.name, property.value.name);
    }
    const keys = new Set<string>();
    for (const property of returned.properties) {
      if (
        property.type === 'SpreadElement' ||
        property.computed ||
        property.key.type !== 'Identifier'
      ) {
        throw new ModuleError(`${name} must return an object with plain keys`, call.call.start);
      }
      if (property.kind !== 'init') {
        throw new ModuleError(
          `${name} cannot return getters or setters. Return the values themselves`,
          call.call.start,
        );
      }
      keys.add(property.key.name);
    }
    for (const key of wanted.keys()) {
      if (!keys.has(key)) {
        throw new ModuleError(`${name} does not return ${key}`, call.call.start);
      }
    }

    // Names declared at the top of the body, and the parameters.
    const declared = new Set<string>();
    for (const statement of body.body) {
      if (statement.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations) {
          for (const id of getPatternNames(declarator.id)) {
            declared.add(id.name);
          }
        }
      } else if (
        (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
        statement.id
      ) {
        declared.add(statement.id.name);
      }
    }
    // A returned local takes the name that the component gives it.
    const returnedNames = new Map<string, string>();
    for (const property of returned.properties as oxc.ObjectProperty[]) {
      const key = (property.key as oxc.IdentifierName).name;
      const target = wanted.get(key);
      if (
        target &&
        property.value.type === 'Identifier' &&
        declared.has(property.value.name) &&
        !renames.has(property.value.name)
      ) {
        if (used.has(target) && !topNames.has(target)) {
          throw new ModuleError(`${target} is declared twice`, call.statement.start);
        }
        used.add(target);
        renames.set(property.value.name, target);
        returnedNames.set(key, target);
      }
    }
    for (const local of declared) {
      if (!renames.has(local)) {
        renames.set(local, unique(`${name}_${local}`));
      }
    }

    // A parameter reads its argument in place when the argument is a name, so a signal stays
    // reactive, or a literal, so the value is in the code instead of in the state of the page.
    // A parameter that the function assigns to keeps a local of its own.
    const assigned = assignedNames(body);
    fn.params.forEach((param, index) => {
      const argument = call.call.arguments[index];
      const pattern = param.type === 'AssignmentPattern' ? param.left : param;
      if (pattern.type !== 'Identifier') {
        throw new ModuleError(`Parameters of ${name} must be plain names`, call.call.start);
      }
      if (!assigned.has(pattern.name) && argument?.type === 'Identifier') {
        renames.set(pattern.name, argument.name);
        names.set(pattern.name, { name: argument.name });
        return;
      }
      if (!assigned.has(pattern.name) && argument && isLiteral(argument)) {
        const text = source.slice(argument.start, argument.end);
        renames.set(pattern.name, text);
        names.set(pattern.name, { literal: text });
        return;
      }
      const local = unique(`${name}_${pattern.name}`);
      renames.set(pattern.name, local);
      const declare = assigned.has(pattern.name) ? 'let' : 'const';
      if (argument && argument.type !== 'SpreadElement') {
        before.push(local);
        generated(`${declare} ${local} = (`);
        builder.add(source.slice(argument.start, argument.end), { offset: argument.start }, true);
        generated(');\n');
      } else if (param.type === 'AssignmentPattern') {
        generated(`${declare} ${local} = (`);
        copy(param.right);
        generated(');\n');
      } else {
        generated(`${declare} ${local} = undefined;\n`);
      }
    });

    for (const [local, renamed] of renames) {
      if (!names.has(local)) {
        names.set(local, { name: renamed });
      }
    }
    expanded.push({ start: call.statement.start, module: module.path, fn: name, names });

    // A name of the module that the body reads: imported into the component.
    const moduleName = (local: string): string | undefined => {
      const from = info!.imports.get(local);
      if (from?.specifier === SIGNALS_MODULE && MACROS.has(from.imported)) {
        const existing = macroNames.get(from.imported);
        if (existing) {
          return existing;
        }
        macrosToImport.add(from.imported);
        macroNames.set(from.imported, from.imported);
        used.add(from.imported);
        return from.imported;
      }
      let target: { specifier: string; imported: string } | undefined;
      if (from) {
        target = {
          specifier: relocate(from.specifier, module!.path, path),
          imported: from.imported,
        };
      } else if (info!.declarations.has(local)) {
        const exported = info!.declarations.get(local);
        if (!exported) {
          throw new ModuleError(
            `${name} reads ${local}, which ${specifier} does not export. Export it, so the component can import it`,
            call.call.start,
          );
        }
        target = {
          specifier: relocate(`./${module!.path.split('/').pop()}`, module!.path, path),
          imported: exported,
        };
      }
      if (!target) {
        return undefined;
      }
      for (const [existing, value] of imports) {
        if (value.specifier === target.specifier && value.imported === target.imported) {
          return existing;
        }
      }
      const alias = topNames.has(local) || used.has(local) ? unique(`${name}_${local}`) : local;
      used.add(alias);
      imports.set(alias, target);
      return alias;
    };

    /** Copies code of the module, with its names renamed. */
    function copy(node: oxc.Node): void {
      const edits: { start: number; end: number; text: string }[] = [];
      // The names that a statement at the top of the body declares get their new names too.
      const renameBinding = (id: oxc.Node, shorthand: boolean): void => {
        if (id.type !== 'Identifier') {
          return;
        }
        const renamed = renames.get(id.name);
        if (renamed && renamed !== id.name) {
          edits.push({
            start: id.start,
            end: id.start + id.name.length,
            text: shorthand ? `${id.name}: ${renamed}` : renamed,
          });
        }
      };
      const renamePattern = (pattern: oxc.Node): void => {
        switch (pattern.type) {
          case 'Identifier':
            renameBinding(pattern, false);
            break;
          case 'AssignmentPattern':
            renamePattern(pattern.left);
            break;
          case 'ArrayPattern':
            for (const element of pattern.elements) {
              if (element) {
                renamePattern(element);
              }
            }
            break;
          case 'RestElement':
            renamePattern(pattern.argument);
            break;
          case 'ObjectPattern':
            for (const property of pattern.properties) {
              if (property.type === 'RestElement') {
                renamePattern(property.argument);
              } else if (property.shorthand && property.value.type === 'Identifier') {
                renameBinding(property.value, true);
              } else if (property.shorthand && property.value.type === 'AssignmentPattern') {
                renameBinding(property.value.left, true);
              } else {
                renamePattern(property.value);
              }
            }
            break;
          default:
            break;
        }
      };
      if (node.type === 'VariableDeclaration') {
        for (const declarator of node.declarations) {
          renamePattern(declarator.id);
        }
      } else if (
        (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') &&
        node.id
      ) {
        renameBinding(node.id, false);
      }
      forEachReference(node, (identifier, shorthand) => {
        const renamed = renames.get(identifier.name) ?? moduleName(identifier.name);
        if (renamed && renamed !== identifier.name) {
          edits.push({
            start: identifier.start,
            end: identifier.end,
            text: shorthand ? `${identifier.name}: ${renamed}` : renamed,
          });
        }
      });
      edits.sort((a, b) => a.start - b.start);
      let at = node.start;
      for (const edit of edits) {
        builder.add(module!.source.slice(at, edit.start), origin(at), true);
        builder.add(edit.text, origin(edit.start), false);
        at = edit.end;
      }
      builder.add(module!.source.slice(at, node.end), origin(at), true);
    }

    for (const statement of body.body) {
      if (statement !== last) {
        copy(statement);
        generated('\n');
      }
    }
    // Returned values that are not locals of the body get the name that the component gives them.
    for (const property of returned.properties as oxc.ObjectProperty[]) {
      const key = (property.key as oxc.IdentifierName).name;
      const target = wanted.get(key);
      if (!target || returnedNames.has(key)) {
        continue;
      }
      used.add(target);
      // A method becomes a function expression with its parameters and body.
      generated(property.method ? `const ${target} = function ` : `const ${target} = `);
      copy(property.value);
      generated(';\n');
    }
  }

  // The component's code after `<script>`, with each call replaced.
  const after = new Builder();
  let position = importsOffset;
  for (const call of calls.toSorted((a, b) => a.statement.start - b.statement.start)) {
    after.add(source.slice(position, call.statement.start), { offset: position }, true);
    inline(call, after);
    position = call.statement.end;
  }
  after.add(source.slice(position), { offset: position }, true);

  const builder = new Builder();
  builder.add(source.slice(0, importsOffset), { offset: 0 }, true);
  const lines: string[] = [];
  if (macrosToImport.size > 0) {
    lines.push(`\nimport { ${[...macrosToImport].join(', ')} } from '${SIGNALS_MODULE}';`);
  }
  for (const [alias, { specifier, imported: name }] of imports) {
    if (name === '*') {
      lines.push(`\nimport * as ${alias} from '${specifier}';`);
    } else if (name === 'default') {
      lines.push(`\nimport ${alias} from '${specifier}';`);
    } else {
      const binding = name === alias ? name : `${name} as ${alias}`;
      lines.push(`\nimport { ${binding} } from '${specifier}';`);
    }
  }
  builder.add(lines.join(''), { offset: importsOffset }, false);
  const offset = builder.text.length;
  for (const piece of after.pieces) {
    builder.pieces.push({ ...piece, start: piece.start + offset });
  }
  builder.text += after.text;

  return {
    source: builder.text,
    origin: (at) => builder.origin(at),
    modules: [...modules.values()].map((value) => value.module),
    calls: expanded,
  };
}
