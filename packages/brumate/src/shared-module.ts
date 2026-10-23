// The code of module functions that runs in the browser, compiled once per
// module. A component copies the body of a module function where it calls
// it, so the graph stays static. Without sharing, the browser code of the
// function would ship once for each call. Instead, each function of the
// body that runs in the browser, and each memo and effect, is a function of
// this module, and the component calls it with an object of cells: a getter
// and a setter for each name of the function, which read and write the
// values of that call.
//
//   // counter.brm.ts?brumate-shared
//   export const s120 = ($$c) => { $$c.count++; };
//
//   // a part of the component
//   const increment$ = ($$s, ...$$a) =>
//     $$m0.s120({ get count() { … }, set count($$v) { … } }, ...$$a);

import { MACROS, SIGNALS_MODULE } from './macros.ts';
import { forEachReference, parseModule } from './modules.ts';
import type { CallName, ModuleInfo, ReactiveModule } from './modules.ts';
import { children, getPatternNames } from './oxc.ts';
import type { oxc } from './oxc.ts';
import { finish } from './sourcemap.ts';
import type { SourceMap } from './sourcemap.ts';
import { Patch } from './codegen/patch.ts';

/** The query of the shared module of a module of reactive logic. */
export const SHARED_QUERY = '?brumate-shared';

/** A piece of a module function that the shared module holds. */
export interface SharedSite {
  /** The name of its export. */
  name: string;
  /** A function, called with its arguments, or an expression, such as the value of a memo. */
  kind: 'function' | 'expression';
  /** The names of the function that it reads or writes, in the order of the refs that a call passes. */
  names: string[];
  /** The names of the function that it writes. */
  writes: string[];
}

/** Compile-time functions that need the component to compile them, so their code is not shared. */
const UNSHARED = new Set([
  '$isPending',
  '$id',
  '$getContext',
  '$setContext',
  '$title',
  '$action',
  '$props',
  // The reference of a handler names a part of the component that calls the function.
  '$handler',
]);

interface Analysis {
  info: ModuleInfo;
  /** Sites by the offset of their node in the module. */
  sites: Map<number, { site: SharedSite; node: oxc.Node; locals: Set<string> }>;
}

const analyses = new WeakMap<ReactiveModule, Analysis>();

function isFunction(node: oxc.Node): node is oxc.Function | oxc.ArrowFunctionExpression {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

function analyze(module: ReactiveModule): Analysis {
  const cached = analyses.get(module);
  if (cached) {
    return cached;
  }
  const info = parseModule(module);
  // The local name of each compile-time function in the module.
  const macros = new Map<string, string>();
  for (const [local, from] of info.imports) {
    if (from.specifier === SIGNALS_MODULE && MACROS.has(from.imported)) {
      macros.set(local, from.imported);
    }
  }
  const sites = new Map<number, { site: SharedSite; node: oxc.Node; locals: Set<string> }>();
  for (const fn of info.functions.values()) {
    const body = fn.body;
    if (body?.type !== 'BlockStatement') {
      continue;
    }
    // The names of the function: its parameters and what its body declares.
    const locals = new Set<string>();
    for (const param of fn.params) {
      for (const id of getPatternNames(
        param.type === 'TSParameterProperty' ? param.parameter : param,
      )) {
        locals.add(id.name);
      }
    }
    for (const statement of body.body) {
      if (statement.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations) {
          for (const id of getPatternNames(declarator.id)) {
            locals.add(id.name);
          }
        }
      } else if (
        (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
        statement.id
      ) {
        locals.add(statement.id.name);
      }
    }
    const candidates: oxc.Node[] = [];
    const macroArgument = (
      node: oxc.Node | null | undefined,
      names: string[],
    ): oxc.Node | undefined => {
      if (node?.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
        return undefined;
      }
      const macro = macros.get(node.callee.name);
      return macro && names.includes(macro) ? node.arguments[0] : undefined;
    };
    for (const statement of body.body) {
      if (statement.type === 'FunctionDeclaration') {
        candidates.push(statement);
      } else if (statement.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations) {
          const init = declarator.init;
          if (init && isFunction(init)) {
            candidates.push(init);
          }
          const memo = macroArgument(init, ['$memo']);
          if (memo) {
            candidates.push(memo);
          }
        }
      } else if (statement.type === 'ExpressionStatement') {
        const callback = macroArgument(statement.expression, ['$effect', '$client']);
        if (callback) {
          candidates.push(callback);
        }
      } else if (
        statement.type === 'ReturnStatement' &&
        statement.argument?.type === 'ObjectExpression'
      ) {
        for (const property of statement.argument.properties) {
          if (property.type === 'Property' && !property.method && isFunction(property.value)) {
            candidates.push(property.value);
          }
        }
      }
    }
    for (const node of candidates) {
      let shareable = true;
      const check = (current: oxc.Node): void => {
        if (
          current.type === 'CallExpression' &&
          current.callee.type === 'Identifier' &&
          UNSHARED.has(macros.get(current.callee.name) ?? '')
        ) {
          shareable = false;
        }
        if (
          current.type === 'ExpressionStatement' &&
          current.expression.type === 'Literal' &&
          current.expression.value === 'use server'
        ) {
          shareable = false;
        }
        for (const [, child] of children(current)) {
          check(child);
        }
      };
      check(node);
      if (!shareable) {
        continue;
      }
      const reads = new Set<string>();
      const writes = new Set<string>();
      forEachReference(node, (identifier) => {
        if (locals.has(identifier.name)) {
          reads.add(identifier.name);
        }
      });
      const findWrites = (current: oxc.Node): void => {
        let target: oxc.Node | undefined;
        if (current.type === 'AssignmentExpression') {
          target = current.left;
        } else if (current.type === 'UpdateExpression') {
          target = current.argument;
        } else if (
          current.type === 'CallExpression' &&
          current.callee.type === 'Identifier' &&
          macros.get(current.callee.name) === '$produce'
        ) {
          target = current.arguments[0];
        }
        if (target?.type === 'Identifier' && locals.has(target.name)) {
          writes.add(target.name);
        }
        for (const [, child] of children(current)) {
          findWrites(child);
        }
      };
      findWrites(node);
      sites.set(node.start, {
        node,
        locals,
        site: {
          name: `s${node.start}`,
          kind: isFunction(node) ? 'function' : 'expression',
          names: [...new Set([...reads, ...writes])],
          writes: [...writes],
        },
      });
    }
  }
  const analysis = { info, sites };
  analyses.set(module, analysis);
  return analysis;
}

/** The pieces of the functions of a module that its shared module holds, by their offset in the module. */
export function sharedSites(module: ReactiveModule): Map<number, SharedSite> {
  return new Map([...analyze(module).sites].map(([offset, { site }]) => [offset, site]));
}

/** The shared module of a module of reactive logic, as TypeScript, with its source map. */
export function generateShared(module: ReactiveModule): { code: string; map: SourceMap } {
  const { info, sites } = analyze(module);
  const macros = new Map<string, string>();
  for (const [local, from] of info.imports) {
    if (from.specifier === SIGNALS_MODULE && MACROS.has(from.imported)) {
      macros.set(local, from.imported);
    }
  }
  const usedImports = new Set<string>();
  const usedDeclarations = new Set<string>();
  let usesRuntime = false;
  const body: string[] = [];
  for (const { site, node, locals } of sites.values()) {
    const patch = new Patch(module.source);
    forEachReference(node, (identifier, shorthand) => {
      if (locals.has(identifier.name)) {
        patch.replace(
          identifier.start,
          identifier.end,
          shorthand ? `${identifier.name}: $$c.${identifier.name}` : `$$c.${identifier.name}`,
        );
      } else if (info.imports.has(identifier.name) && !macros.has(identifier.name)) {
        usedImports.add(identifier.name);
      } else if (info.declarations.has(identifier.name)) {
        usedDeclarations.add(identifier.name);
      }
    });
    // Compile-time functions become what they do at run time.
    const rewriteMacros = (current: oxc.Node): void => {
      if (current.type === 'CallExpression' && current.callee.type === 'Identifier') {
        const macro = macros.get(current.callee.name);
        const [first] = current.arguments;
        if (macro === '$untrack' && first) {
          patch.replace(current.start, first.start, '(');
          patch.replace(first.end, current.end, ')');
        } else if (macro === '$produce' && first?.type === 'Identifier' && locals.has(first.name)) {
          // `$produce(todos, recipe)` becomes `($$c.todos = $$b.produce($$c.todos, recipe))`.
          usesRuntime = true;
          patch.replace(
            current.start,
            first.end,
            `($$c.${first.name} = $$b.produce($$c.${first.name}`,
          );
          patch.insert(current.end, ')');
        }
      }
      for (const [, child] of children(current)) {
        rewriteMacros(child);
      }
    };
    rewriteMacros(node);
    // The names of the call, built once from the refs that the component passes.
    const cells = `const $$c: any = $$b.cells($$s, $$k, ${JSON.stringify(site.names)});`;
    if (site.kind === 'expression') {
      const awaits = module.source.slice(node.start, node.end).includes('await');
      body.push(
        `export const ${site.name} = ${awaits ? 'async ' : ''}($$s: any, $$k: any[]) => {\n  ${cells}\n  return (${patch.slice(node.start, node.end)});\n};`,
      );
      continue;
    }
    const fn = node as oxc.Function | oxc.ArrowFunctionExpression;
    const params =
      fn.params.length > 0 ? `, ${patch.slice(fn.params[0]!.start, fn.params.at(-1)!.end)}` : '';
    const code = patch.slice(fn.body!.start, fn.body!.end);
    // The cells go first in the body. The body's text can start with a source map mark, so the
    // brace is found rather than taken as the first character.
    const brace = code.indexOf('{');
    const block =
      fn.body!.type === 'BlockStatement'
        ? `${code.slice(0, brace + 1)}\n  ${cells}${code.slice(brace + 1)}`
        : `{\n  ${cells}\n  return (${code});\n}`;
    body.push(
      fn.type === 'ArrowFunctionExpression'
        ? `export const ${site.name} = ${fn.async ? 'async ' : ''}($$s: any, $$k: any[]${params}) => ${block};`
        : `export ${fn.async ? 'async ' : ''}function${fn.generator ? '*' : ''} ${site.name}($$s: any, $$k: any[]${params}) ${block}`,
    );
  }
  const self = `./${module.path.split('/').pop()}`;
  void usesRuntime;
  const header: string[] = ["import * as $$b from 'brumate/client';"];
  const bySpecifier = new Map<string, string[]>();
  for (const local of usedImports) {
    const { specifier, imported } = info.imports.get(local)!;
    if (imported === '*') {
      header.push(`import * as ${local} from ${JSON.stringify(specifier)};`);
    } else if (imported === 'default') {
      header.push(`import ${local} from ${JSON.stringify(specifier)};`);
    } else {
      bySpecifier.set(specifier, [
        ...(bySpecifier.get(specifier) ?? []),
        imported === local ? local : `${imported} as ${local}`,
      ]);
    }
  }
  // Exported declarations of the module itself. The component already needs them exported.
  const own = [...usedDeclarations].filter((local) => info.declarations.get(local));
  if (own.length > 0) {
    bySpecifier.set(self, [
      ...(bySpecifier.get(self) ?? []),
      ...own.map((local) =>
        info.declarations.get(local) === local
          ? local
          : `${info.declarations.get(local)} as ${local}`,
      ),
    ]);
  }
  for (const [specifier, names] of bySpecifier) {
    header.push(`import { ${names.join(', ')} } from ${JSON.stringify(specifier)};`);
  }
  const marked = [...header, '', ...body, ''].join('\n');
  return finish(marked, [{ name: module.path, content: module.source }]);
}

/** What code generation needs to call shared code instead of copying it. */
export interface SharedContext {
  /**
   * The shared site of a node of the compiled source, if the node is code of
   * a module function that the component calls, with what the names of the
   * function are in that call.
   */
  find(
    node: oxc.Node,
  ): { module: number; site: SharedSite; names: Map<string, CallName> } | undefined;
  /** The import specifier of each shared module, relative to the component. */
  specifiers: string[];
}
