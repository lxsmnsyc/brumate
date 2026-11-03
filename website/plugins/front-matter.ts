/**
 * The front matter of a page: lines of `key: value` between two `---` lines at the top of the
 * file. A value in double quotes is read as JSON, any other value is the text of the line.
 */
export interface FrontMatter {
  /** The summary on the card of the page in the section of @brumate/ui. */
  summary?: string;
}

/** Splits the front matter off a source. Without any, the data is empty and the body is the source. */
export function splitFrontMatter(source: string): { data: FrontMatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) {
    return { data: {}, body: source };
  }
  const data: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const pair = /^([\w-]+):\s*(.*)$/.exec(line);
    if (pair) {
      const value = pair[2]!.trim();
      data[pair[1]!] = value.startsWith('"') ? (JSON.parse(value) as string) : value;
    }
  }
  return { data, body: source.slice(match[0].length) };
}

/** A line of front matter for a value, quoted when a plain value would read wrong. */
export function frontMatterLine(key: string, value: string): string {
  const plain = !/^["'\s]|[:#]\s|\s$/.test(value) && !value.includes(': ');
  return `${key}: ${plain ? value : JSON.stringify(value)}`;
}
