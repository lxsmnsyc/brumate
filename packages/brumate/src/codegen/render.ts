import type { Markup, SFCFile } from '../ast.ts';
import type { oxc } from '../oxc.ts';
import type { Plan } from '../plan.ts';
import { Emitter, TYPE_DECLARATIONS } from './markup.ts';
import { Patch, addValueEdits } from './patch.ts';
import { propsType } from './server.ts';

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
        componentNames(node.body.children, names);
        componentNames(node.fallback?.children ?? [], names);
        break;
      case 'try':
        componentNames(node.body.children, names);
        componentNames(node.fallback.children, names);
        break;
      case 'key':
      case 'portal':
      case 'client':
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
  const specifiers = statement.specifiers.filter((specifier) => {
    if (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type') {
      return false;
    }
    return names.has(specifier.local.name);
  });
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
          `const ${found.name} = (...$$a) => $$b.rpc(${JSON.stringify(`${plan.id}#${found.name}`)}, $$a);`,
        );
        continue;
      }
    }
    result.push(file.source.slice(statement.start, statement.end));
  }
  return result;
}

/**
 * Generates the render module: the component's render function for the
 * client, used when a parent renders it inside a block that changes.
 */
export function generateRender(file: SFCFile, plan: Plan): string {
  const model = plan.graph.model;
  const patch = new Patch(file.source);
  addValueEdits(patch, file, model.sites);

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
  const usesModule = [...names].some(
    (name) => model.module.declarations.get(name)?.kind === 'module',
  );

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
        const code =
          isModule && usesModule
            ? renderImport(
                file,
                statement,
                new Set(statement.specifiers.map((specifier) => specifier.local.name)),
              )
            : renderImport(file, statement, names);
        if (code) {
          header.push(code);
        }
      } else if (!isModule && TYPE_DECLARATIONS.has(statement.type)) {
        moduleBody.push(file.source.slice(statement.start, statement.end));
      }
    }
  }
  if (usesModule) {
    moduleBody.push(...clientModuleScript(file, plan));
  }
  for (const declaration of model.declarations) {
    if (declaration.kind === 'server-function' && declaration.scope !== model.module) {
      const ref = `${plan.id}#${declaration.name}`;
      moduleBody.push(
        `const ${declaration.name} = (...$$a) => $$b.rpc(${JSON.stringify(ref)}, $$a);`,
      );
    }
  }

  const setup = (file.instanceScript?.program.body ?? []).filter(
    (statement) => statement.type !== 'ImportDeclaration' && !TYPE_DECLARATIONS.has(statement.type),
  );
  const emitter = new Emitter(file, plan, patch, { mode: 'client', functions: true });
  const generics = file.generics ? `<${file.generics}>` : '';
  emitter.line(
    `export default function ${plan.name}${generics}($$props: ${propsType(file)}): string {`,
  );
  emitter.line(`let $$html = '';`);
  emitter.line(
    `const ${emitter.scopeVar(model.component)} = $$ctx.scope(${model.component.id}, undefined, ${JSON.stringify(plan.id)});`,
  );
  emitter.emitComponentContent(setup);
  emitter.line('return $$html;');
  emitter.close();

  return [
    ...header,
    ...moduleBody,
    '',
    'const $$ctx = $$b.context;',
    '',
    ...emitter.lines,
    '',
  ].join('\n');
}
