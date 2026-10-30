import type { Block, Markup, SFCFile } from '../ast.ts';
import type { oxc } from '../oxc.ts';
import { componentFunctionName, serverFunctionId } from '../plan.ts';
import type { Plan } from '../plan.ts';
import { minifyCSS } from '../css.ts';
import { Emitter, TYPE_DECLARATIONS } from './markup.ts';
import { cloneLines } from './template.ts';
import type { Fill } from './markup.ts';
import { Patch, addValueEdits } from './patch.ts';
import { propsType } from './server.ts';
import { copy } from '../sourcemap.ts';

// Sites whose reads a render module never runs.
const SKIPPED_SITES = new Set(['server-function', 'event', 'effect', 'client']);

/** Returns the names of the components that markup renders. */
export function componentNames(nodes: Markup[], names: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    switch (node.kind) {
      case 'component':
        names.add(node.name.split('.')[0]!);
        componentNames(node.children, names);
        break;
      case 'element':
      case 'dynamic':
      case 'fragment':
        componentNames(node.children, names);
        break;
      case 'if':
        for (const branch of node.branches) {
          componentNames(branch.body.children, names);
        }
        componentNames(node.fallback?.children ?? [], names);
        break;
      case 'switch':
        for (const branch of node.cases) {
          componentNames(branch.body.children, names);
        }
        componentNames(node.fallback?.children ?? [], names);
        break;
      case 'for':
      case 'repeat':
      case 'loading':
      case 'client':
      case 'defer':
        componentNames(node.body.children, names);
        componentNames(node.fallback?.children ?? [], names);
        break;
      case 'try':
        componentNames(node.body.children, names);
        componentNames(node.fallback.children, names);
        break;
      case 'key':
      case 'portal':
      case 'head':
      case 'offscreen':
        componentNames(node.body.children, names);
        break;
      default:
        break;
    }
  }
  return names;
}

/** Returns the source of an import, with `.brm` imports pointing to render modules. */
export function renderImport(
  file: SFCFile,
  statement: oxc.ImportDeclaration,
  names: Set<string>,
): string | undefined {
  const specifiers: typeof statement.specifiers = [];
  for (const specifier of statement.specifiers) {
    if (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type') {
      continue;
    }
    if (names.has(specifier.local.name)) {
      specifiers.push(specifier);
    }
  }
  if (statement.importKind === 'type' || specifiers.length === 0) {
    return undefined;
  }
  const parts: string[] = [];
  const named: string[] = [];
  for (const specifier of specifiers) {
    const local = specifier.local.name;
    if (specifier.type === 'ImportDefaultSpecifier') {
      parts.push(local);
    } else if (specifier.type === 'ImportNamespaceSpecifier') {
      parts.push(`* as ${local}`);
    } else {
      const imported = file.source.slice(specifier.imported.start, specifier.imported.end);
      named.push(imported === local ? local : `${imported} as ${local}`);
    }
  }
  if (named.length > 0) {
    parts.push(`{ ${named.join(', ')} }`);
  }
  const source = statement.source.value;
  const target = source.endsWith('.brm') ? `${source}?brumate-render` : source;
  return `import ${parts.join(', ')} from ${JSON.stringify(target)};`;
}

/** Returns the module script for client code. Server functions become `rpc` stubs. */
export function clientModuleScript(file: SFCFile, plan: Plan): string[] {
  const result: string[] = [];
  for (const statement of file.moduleScript?.program.body ?? []) {
    if (statement.type === 'ImportDeclaration') {
      continue;
    }
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      const found = plan.graph.model.module.declarations.get(declaration.id.name);
      if (found?.kind === 'server-function') {
        result.push(
          `const ${found.name} = (...$$a) => $$b.rpc(${JSON.stringify(serverFunctionId(plan, found.name))}, $$a);`,
        );
        continue;
      }
    }
    result.push(copy(file.source, statement.start, statement.end));
  }
  return result;
}

/** True if the render of the component awaits a promise, outside memos and the code of handlers. */
export function awaitsPromise(plan: Plan): boolean {
  for (const site of plan.graph.model.sites) {
    if (
      site.awaits &&
      site.kind !== 'memo' &&
      site.kind !== 'function' &&
      !SKIPPED_SITES.has(site.kind)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Generates the render module: the component's render function for the
 * client, used when a parent renders it inside a block that changes.
 */
export function generateRender(
  file: SFCFile,
  plan: Plan,
  getFill?: (block: Block) => Fill | undefined,
): string {
  const model = plan.graph.model;
  const patch = new Patch(file.source);
  addValueEdits(patch, file, model.sites, 'client', undefined, undefined, model.component.id);

  // The names that rendering reads, so server-only imports stay out.
  const names = componentNames(file.children);
  for (const template of file.templates) {
    componentNames(template.body.children, names);
  }
  for (const site of model.sites) {
    if (!SKIPPED_SITES.has(site.kind)) {
      for (const read of site.reads) {
        names.add(read.declaration.name);
      }
    }
  }
  let usesModule = false;
  for (const name of names) {
    if (model.module.declarations.get(name)?.kind === 'module') {
      usesModule = true;
      break;
    }
  }

  const header = ["import * as $$b from 'brumate/client';"];
  const moduleBody: string[] = [];
  const programs: oxc.Program[] = [];
  if (file.moduleScript) {
    programs.push(file.moduleScript.program);
  }
  if (file.instanceScript) {
    programs.push(file.instanceScript.program);
  }
  for (const scope of model.scopes) {
    if (scope.body?.script && !programs.includes(scope.body.script.program)) {
      programs.push(scope.body.script.program);
    }
  }
  for (const program of programs) {
    const isModule = program === file.moduleScript?.program;
    for (const statement of program.body) {
      if (statement.type === 'ImportDeclaration') {
        let code: string | undefined;
        if (isModule && usesModule) {
          const own = new Set<string>();
          for (const specifier of statement.specifiers) {
            own.add(specifier.local.name);
          }
          code = renderImport(file, statement, own);
        } else {
          code = renderImport(file, statement, names);
        }
        if (code) {
          header.push(code);
        }
      } else if (!isModule && TYPE_DECLARATIONS.has(statement.type)) {
        moduleBody.push(copy(file.source, statement.start, statement.end));
      }
    }
  }
  if (usesModule) {
    moduleBody.push(...clientModuleScript(file, plan));
  }
  for (const declaration of model.declarations) {
    if (declaration.kind === 'server-function' && declaration.scope !== model.module) {
      const ref = serverFunctionId(plan, declaration.name);
      moduleBody.push(
        `const ${declaration.name} = (...$$a) => $$b.rpc(${JSON.stringify(ref)}, $$a);`,
      );
    }
  }

  const setup: oxc.Node[] = [];
  for (const statement of file.instanceScript?.program.body ?? []) {
    if (statement.type !== 'ImportDeclaration' && !TYPE_DECLARATIONS.has(statement.type)) {
      setup.push(statement);
    }
  }
  if (plan.styles.css) {
    // A build (`hideNames`) sends the stylesheet without comments and whitespace.
    const css = plan.hideNames ? minifyCSS(plan.styles.css) : plan.styles.css;
    moduleBody.push(`const $$css = ${JSON.stringify(css)};`);
  }
  // The render functions of the client entry that fill the nested blocks of the clone.
  const imported = new Set<string>();
  function local(name: string): string {
    imported.add(name);
    return `$$${name}`;
  }
  const fills =
    getFill &&
    ((block: Block): Fill | undefined => {
      const fill = getFill(block);
      if (fill?.kind === 'if') {
        const renders: string[] = [];
        for (const name of fill.renders) {
          renders.push(local(name));
        }
        return { kind: 'if', renders };
      }
      return fill && { kind: 'for', render: local(fill.render) };
    });
  const generics = file.generics ? `<${file.generics}>` : '';
  // The script can import a name that is the name of the component.
  const fn = componentFunctionName(file, plan.name);
  // A parent that sends the component as a value registers it, and the core finds it by this ID.
  const markWithId = `${fn}.brumateId = ${JSON.stringify(plan.id)};`;
  const signature = `export default function ${fn}${generics}($$props: ${propsType(file)}): string | DocumentFragment {`;
  // A render function cannot wait, so a component whose render awaits a promise renders only
  // on the server. Its memos can await: they load in the browser.
  if (awaitsPromise(plan)) {
    const emitter = new Emitter(file, plan, patch, { mode: 'client', functions: true });
    emitter.line(signature);
    emitter.line(
      `throw new Error(${JSON.stringify(`${plan.name} awaits a promise in its script or markup, so only the server can render it`)});`,
    );
    emitter.close();
    return [...header, ...moduleBody, '', ...emitter.lines, markWithId, ''].join('\n');
  }
  // The templates of the module, for the markup and the children that clone.
  const constants = new Map<string, string>();
  const templates: string[] = [];
  function hoist(code: string): string {
    let name = constants.get(code);
    if (!name) {
      name = `$$t${constants.size}`;
      constants.set(code, name);
      templates.push(`const ${name} = ${code};`);
    }
    return name;
  }
  function emit(fill: boolean): { emitter: Emitter; cloned: boolean } {
    const emitter = new Emitter(file, plan, patch, {
      mode: 'client',
      functions: true,
      fills: fill ? fills : undefined,
      hoist,
    });
    emitter.line(signature);
    emitter.line(`let $$html = '';`);
    emitter.line(
      `const ${emitter.scopeVar(model.component)} = $$b.createScope(${model.component.id}, undefined, ${JSON.stringify(plan.id)});`,
    );
    emitter.emitComponentContent(setup);
    emitter.flush();
    const cloned = cloneLines(emitter, hoist);
    emitter.line(emitter.returnLine(0, cloned));
    emitter.close();
    return { emitter, cloned };
  }
  let emitted = fills ? emit(true) : undefined;
  // Markup that fills its blocks must clone, so markup that cannot renders again with its blocks.
  if (!emitted?.cloned) {
    imported.clear();
    templates.length = 0;
    constants.clear();
    emitted = emit(false);
  } else if (imported.size > 0) {
    const base = file.filename.split(/[\\/]/).pop()!;
    const aliases: string[] = [];
    for (const name of imported) {
      aliases.push(`${name} as $$${name}`);
    }
    header.push(
      `import { ${aliases.join(', ')} } from ${JSON.stringify(`./${base}?brumate-client`)};`,
    );
  }
  moduleBody.push(...templates);
  const { emitter } = emitted;

  return [...header, ...moduleBody, '', ...emitter.lines, markWithId, ''].join('\n');
}
