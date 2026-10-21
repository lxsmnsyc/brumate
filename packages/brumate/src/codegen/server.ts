import { isMacroImport } from '../macros.ts';
import type { SFCFile } from '../ast.ts';
import type { Declaration } from '../model.ts';
import type { oxc } from '../oxc.ts';
import { serverFunctionId } from '../plan.ts';
import type { Plan } from '../plan.ts';
import { minifyCSS } from '../css.ts';
import { Emitter, TYPE_DECLARATIONS } from './markup.ts';
import { Patch, addEventEdits, addValueEdits } from './patch.ts';

export function propsType(file: SFCFile): string {
  for (const statement of file.instanceScript?.program.body ?? []) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of statement.declarations) {
      const init = declarator.init;
      if (
        init?.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === '$props'
      ) {
        const type = init.typeArguments?.params[0];
        return type ? file.source.slice(type.start, type.end) : 'Record<string, any>';
      }
    }
  }
  return 'Record<string, never>';
}

function isTypeExport(statement: oxc.Node): boolean {
  return statement.type === 'ExportNamedDeclaration' && statement.exportKind === 'type';
}

function isServerStatement(statement: oxc.Node, nodes: Set<oxc.Node>): boolean {
  if (nodes.has(statement)) {
    return true;
  }
  return (
    statement.type === 'VariableDeclaration' &&
    statement.declarations.every(
      (declarator) => declarator.init !== null && nodes.has(declarator.init),
    )
  );
}

/** Returns the server functions of a file, which the server module exports for RPC. */
export function serverFunctions(plan: Plan): Declaration[] {
  return plan.graph.model.declarations.filter(
    (declaration) => declaration.kind === 'server-function',
  );
}

export function generateServer(file: SFCFile, plan: Plan): string {
  const model = plan.graph.model;
  const patch = new Patch(file.source);
  addValueEdits(patch, file, model.sites);
  addEventEdits(patch, model);
  const source = (node: { start: number; end: number }): string =>
    patch.slice(node.start, node.end);

  const header: string[] = ["import * as $$b from 'brumate/server';"];
  const moduleBody: string[] = [];
  const hoisted: string[] = [];

  if (file.moduleScript) {
    for (const statement of file.moduleScript.program.body) {
      if (isMacroImport(statement)) {
        continue;
      }
      (statement.type === 'ImportDeclaration' ? header : moduleBody).push(source(statement));
    }
  }

  // Server functions only capture module bindings, so they move to the module and are exported for RPC.
  const servers = serverFunctions(plan).filter((declaration) => declaration.scope !== model.module);
  const serverNodes = new Set(servers.map((declaration) => declaration.site!.node));

  const setup: oxc.Node[] = [];
  for (const statement of file.instanceScript?.program.body ?? []) {
    if (isMacroImport(statement)) {
      continue;
    } else if (statement.type === 'ImportDeclaration') {
      header.push(source(statement));
    } else if (TYPE_DECLARATIONS.has(statement.type) || isTypeExport(statement)) {
      moduleBody.push(source(statement));
    } else if (!isServerStatement(statement, serverNodes)) {
      setup.push(statement);
    }
  }
  for (const scope of model.scopes) {
    for (const statement of scope.body?.script?.program.body ?? []) {
      if (statement.type === 'ImportDeclaration' && !isMacroImport(statement)) {
        hoisted.push(source(statement));
      }
    }
  }
  for (const declaration of servers) {
    const node = declaration.site!.node;
    if (node.type === 'FunctionDeclaration') {
      moduleBody.push(source(node));
    } else {
      // `let`, so the function can be wrapped below.
      moduleBody.push(`let ${declaration.name} = ${source(node)};`);
    }
  }
  const exported = serverFunctions(plan).map(
    (declaration) =>
      `${JSON.stringify(serverFunctionId(plan, declaration.name))}: ${declaration.name}`,
  );
  // Every server module has it, so the server function registry can read it from any file.
  moduleBody.push(`export const rpc = { ${exported.join(', ')} };`);
  // Calls while a page renders share a result when their arguments are the same. Calls from
  // the browser use the functions of `rpc`, which run each time.
  for (const declaration of serverFunctions(plan)) {
    moduleBody.push(
      `${declaration.name} = $$b.dedupe(${declaration.name}, ${JSON.stringify(serverFunctionId(plan, declaration.name))});`,
    );
  }

  if (plan.styles.css) {
    // A build (`hideNames`) sends the stylesheet without comments and whitespace.
    const css = plan.hideNames ? minifyCSS(plan.styles.css) : plan.styles.css;
    moduleBody.push(`const $$css = ${JSON.stringify(css)};`);
  }
  // Holds a value that the render may await. See `Emitter.ready`.
  moduleBody.push('let $$t: any;');
  const emitter = new Emitter(file, plan, patch, { mode: 'server' });
  const generics = file.generics ? `<${file.generics}>` : '';
  emitter.line(
    `export default async function ${plan.name}${generics}($$props: ${propsType(file)}, $$ctx: $$b.Context): Promise<string> {`,
  );
  emitter.line(`let $$html = '';`);
  emitter.line(
    `const ${emitter.scopeVar(model.component)} = $$ctx.scope(${model.component.id}, undefined, ${JSON.stringify(plan.id)});`,
  );
  emitter.emitComponentContent(setup);
  emitter.line('return $$html;');
  emitter.close();
  // The ID lets the page state hold the component, such as the value of a dynamic tag.
  emitter.line(`${plan.name}.brumateId = ${JSON.stringify(plan.id)};`);

  return [...header, ...hoisted, ...moduleBody, '', ...emitter.lines, ''].join('\n');
}
