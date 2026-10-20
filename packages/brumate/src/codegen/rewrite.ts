import type { Block, Range, SFCFile } from '../ast.ts';
import { isWithin, upstreamMemos } from '../model.ts';
import type { Declaration, Diagnostic, Reference, Scope, Site } from '../model.ts';
import { children } from '../oxc.ts';
import type { oxc } from '../oxc.ts';
import type { Plan } from '../plan.ts';
import { Patch } from './patch.ts';
import { instanceScope, scopePath, slotIndex } from './scopes.ts';

const COMPOUND: Record<string, string> = {
  '+=': '+',
  '-=': '-',
  '*=': '*',
  '/=': '/',
  '%=': '%',
  '**=': '**',
  '<<=': '<<',
  '>>=': '>>',
  '>>>=': '>>>',
  '&=': '&',
  '|=': '|',
  '^=': '^',
  '&&=': '&&',
  '||=': '||',
  '??=': '??',
};

export interface RewriteOptions {
  /** Declarations that are plain variables in the output, such as the item of a key function. */
  locals?: Set<Declaration>;
  /** The range to return. Defaults to the site's node. */
  range?: Range;
  /** Adds more edits, such as renaming a function. */
  edit?: (patch: Patch) => void;
}

/** Rewrites the code of client sites to read and write slots of scope instances. */
export class Rewriter {
  private readonly file: SFCFile;
  private readonly plan: Plan;
  private readonly diagnostics: Diagnostic[];

  constructor(file: SFCFile, plan: Plan, diagnostics: Diagnostic[]) {
    this.file = file;
    this.plan = plan;
    this.diagnostics = diagnostics;
  }

  /**
   * Returns an expression for a declaration, read from code whose scope
   * instance is `scopeVar`, the instance of `base`.
   */
  value(declaration: Declaration, scopeVar: string, base: Scope): string | undefined {
    const slot = slotIndex(this.plan, declaration);
    if (slot !== -1) {
      return `$$b.get(${scopePath(this.plan, scopeVar, base, declaration.scope)}, ${slot})`;
    }
    switch (declaration.kind) {
      case 'function': {
        const owner = instanceScope(this.plan, declaration.scope);
        return `${declaration.name}$.bind(null, ${scopePath(this.plan, scopeVar, base, owner)})`;
      }
      case 'server-function':
        return `${declaration.name}$`;
      case 'reset': {
        // Renders the `#try` body again, in the range of the block.
        const block = declaration.block as Block & { kind: 'try' };
        const owner = declaration.scope.parent!;
        const body = this.plan.bodyScopes.get(block.body)!;
        const fallback = this.plan.bodyScopes.get(block.fallback)!;
        const kinds = this.plan.graph.model.scopes
          .filter((scope) => isWithin(scope, body) || isWithin(scope, fallback))
          .map((scope) => scope.id);
        const args = [
          scopePath(this.plan, scopeVar, base, owner),
          this.plan.anchors.get(block),
          JSON.stringify(this.plan.id),
          JSON.stringify(`r${body.id}`),
          JSON.stringify(`r${fallback.id}`),
          `[${kinds.join(', ')}]`,
        ];
        return `$$b.reset.bind(null, ${args.join(', ')})`;
      }
      default:
        return undefined;
    }
  }

  /** `$produce(todos, recipe)` writes the slot of `todos` with the result of the recipe. */
  private rewriteProduce(
    node: oxc.CallExpression,
    target: oxc.IdentifierReference,
    patch: Patch,
    references: Map<number, Reference>,
    locals: Set<Declaration>,
    scopeVar: string,
    base: Scope,
    visit: (node: oxc.Node) => void,
  ): void {
    const reference = references.get(target.start);
    const declaration = reference?.declaration;
    const slot = declaration && !locals.has(declaration) ? slotIndex(this.plan, declaration) : -1;
    if (declaration && slot !== -1) {
      const path = scopePath(this.plan, scopeVar, base, declaration.scope);
      patch.replace(
        node.start,
        target.end,
        `$$b.set(${path}, ${slot}, $$b.produce($$b.get(${path}, ${slot})`,
      );
    } else if (declaration && !locals.has(declaration)) {
      // Nothing on the client reads the value, so there is nothing to change.
      patch.replace(node.start, node.end, 'undefined');
      return;
    } else {
      patch.replace(node.start, target.end, `(${target.name} = $$b.produce(${target.name}`);
    }
    patch.insert(node.end, ')');
    for (const argument of node.arguments.slice(1)) {
      visit(argument);
    }
  }

  rewrite(site: Site, scopeVar: string, base: Scope, options: RewriteOptions = {}): string {
    const patch = new Patch(this.file.source);
    const locals = options.locals ?? new Set();
    const references = new Map<number, Reference>();
    for (const reference of [...site.reads, ...site.writes]) {
      references.set(reference.range.start, reference);
    }
    const target = (node: oxc.Node): Reference | undefined => {
      if (node.type !== 'Identifier') {
        return undefined;
      }
      const reference = references.get(node.start);
      return reference && !locals.has(reference.declaration) ? reference : undefined;
    };
    const path = (declaration: Declaration): string =>
      scopePath(this.plan, scopeVar, base, declaration.scope);

    const visit = (node: oxc.Node): void => {
      switch (node.type) {
        case 'Identifier': {
          const reference = target(node);
          const value = reference && this.value(reference.declaration, scopeVar, base);
          if (value) {
            patch.replace(node.start, node.end, value);
          }
          return;
        }
        case 'Property':
          if (node.shorthand && node.value.type === 'Identifier') {
            const reference = target(node.value);
            const value = reference && this.value(reference.declaration, scopeVar, base);
            if (value) {
              patch.replace(node.start, node.end, `${node.value.name}: ${value}`);
            }
            return;
          }
          break;
        case 'AssignmentExpression': {
          const reference = target(node.left);
          if (reference) {
            const declaration = reference.declaration;
            const slot = slotIndex(this.plan, declaration);
            if (slot === -1) {
              // Nothing on the client reads it, so only the value is kept.
              patch.replace(node.start, node.right.start, '(');
            } else if (node.operator === '=') {
              patch.replace(
                node.start,
                node.right.start,
                `$$b.set(${path(declaration)}, ${slot}, `,
              );
            } else {
              const read = `$$b.get(${path(declaration)}, ${slot})`;
              patch.replace(
                node.start,
                node.right.start,
                `$$b.set(${path(declaration)}, ${slot}, ${read} ${COMPOUND[node.operator]} (`,
              );
              patch.insert(node.end, ')');
            }
            patch.insert(node.end, ')');
            visit(node.right);
            return;
          }
          if (node.left.type === 'ObjectPattern' || node.left.type === 'ArrayPattern') {
            const writes = site.writes.some(
              (write) => write.range.start >= node.left.start && write.range.end <= node.left.end,
            );
            if (writes) {
              this.diagnostics.push({
                severity: 'error',
                message: 'Destructuring assignment to a signal is not supported in client code yet',
                range: { start: node.start, end: node.end },
              });
            }
          }
          break;
        }
        case 'UpdateExpression': {
          const reference = target(node.argument);
          if (reference) {
            const declaration = reference.declaration;
            const slot = slotIndex(this.plan, declaration);
            const delta = node.operator === '++' ? 1 : -1;
            patch.replace(
              node.start,
              node.end,
              slot === -1
                ? 'undefined'
                : `$$b.update(${path(declaration)}, ${slot}, ${delta}, ${node.prefix})`,
            );
            return;
          }
          break;
        }
        case 'CallExpression':
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === '$isPending' &&
            !references.has(node.callee.start)
          ) {
            const memo = node.arguments[0];
            const declaration = memo && references.get(memo.start)?.declaration;
            // A memo is pending while it or a memo that it reads loads.
            const checks = (
              declaration ? [declaration, ...upstreamMemos(declaration)] : []
            ).flatMap((item) => {
              const slot = slotIndex(this.plan, item);
              return slot === -1 ? [] : [`$$b.pending(${path(item)}, ${slot})`];
            });
            const value =
              checks.length === 0
                ? 'false'
                : checks.length === 1
                  ? checks[0]!
                  : `(${checks.join(' || ')})`;
            patch.replace(node.start, node.end, value);
            return;
          }
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === '$produce' &&
            !references.has(node.callee.start) &&
            node.arguments[0]?.type === 'Identifier'
          ) {
            this.rewriteProduce(
              node,
              node.arguments[0],
              patch,
              references,
              locals,
              scopeVar,
              base,
              visit,
            );
            return;
          }
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === '$untrack' &&
            node.arguments[0] &&
            !references.has(node.callee.start)
          ) {
            const argument = node.arguments[0];
            patch.replace(node.start, argument.start, '(');
            patch.replace(argument.end, node.end, ')');
            visit(argument);
            return;
          }
          break;
        case 'MemberExpression':
          visit(node.object);
          if (node.computed) {
            visit(node.property);
          }
          return;
        default:
          break;
      }
      for (const [key, child] of children(node)) {
        if (
          key === 'typeAnnotation' ||
          key === 'typeArguments' ||
          key === 'typeParameters' ||
          key === 'returnType'
        ) {
          continue;
        }
        if (node.type === 'Property' && key === 'key' && !node.computed) {
          continue;
        }
        visit(child);
      }
    };

    visit(site.node);
    options.edit?.(patch);
    const range = options.range ?? site.node;
    return patch.slice(range.start, range.end);
  }
}
