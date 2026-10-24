// Classifies the components of a project by what they depend on, so the workbench lists only
// the ones that it can show: those that depend on their props, their own state and nothing
// else. A context counts as neither, since a component without a provider reads its default.
// A component that calls the server, or reads the request or the route, fits an end-to-end
// test better. A component needs what the components it renders need.

import { analyze } from './analyze.ts';
import type { Markup, SFCFile } from './ast.ts';
import { walk } from './macros.ts';
import type { oxc } from './oxc.ts';
import { parse } from './parser.ts';
import { forEachNode, importSource, resolveRelative } from './project.ts';
import type { Resolve } from './project.ts';

export type NeedKind =
  /** A server function: one of a `'use server'` file, or one that the component declares. */
  | 'server'
  /** The request, through an import of `brumate/server`, such as `getEvent`. */
  | 'request'
  /** The route, through `$route` or `$navigation`. */
  | 'route'
  /** A form action of `$action`. */
  | 'action'
  /** A `#defer` block, whose body the server renders later. */
  | 'defer'
  /** A dynamic tag without an element to fall back to, which can render any component. */
  | 'dynamic'
  /** A component that the analysis cannot find, such as one of a package that is not a `.brm` file. */
  | 'component';

export interface Need {
  kind: NeedKind;
  /** What the need is about: the name of a function, an import, a block or a component. */
  name: string;
  /** For a need of a component that this one renders, the file of that component, which can have it from a component that it renders. */
  via?: string;
}

export interface Classification {
  /** True when the component depends only on its props and its own state. */
  selfContained: boolean;
  needs: Need[];
}

export interface ClassifyOptions {
  /** Resolves the import of a component to its file. */
  resolve?: Resolve;
  /** True for an import of a function of a `'use server'` file. */
  serverImport?: (file: string, specifier: string, name: string) => boolean;
}

/** True for a string literal, such as `'button'`. */
function isElementName(node: oxc.Node | undefined): boolean {
  return node?.type === 'Literal' && typeof node.value === 'string';
}

/** The props that destructure with an element name as their default, such as `as = 'button'`. */
function elementDefaults(file: SFCFile): Set<string> {
  const names = new Set<string>();
  for (const statement of file.instanceScript?.program.body ?? []) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of statement.declarations) {
      const call = declarator.init;
      if (
        call?.type !== 'CallExpression' ||
        call.callee.type !== 'Identifier' ||
        call.callee.name !== '$props' ||
        declarator.id.type !== 'ObjectPattern'
      ) {
        continue;
      }
      for (const property of declarator.id.properties) {
        if (
          property.type === 'Property' &&
          property.value.type === 'AssignmentPattern' &&
          property.value.left.type === 'Identifier' &&
          isElementName(property.value.right)
        ) {
          names.add(property.value.left.name);
        }
      }
    }
  }
  return names;
}

/**
 * True for the tag of a dynamic tag that renders an element when the caller gives none: a
 * string, `as ?? 'button'`, or a prop with an element as its default. A part such as a button
 * that takes `as` depends only on its props this way.
 */
function hasElementDefault(tag: oxc.Node, defaults: Set<string>): boolean {
  if (isElementName(tag)) {
    return true;
  }
  if (tag.type === 'Identifier') {
    return defaults.has(tag.name);
  }
  if (tag.type === 'LogicalExpression' && (tag.operator === '??' || tag.operator === '||')) {
    return isElementName(tag.right) || hasElementDefault(tag.right, defaults);
  }
  if (tag.type === 'ConditionalExpression') {
    return (
      hasElementDefault(tag.consequent, defaults) && hasElementDefault(tag.alternate, defaults)
    );
  }
  return tag.type === 'ParenthesizedExpression' && hasElementDefault(tag.expression, defaults);
}

/** The needs of one file, without those of the components that it renders. */
function ownNeeds(file: SFCFile, options: ClassifyOptions): Need[] {
  const needs: Need[] = [];
  const model = analyze(file);
  for (const declaration of model.declarations) {
    if (declaration.kind === 'server-function') {
      needs.push({ kind: 'server', name: declaration.name });
    } else if (declaration.kind === 'action') {
      needs.push({ kind: 'action', name: declaration.name });
    } else if (declaration.imported) {
      const { source, name } = declaration.imported;
      if (source === 'brumate/server') {
        needs.push({ kind: 'request', name });
      } else if (options.serverImport?.(file.filename, source, name)) {
        needs.push({ kind: 'server', name });
      }
    }
  }
  for (const script of [file.moduleScript, file.instanceScript]) {
    for (const statement of script?.program.body ?? []) {
      // The analysis has a declaration for each named import only, so a namespace is found here.
      if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') {
        continue;
      }
      const source = statement.source.value;
      for (const specifier of statement.specifiers) {
        if (specifier.type !== 'ImportNamespaceSpecifier') {
          continue;
        }
        const name = `* as ${specifier.local.name}`;
        if (source === 'brumate/server') {
          needs.push({ kind: 'request', name });
        } else if (options.serverImport?.(file.filename, source, '*')) {
          needs.push({ kind: 'server', name });
        }
      }
    }
    // `$route` and `$navigation` read the route of the page, which the workbench does not have.
    walk(script?.program, (node) => {
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        (node.callee.name === '$route' || node.callee.name === '$navigation')
      ) {
        needs.push({ kind: 'route', name: node.callee.name });
      }
    });
  }
  const defaults = elementDefaults(file);
  const visit = (node: Markup): void => {
    if (node.kind === 'defer') {
      needs.push({ kind: 'defer', name: '#defer' });
    } else if (node.kind === 'dynamic' && !hasElementDefault(node.tag.ast, defaults)) {
      needs.push({ kind: 'dynamic', name: '<{…}>' });
    }
  };
  forEachNode(file.children, visit);
  for (const template of file.templates) {
    forEachNode(template.body.children, visit);
  }
  return needs;
}

/** The import specifiers of the components that a file renders. */
function renderedComponents(file: SFCFile): Set<string> {
  const sources = new Set<string>();
  const visit = (node: Markup): void => {
    if (node.kind === 'component') {
      const source = importSource(file, node.name.split('.')[0]!);
      if (source) {
        sources.add(source);
      }
    }
  };
  forEachNode(file.children, visit);
  for (const template of file.templates) {
    forEachNode(template.body.children, visit);
  }
  return sources;
}

const key = (need: Need): string => `${need.kind}:${need.name}`;

/**
 * Classifies every component of a project, by file. A file that does not parse or analyze is
 * not classified, because the workbench could not render it either.
 */
export function classifyComponents(
  files: Map<string, string>,
  options: ClassifyOptions = {},
): Map<string, Classification> {
  const resolve = options.resolve ?? resolveRelative;
  const needs = new Map<string, Map<string, Need>>();
  const children = new Map<string, string[]>();
  for (const [filename, source] of files) {
    let file: SFCFile;
    let own: Need[];
    try {
      file = parse(source, { filename });
      own = ownNeeds(file, options);
    } catch {
      continue;
    }
    const map = new Map<string, Need>();
    for (const need of own) {
      map.set(key(need), need);
    }
    const found: string[] = [];
    for (const specifier of renderedComponents(file)) {
      const target = resolve(specifier, filename);
      if (target !== undefined && files.has(target)) {
        found.push(target);
      } else if (specifier.endsWith('.brm')) {
        map.set(`component:${specifier}`, { kind: 'component', name: specifier });
      }
    }
    needs.set(filename, map);
    children.set(filename, found);
  }
  // A component needs what the components that it renders need. Each round can only add needs,
  // so this ends, also for a component that renders itself.
  for (let changed = true; changed;) {
    changed = false;
    for (const [filename, map] of needs) {
      for (const child of children.get(filename)!) {
        for (const need of needs.get(child)?.values() ?? []) {
          const id = key(need);
          if (!map.has(id)) {
            map.set(id, { ...need, via: child });
            changed = true;
          }
        }
      }
    }
  }
  const result = new Map<string, Classification>();
  for (const [filename, map] of needs) {
    const list = [...map.values()];
    result.set(filename, { selfContained: list.length === 0, needs: list });
  }
  return result;
}

/** The input of a control, by the type of its prop. */
export type ControlInput =
  | { kind: 'text'; default?: string }
  | { kind: 'number'; default?: number }
  | { kind: 'boolean'; default?: boolean }
  | { kind: 'choice'; options: (string | number)[]; default?: string | number }
  | {
      kind: 'json';
      default?: unknown;
      /** The value to start a required prop with: `[]` for an array type, `{}` for an object type. */
      empty?: unknown[] | Record<string, never>;
    };

/** A control of the workbench for one prop of a component. */
export type Control = { name: string; optional: boolean } & ControlInput;

/** The interface or type alias of the scripts that has this name. */
function localType(name: string, file: SFCFile): oxc.Node | undefined {
  for (const script of [file.moduleScript, file.instanceScript]) {
    for (let statement of script?.program.body ?? []) {
      if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
        statement = statement.declaration;
      }
      if (
        (statement.type === 'TSInterfaceDeclaration' ||
          statement.type === 'TSTypeAliasDeclaration') &&
        statement.id.name === name
      ) {
        return statement;
      }
    }
  }
  return undefined;
}

/**
 * The members of the type of `$props<T>()`: a literal, an interface or alias of the scripts and
 * what it extends, an intersection of those, or `Partial` of one. Undefined for a type that the
 * workbench cannot read, such as one that the file imports.
 */
function propsMembers(
  type: oxc.Node,
  file: SFCFile,
  seen = new Set<string>(),
): oxc.Node[] | undefined {
  if (type.type === 'TSTypeLiteral') {
    return type.members;
  }
  if (type.type === 'TSIntersectionType') {
    const members: oxc.Node[] = [];
    for (const item of type.types) {
      const found = propsMembers(item, file, seen);
      if (!found) {
        return undefined;
      }
      members.push(...found);
    }
    return members;
  }
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
    return undefined;
  }
  const name = type.typeName.name;
  const argument = type.typeArguments?.params[0];
  if (name === 'Partial' && argument) {
    return propsMembers(argument, file, seen)?.map(
      (member) => ({ ...member, optional: true }) as oxc.Node,
    );
  }
  const declaration = seen.has(name) ? undefined : localType(name, file);
  if (!declaration) {
    return undefined;
  }
  seen.add(name);
  if (declaration.type === 'TSTypeAliasDeclaration') {
    return propsMembers(declaration.typeAnnotation, file, seen);
  }
  if (declaration.type !== 'TSInterfaceDeclaration') {
    return undefined;
  }
  const members: oxc.Node[] = [];
  for (const heritage of declaration.extends ?? []) {
    if (heritage.expression.type !== 'Identifier') {
      return undefined;
    }
    const found = propsMembers(
      {
        type: 'TSTypeReference',
        typeName: heritage.expression,
        typeArguments: heritage.typeArguments,
      } as oxc.Node,
      file,
      seen,
    );
    if (!found) {
      return undefined;
    }
    members.push(...found);
  }
  // A member of the interface replaces one that it extends with the same name.
  members.push(...declaration.body.body);
  return members;
}

/** The value of a literal default, such as `'info'` in `{ tone = 'info' }`. */
function literalValue(node: oxc.Node): unknown {
  if (node.type === 'Literal') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked;
  }
  if (
    node.type === 'UnaryExpression' &&
    node.operator === '-' &&
    node.argument.type === 'Literal'
  ) {
    return -Number(node.argument.value);
  }
  return undefined;
}

/** The control for a type, or undefined for a function, which the workbench cannot make. */
function controlOf(
  type: oxc.Node | undefined,
  file: SFCFile,
  seen = new Set<string>(),
): ControlInput | undefined {
  if (!type) {
    return { kind: 'json' };
  }
  // `Bindable<T>` is a `T` that a parent can bind.
  if (
    type.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    type.typeName.name === 'Bindable' &&
    type.typeArguments?.params[0]
  ) {
    return controlOf(type.typeArguments.params[0], file, seen);
  }
  switch (type.type) {
    case 'TSStringKeyword':
      return { kind: 'text' };
    case 'TSNumberKeyword':
      return { kind: 'number' };
    case 'TSBooleanKeyword':
      return { kind: 'boolean' };
    case 'TSFunctionType':
    case 'TSConstructorType':
      return undefined;
    case 'TSParenthesizedType':
      return controlOf(type.typeAnnotation, file, seen);
    case 'TSArrayType':
    case 'TSTupleType':
      return { kind: 'json', empty: [] };
    case 'TSTypeLiteral':
      return { kind: 'json', empty: {} };
    case 'TSTypeReference':
      if (type.typeName.type === 'Identifier') {
        if (type.typeName.name === 'Array' || type.typeName.name === 'ReadonlyArray') {
          return { kind: 'json', empty: [] };
        }
        if (type.typeName.name === 'Record') {
          return { kind: 'json', empty: {} };
        }
        // An interface is an object, and an alias has the control of its type.
        const name = type.typeName.name;
        const declaration = seen.has(name) ? undefined : localType(name, file);
        if (declaration?.type === 'TSInterfaceDeclaration') {
          return { kind: 'json', empty: {} };
        }
        if (declaration?.type === 'TSTypeAliasDeclaration') {
          return controlOf(declaration.typeAnnotation, file, new Set(seen).add(name));
        }
      }
      return { kind: 'json' };
    case 'TSUnionType': {
      const types = type.types.filter(
        (item: oxc.Node) => item.type !== 'TSUndefinedKeyword' && item.type !== 'TSNullKeyword',
      );
      const options: (string | number)[] = [];
      for (const item of types) {
        const value = item.type === 'TSLiteralType' ? literalValue(item.literal) : undefined;
        if (typeof value !== 'string' && typeof value !== 'number') {
          return types.length === 1 ? controlOf(types[0], file, seen) : { kind: 'json' };
        }
        options.push(value);
      }
      return { kind: 'choice', options };
    }
    default:
      return { kind: 'json' };
  }
}

/**
 * The controls for the props of a component, from the type of `$props<T>()` and the defaults
 * of its destructuring. A prop whose type is a function, such as a handler, has none. Undefined
 * when the workbench cannot read the type, such as one that the file imports.
 */
export function propControls(file: SFCFile): Control[] | undefined {
  for (const statement of file.instanceScript?.program.body ?? []) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of statement.declarations) {
      const call = declarator.init;
      if (
        call?.type !== 'CallExpression' ||
        call.callee.type !== 'Identifier' ||
        call.callee.name !== '$props'
      ) {
        continue;
      }
      const defaults = new Map<string, unknown>();
      if (declarator.id.type === 'ObjectPattern') {
        for (const property of declarator.id.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.value.type === 'AssignmentPattern'
          ) {
            defaults.set(property.key.name, literalValue(property.value.right));
          }
        }
      }
      const type = (call as { typeArguments?: { params: oxc.Node[] } }).typeArguments?.params[0];
      const members = type ? propsMembers(type, file) : [];
      if (!members) {
        return undefined;
      }
      // A later member with the same name, as of an interface over what it extends, wins.
      const byName = new Map<string, Control>();
      for (const member of members) {
        if (member.type !== 'TSPropertySignature' || member.computed) {
          continue;
        }
        const name =
          member.key.type === 'Identifier'
            ? member.key.name
            : String((member.key as { value?: unknown }).value);
        // The children of a part are text in the workbench, whatever their type says.
        const control =
          name === 'children'
            ? { kind: 'text' as const }
            : controlOf(member.typeAnnotation?.typeAnnotation, file);
        byName.delete(name);
        if (!control) {
          continue;
        }
        const value = defaults.get(name);
        byName.set(name, {
          name,
          optional: member.optional,
          ...control,
          ...(value === undefined ? {} : { default: value }),
        } as Control);
      }
      return [...byName.values()];
    }
  }
  return [];
}
