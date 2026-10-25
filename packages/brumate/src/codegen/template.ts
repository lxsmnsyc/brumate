// Cloned templates of the markup that the browser renders. A render whose markup is one string
// of static HTML, attributes, the content of elements, and anchors compiles to a `<template>`
// that it clones, and writes the elements that it marks. The rest renders HTML.
import type { Emitter, Part } from './markup.ts';

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
  /** A child component, which renders in the place of a marked comment. */
  | { kind: 'component'; call: string };

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
// `$$b.insert(value)`, or `$$b.insert(value, undefined, scope)`, whose value can be children or
// a template, which render where they are inserted with the contexts of the scope.
const INSERT = /^\$\$b\.insert\(([\s\S]*?)(?:, undefined, ([\w$.]+))?\)$/;
const SCOPE = /^\$\$s\d+$/;
const ANCHOR_START = ' b-b="';
const ANCHOR_END = /^:(\d+)"/;
const TEXT_START = '<!--t';
const TEXT_END = /^:(\d+)-->/;
const TEXT_CLOSE = '<!--/t-->';
const BLOCK_START = '<!--b';
const COMPONENT = /^\$\$b\.component\(/;
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
    const insert = INSERT.exec(code);
    if (insert && reader.justOpened && !reader.raw && nextStatic?.startsWith('</')) {
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
        { kind: 'text', scope: code, anchor: Number(textEnd[1]), value: textInsert[1]! },
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
    const end = nextStatic === undefined ? null : ANCHOR_END.exec(nextStatic);
    if (SCOPE.test(code) && reader.inTag && reader.html.endsWith(ANCHOR_START) && end) {
      reader.takeBack(ANCHOR_START, 'tag');
      add({ kind: 'anchor', scope: code, anchor: Number(end[1]) });
      list[index + 1] = { static: nextStatic!.slice(end[0].length) };
      continue;
    }
    return undefined;
  }
  // Markers of blocks need the HTML of a render, and so does a body that writes nothing, which
  // gains nothing from a clone. The loader starts each `<template>` of a block once, such as of
  // a `$client` callback, so a clone of one would start nothing.
  const comments = reader.html.replace(/<!--x\d+-->(?:<!--\/b-->)?/g, '');
  if (writes.length === 0 || comments.includes('<!--') || /<template\b/i.test(reader.html)) {
    return undefined;
  }
  return { html: reader.html, writes };
}

/**
 * Replaces the one `$$html +=` line of a render with a clone of a template, and the writes on
 * the elements that it marks. `hoist` makes a constant of the module. Returns false when the
 * markup needs HTML.
 */
export function cloneLines(emitter: Emitter, hoist: (code: string) => string): boolean {
  const [flush] = emitter.flushes;
  const found = clonedTemplate([...flush!.parts]);
  if (!found) {
    return false;
  }
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
  emitter.lines.splice(flush!.line, 1, ...lines);
  emitter.lines.push(...fills);
  return true;
}
