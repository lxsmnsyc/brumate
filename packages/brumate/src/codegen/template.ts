// Cloned templates of the markup that the browser renders. A render whose markup is one string
// of static HTML, attributes, the content of elements, and anchors compiles to a `<template>`
// that it clones, and writes the elements that it marks. The rest renders HTML.
import type { Emitter, Level, Part } from './markup.ts';

/** What a render writes on an element of its clone. */
export type Write =
  | { kind: 'anchor'; scope: string; anchor: number }
  | { kind: 'attribute'; name: string; value: string }
  | { kind: 'content'; value: string; at?: string }
  /** A text insert, whose place in the clone a marked comment holds. */
  | { kind: 'text'; scope: string; anchor: number; value: string; at?: string }
  /** A text insert at the end of the marked element, which needs no comment. */
  | { kind: 'last'; scope: string; anchor: number; value: string; at?: string }
  /** A nested block, whose start comment the clone marks, and which a call fills. */
  | { kind: 'block'; scope: string; anchor: number }
  /** A child component or a dynamic tag, which renders in the place of a marked comment. */
  | { kind: 'component'; call: string }
  /** The attributes of spreads on the marked element, and then its `b-on`. */
  | { kind: 'call'; call: string }
  /** A comment whose data names a scope, such as the start of an item, `i` and the scope. */
  | { kind: 'comment'; data: string }
  /** A value with no markers around it, which renders in the place of a marked comment. */
  | { kind: 'put'; value: string; at?: string }
  /** The start comment of a block whose markup is in the template, which the scope keeps. */
  | { kind: 'marker'; scope: string; anchor: number; suffix: string };

export interface ClonedTemplate {
  /**
   * The static HTML of the template. Each element that the render writes has `b-x` with its
   * index, which the browser reads, and removes, when it parses the template. A text insert is
   * a comment, `<!--x` and its index, which the clone replaces with a text node.
   */
  html: string;
  /** The writes on the marked elements, by their index. */
  writes: Write[][];
}

const ATTRIBUTE = /^\$\$b\.attribute\(("(?:[^"\\]|\\.)*"), ([\s\S]*)\)$/;
// An attribute that a condition adds, with a value that has no character references.
const CONDITIONAL = /^\(\(([\s\S]*)\) \? " ([\w:-]+)=\\"([^"\\&]*)\\"" : ""\)$/;
// The spreads of an element, and its `b-on` with the handlers of the spreads.
const SPREAD = /^\$\$b\.(spread|onAttribute)\(([\s\S]*)\)$/;
// `$$b.insert(value)`, or `$$b.insert(value, undefined, scope)`, whose value can be children or
// a template, which render where they are inserted with the contexts of the scope.
const INSERT = /^\$\$b\.insert\(([\s\S]*?)(?:, undefined, ([\w$.]+))?\)$/;
// A scope ID: of a scope that the render makes, or of an instance, such as the parent of children.
const SCOPE = /^\$\$(?:s\d+|s\d+\.id|p\.id)$/;
const ANCHOR_START = ' b-b="';
const ANCHOR_END = /^:(\d+)"/;
const TEXT_START = '<!--t';
const TEXT_END = /^:(\d+)-->/;
const TEXT_CLOSE = '<!--/t-->';
const BLOCK_START = '<!--b';
const COMPONENT = /^\$\$b\.component\(/;
const DYNAMIC = /^\$\$b\.dynamic\(/;
// The nodes of a block that renders where it is.
const NODES = /^\$\$b\.nodes\(([\s\S]*)\)$/;
// The rest of the start comment of a block: `:anchor`, maybe `:index`, and `-->`.
const MARKER_END = /^:(\d+)((?::-?\d+)?)-->/;
const BLOCK_END = /^:(\d+)(?::-1)?--><!--\/b-->/;

const VOID = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;

/** Elements whose content is text that the parser keeps as it is, or that hold no markup. */
const RAW_TEXT = /^(?:script|style|textarea|title|template|noscript|xmp|iframe|noembed|noframes)$/;

/**
 * Follows HTML as it is written, so the template knows where each element starts and whether it
 * is in a start tag. Quoted attribute values and comments can hold `<` and `>`.
 */
class Reader {
  html = '';
  /** In the start tag of `element`, before its `>`. */
  inTag = false;
  /** The start tag of `element` ended last, with nothing after it yet. */
  justOpened = false;
  /** The number of the element that started last, in the order of the markup. */
  element = -1;
  /** Where its start tag can take another attribute: after its name. */
  nameEnd = -1;
  /** Whether the element that started last has a raw text content, such as a `<textarea>`. */
  raw = false;
  /** The elements that are open, innermost last. */
  readonly open: number[] = [];
  /** Where the start tag of each element can take another attribute, by its number. */
  private readonly ends = new Map<number, number>();
  private state: 'text' | 'open' | 'name' | 'tag' | 'quote' | 'close' | 'comment' = 'text';

  /** In a quoted attribute value. */
  get inQuote(): boolean {
    return this.state === 'quote';
  }
  private quote = '';
  private name = '';

  append(text: string): void {
    for (const char of text) {
      const at = this.html.length;
      this.html += char;
      switch (this.state) {
        case 'text':
          if (char === '<') {
            this.state = 'open';
          } else {
            this.justOpened = false;
          }
          break;
        case 'open':
          if (/[a-zA-Z]/.test(char)) {
            this.state = 'name';
            this.name = char;
            this.nameEnd = at + 1;
            this.raw = false;
            this.element++;
            this.inTag = true;
            this.justOpened = false;
          } else if (char === '/') {
            this.state = 'close';
            this.justOpened = false;
          } else if (char === '!') {
            this.state = 'comment';
            this.justOpened = false;
          } else {
            this.state = 'text';
          }
          break;
        case 'name':
          if (/[\w-]/.test(char)) {
            this.name += char;
            this.nameEnd = at + 1;
            break;
          }
          this.state = 'tag';
          this.tag(char);
          break;
        case 'tag':
          this.tag(char);
          break;
        case 'quote':
          if (char === this.quote) {
            this.state = 'tag';
          }
          break;
        case 'close':
          if (char === '>') {
            this.state = 'text';
            this.open.pop();
          }
          break;
        case 'comment':
          if (this.html.endsWith('-->')) {
            this.state = 'text';
          }
          break;
      }
    }
  }

  private tag(char: string): void {
    if (char === '"' || char === "'") {
      this.quote = char;
      this.state = 'quote';
    } else if (char === '>') {
      this.state = 'text';
      this.inTag = false;
      this.justOpened = true;
      this.raw = RAW_TEXT.test(this.name.toLowerCase());
      this.ends.set(this.element, this.nameEnd);
      if (!VOID.test(this.name) && !this.html.endsWith('/>')) {
        this.open.push(this.element);
      }
    }
  }

  /** Takes back the start of an attribute, such as `b-b="`, or of a comment, such as `<!--t`. */
  takeBack(text: string, state: 'tag' | 'text'): void {
    this.html = this.html.slice(0, -text.length);
    this.state = state;
  }

  /** Writes text into the start tag of an element, after its name: of the one that started last. */
  insertIntoTag(text: string, element = this.element): void {
    const at = element === this.element ? this.nameEnd : this.ends.get(element)!;
    this.html = this.html.slice(0, at) + text + this.html.slice(at);
    // The start tags after it move along.
    for (const [other, end] of this.ends) {
      if (end >= at && other !== element) {
        this.ends.set(other, end + text.length);
      }
    }
    if (element === this.element || this.nameEnd > at) {
      this.nameEnd += text.length;
    }
    this.ends.set(element, element === this.element ? this.nameEnd : at + text.length);
  }
}

/** The template of a render's parts, or undefined when its markup needs HTML. */
export function clonedTemplate(parts: readonly Part[]): ClonedTemplate | undefined {
  const reader = new Reader();
  const writes: Write[][] = [];
  /** The index of each marked element, by its number in the order of the markup. */
  const marks = new Map<number, number>();
  const add = (write: Write, element = reader.element): void => {
    let index = marks.get(element);
    if (index === undefined) {
      index = writes.length;
      marks.set(element, index);
      writes.push([]);
      reader.insertIntoTag(` b-x="${index}"`, element);
    }
    writes[index]!.push(write);
  };
  const list = [...parts];
  for (let index = 0; index < list.length; index++) {
    const part = list[index]!;
    if ('static' in part) {
      reader.append(part.static);
      continue;
    }
    const code = part.code;
    const next = list[index + 1];
    const nextStatic = next && 'static' in next ? next.static : undefined;
    const attribute = ATTRIBUTE.exec(code);
    if (attribute && reader.inTag) {
      add({ kind: 'attribute', name: attribute[1]!, value: attribute[2]! });
      continue;
    }
    const spread = SPREAD.exec(code);
    if (spread && reader.inTag) {
      const helper = spread[1] === 'spread' ? 'setSpread' : 'setOn';
      add({ kind: 'call', call: `$$b.${helper}($$m, ${spread[2]})` });
      continue;
    }
    const insert = INSERT.exec(code);
    // The only content of an element, which can be the text of a `<textarea>`.
    if (insert && reader.justOpened && nextStatic?.startsWith('</')) {
      add({ kind: 'content', value: insert[1]!, at: insert[2] });
      continue;
    }
    // A text insert: `<!--t`, the scope, `:anchor-->`, the value, then `<!--/t-->`.
    const textEnd = nextStatic === undefined ? null : TEXT_END.exec(nextStatic);
    const value = list[index + 2];
    const close = list[index + 3];
    const textInsert = value && 'code' in value ? INSERT.exec(value.code) : null;
    if (
      SCOPE.test(code) &&
      reader.html.endsWith(TEXT_START) &&
      textEnd &&
      nextStatic!.length === textEnd[0].length &&
      textInsert &&
      close &&
      'static' in close &&
      close.static.startsWith(TEXT_CLOSE)
    ) {
      reader.takeBack(TEXT_START, 'text');
      const rest = close.static.slice(TEXT_CLOSE.length);
      const parent = reader.open.at(-1);
      // At the end of its element, the clone appends the text node to the element.
      if (rest.startsWith('</') && parent !== undefined) {
        add(
          {
            kind: 'last',
            scope: code,
            anchor: Number(textEnd[1]),
            value: textInsert[1]!,
            at: textInsert[2],
          },
          parent,
        );
        list[index + 3] = { static: rest };
        index += 2;
        continue;
      }
      const mark = writes.length;
      writes.push([
        {
          kind: 'text',
          scope: code,
          anchor: Number(textEnd[1]),
          value: textInsert[1]!,
          at: textInsert[2],
        },
      ]);
      // One comment, so the static text around it stays apart when the template is parsed. The
      // clone puts a text node in its place, which it keeps.
      reader.append(`<!--x${mark}-->`);
      list[index + 3] = { static: close.static.slice(TEXT_CLOSE.length) };
      index += 2;
      continue;
    }
    // A child component, which renders where it is, after the elements before it.
    if (COMPONENT.test(code) && !reader.inTag && !reader.raw) {
      const mark = writes.length;
      writes.push([{ kind: 'component', call: code.replace(COMPONENT, '$$$$b.componentNodes(') }]);
      reader.append(`<!--x${mark}-->`);
      continue;
    }
    // A block that renders where it is, whose nodes go in the place of a comment.
    const nodes = NODES.exec(code);
    if (nodes && !reader.inTag && !reader.raw) {
      const mark = writes.length;
      writes.push([{ kind: 'component', call: nodes[1]! }]);
      reader.append(`<!--x${mark}-->`);
      continue;
    }
    // A dynamic tag, which builds its element where it is.
    if (DYNAMIC.test(code) && !reader.inTag && !reader.raw) {
      const mark = writes.length;
      writes.push([{ kind: 'component', call: code.replace(DYNAMIC, '$$$$b.dynamicNodes(') }]);
      reader.append(`<!--x${mark}-->`);
      continue;
    }
    // A nested block with nothing in it yet: `<!--b`, the scope, `:anchor-->`, `<!--/b-->`.
    const blockEnd = nextStatic === undefined ? null : BLOCK_END.exec(nextStatic);
    if (SCOPE.test(code) && reader.html.endsWith(BLOCK_START) && blockEnd) {
      reader.takeBack(BLOCK_START, 'text');
      const mark = writes.length;
      writes.push([{ kind: 'block', scope: code, anchor: Number(blockEnd[1]) }]);
      reader.append(`<!--x${mark}--><!--/b-->`);
      list[index + 1] = { static: nextStatic!.slice(blockEnd[0].length) };
      continue;
    }
    // The start of a block whose markup follows in the template, such as of a dynamic tag.
    const marker = nextStatic === undefined ? null : MARKER_END.exec(nextStatic);
    if (SCOPE.test(code) && !reader.inTag && reader.html.endsWith(BLOCK_START) && marker) {
      reader.takeBack(BLOCK_START, 'text');
      const mark = writes.length;
      writes.push([{ kind: 'marker', scope: code, anchor: Number(marker[1]), suffix: marker[2]! }]);
      reader.append(`<!--x${mark}-->`);
      list[index + 1] = { static: nextStatic!.slice(marker[0].length) };
      continue;
    }
    const end = nextStatic === undefined ? null : ANCHOR_END.exec(nextStatic);
    if (SCOPE.test(code) && reader.inTag && reader.html.endsWith(ANCHOR_START) && end) {
      reader.takeBack(ANCHOR_START, 'tag');
      add({ kind: 'anchor', scope: code, anchor: Number(end[1]) });
      list[index + 1] = { static: nextStatic!.slice(end[0].length) };
      continue;
    }
    // A comment that names a scope, such as `<!--i`, the scope, `-->`.
    const named = /<!--([a-zA-Z])$/.exec(reader.html);
    if (SCOPE.test(code) && named && nextStatic?.startsWith('-->')) {
      reader.takeBack(named[0], 'text');
      const mark = writes.length;
      writes.push([{ kind: 'comment', data: `${JSON.stringify(named[1])} + ${code}` }]);
      reader.append(`<!--x${mark}-->`);
      list[index + 1] = { static: nextStatic.slice(3) };
      continue;
    }
    // A value in quotes, such as `b-v="`, the scope, `"`.
    const quoted = / ([^\s"'=<>/]+)="$/.exec(reader.html);
    if (reader.inQuote && quoted && nextStatic?.startsWith('"')) {
      reader.takeBack(quoted[0], 'tag');
      add({ kind: 'attribute', name: JSON.stringify(quoted[1]), value: code });
      list[index + 1] = { static: nextStatic.slice(1) };
      continue;
    }
    // A value in quotes with static text and code, such as `class="bar`, a class that a condition
    // adds, `"`. The code gives HTML, so the whole attribute is parsed.
    const mixed = / ([^\s"'=<>/]+)="([^"]*)$/.exec(reader.html);
    if (reader.inQuote && mixed) {
      const pieces = [JSON.stringify(mixed[0])];
      let at = index;
      let closed = false;
      for (; at < list.length; at++) {
        const piece = list[at]!;
        if ('code' in piece) {
          pieces.push(`(${piece.code})`);
          continue;
        }
        const quote = piece.static.indexOf('"');
        if (quote === -1) {
          pieces.push(JSON.stringify(piece.static));
          continue;
        }
        pieces.push(JSON.stringify(piece.static.slice(0, quote + 1)));
        list[at] = { static: piece.static.slice(quote + 1) };
        closed = true;
        break;
      }
      if (closed) {
        reader.takeBack(mixed[0], 'tag');
        add({ kind: 'call', call: `$$b.setAttrText($$m, ${pieces.join(' + ')})` });
        index = at - 1;
        continue;
      }
    }
    // Other code in a start tag gives the text of its attributes, such as a class that a
    // condition adds, or the attributes of a form of an action.
    if (reader.inTag && !reader.inQuote && !reader.html.endsWith('=')) {
      // An attribute that a condition adds, `cond ? " name=\"value\"" : ""`, is set as it is.
      const added = CONDITIONAL.exec(code);
      add({
        kind: 'call',
        call: added
          ? `(${added[1]}) && $$m.setAttribute(${JSON.stringify(added[2])}, ${JSON.stringify(added[3]!.replace(/\\"/g, '"'))})`
          : `$$b.setAttrText($$m, ${code})`,
      });
      continue;
    }
    // An insert with no markers, whose value renders once where it is.
    if (insert && !reader.inTag && !reader.raw) {
      const mark = writes.length;
      writes.push([{ kind: 'put', value: insert[1]!, at: insert[2] }]);
      reader.append(`<!--x${mark}-->`);
      continue;
    }
    return undefined;
  }
  // Other comments, such as markers that a write does not name, need the HTML of a render. The
  // loader starts each `<template>` of a block once, such as of a `$client` callback, so a clone
  // of one would start nothing. Markup with no writes clones too, which is faster than a parse.
  const comments = reader.html.replace(/<!--x\d+-->|<!--\/[biP]-->/g, '');
  if (comments.includes('<!--') || /<template\b/i.test(reader.html)) {
    return undefined;
  }
  return { html: reader.html, writes };
}

/**
 * Replaces the `$$html +=` lines of a render with a clone of a template, and the writes on the
 * elements that it marks. `hoist` makes a constant of the module. Returns false when the markup
 * needs HTML, such as markup in a branch or a loop of the render.
 *
 * The lines between the first and the last `$$html +=` can only declare the values of the
 * writes, which run after them. Plain `{` blocks around them go, so the writes see them.
 */
export function cloneLines(emitter: Emitter, hoist: (code: string) => string, fn = 0): boolean {
  const { lines: source, levels } = emitter;
  // Lines of the function, and lines in its branches and loops. Others are in functions inside.
  const isTop = (at: number): boolean => levels[at]!.fn === fn && !levels[at]!.control;
  const isControl = (at: number): boolean => levels[at]!.fn === fn && levels[at]!.control;
  const tops = emitter.flushes.filter((flush) => isTop(flush.line));
  if (tops.length === 0 || emitter.flushes.some((flush) => isControl(flush.line))) {
    return false;
  }
  const first = tops[0]!.line;
  const last = tops.at(-1)!.line;
  const flushLines = new Set(tops.map((flush) => flush.line));
  const dropped = new Set<number>();
  const declared = new Set<string>();
  for (let at = 0; at < source.length; at++) {
    if (flushLines.has(at) || !isTop(at)) {
      if (at > first && at < last && isControl(at)) {
        return false;
      }
      continue;
    }
    const line = source[at]!.trim();
    // Plain blocks go, so the clone and the writes see what the blocks declare.
    if (emitter.plainBraces.has(at)) {
      dropped.add(at);
      continue;
    }
    const declaration = /^(?:const|let) ([\w$]+) =/.exec(line);
    if (declaration) {
      // Two blocks can declare the same name, which one function cannot.
      if (declared.has(declaration[1]!)) {
        return false;
      }
      declared.add(declaration[1]!);
    }
    if (at > first && at < last && !line.startsWith('const $$') && !line.startsWith('let $$')) {
      // A reference to an element finds it when it is read.
      const reference = /^[\w$]+ = \$\$b\.elementAt\(/.test(line);
      if (line !== '});' && line !== '};' && !line.startsWith('$$b.') && !reference) {
        return false;
      }
    }
  }
  // One list of parts, with the static parts next to each other as one.
  const parts: Part[] = [];
  for (const part of tops.flatMap((flush) => flush.parts)) {
    const previous = parts.at(-1);
    if (previous && 'static' in previous && 'static' in part) {
      parts[parts.length - 1] = { static: previous.static + part.static };
    } else {
      parts.push({ ...part });
    }
  }
  const found = clonedTemplate(parts);
  if (!found) {
    return false;
  }
  const flush = tops[0];
  const indent = /^ */.exec(emitter.lines[flush!.line]!)![0];
  const name = hoist(`$$b.template(${JSON.stringify(found.html)}, ${found.writes.length})`);
  const lines = [`${indent}const [$$f, $$e] = $$b.clone(${name});`];
  // The calls that fill the nested blocks, after the slots of the body are set, which the
  // renders of the blocks read.
  const fills: string[] = [];
  let missing = false;
  found.writes.forEach((writes, index) => {
    // The scope of the anchor of the element, where its content finds its contexts.
    const anchored = writes.find((write) => write.kind === 'anchor');
    const at = anchored?.kind === 'anchor' ? `, ${anchored.scope}` : '';
    for (const write of writes) {
      if (write.kind === 'anchor') {
        lines.push(`${indent}$$b.keep(${write.scope}, ${write.anchor}, $$e[${index}]);`);
      } else if (write.kind === 'last') {
        lines.push(
          `${indent}$$b.appendText(${write.scope}, ${write.anchor}, $$e[${index}], ${write.value}${write.at ? `, ${write.at}` : ''});`,
        );
      } else if (write.kind === 'text') {
        lines.push(
          `${indent}$$b.keepText(${write.scope}, ${write.anchor}, $$e[${index}], ${write.value}${write.at ? `, ${write.at}` : ''});`,
        );
      } else if (write.kind === 'attribute') {
        lines.push(`${indent}$$b.setAttr($$e[${index}], ${write.name}, ${write.value});`);
      } else if (write.kind === 'component') {
        lines.push(`${indent}$$b.place($$e[${index}], ${write.call});`);
      } else if (write.kind === 'comment') {
        lines.push(`${indent}$$b.nameComment($$e[${index}], ${write.data});`);
      } else if (write.kind === 'put') {
        lines.push(
          `${indent}$$b.putText($$e[${index}], ${write.value}${write.at ? `, ${write.at}` : ''});`,
        );
      } else if (write.kind === 'call') {
        lines.push(`${indent}${write.call.replace('$$m', () => `$$e[${index}]`)};`);
      } else if (write.kind === 'marker') {
        lines.push(
          `${indent}$$b.markBlock($$e[${index}], ${write.scope}, ${write.anchor}, ${JSON.stringify(write.suffix)});`,
        );
      } else if (write.kind === 'block') {
        const call = emitter.fills.get(`${write.scope}:${write.anchor}`);
        if (call === undefined) {
          missing = true;
        } else {
          fills.push(`${indent}${call.replace('$$m', () => `$$e[${index}]`)};`);
        }
      } else {
        lines.push(
          `${indent}$$b.setContent($$e[${index}], ${write.value}${write.at ? `, ${write.at}` : at});`,
        );
      }
    }
  });
  if (missing) {
    return false;
  }
  // The clone and its writes go where the last `$$html +=` was, after the values they read.
  const result: string[] = [];
  const resultLevels: Level[] = [];
  const moved = new Map<number, number>();
  const level: Level = { fn, control: false };
  source.forEach((line, at) => {
    if (at === last) {
      result.push(...lines);
      resultLevels.push(...lines.map(() => level));
    } else if (!flushLines.has(at) && !dropped.has(at)) {
      moved.set(at, result.length);
      result.push(line);
      resultLevels.push(levels[at]!);
    }
  });
  result.push(...fills);
  resultLevels.push(...fills.map(() => level));
  source.splice(0, source.length, ...result);
  levels.splice(0, levels.length, ...resultLevels);
  // The lines of the other `$$html +=` and plain blocks, such as of a function inside, moved.
  const others = emitter.flushes
    .filter((flush) => !flushLines.has(flush.line))
    .map((flush) => ({ ...flush, line: moved.get(flush.line)! }));
  emitter.flushes.splice(0, emitter.flushes.length, ...others);
  const braces = [...emitter.plainBraces].filter((at) => !dropped.has(at));
  emitter.plainBraces.clear();
  for (const at of braces) {
    emitter.plainBraces.add(moved.get(at)!);
  }
  return true;
}
