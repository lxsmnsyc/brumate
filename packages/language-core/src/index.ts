import type {
  CodeInformation,
  CodeMapping,
  IScriptSnapshot,
  LanguagePlugin,
  VirtualCode,
} from '@volar/language-core';
import type { TypeScriptServiceScript } from '@volar/typescript';
import { parse, toTypeScript } from 'brumate';
import type { BrumateError } from 'brumate';

export const LANGUAGE_ID = 'brumate';
export const EXTENSION = '.brm';

/** Every language feature, for code that is copied from the file. */
const FEATURES: CodeInformation = {
  verification: true,
  completion: true,
  semantic: true,
  navigation: true,
  structure: false,
  format: false,
};

// `ts.ScriptKind.TS` and `ts.ScriptKind.Deferred`.
const SCRIPT_KIND_TS = 3;
const SCRIPT_KIND_DEFERRED = 7;

export interface BrumateLanguagePluginOptions {
  /** Called when a file has a syntax error. */
  onError?(fileName: string, error: BrumateError): void;
}

function createSnapshot(text: string): IScriptSnapshot {
  return {
    getText: (start, end) => text.slice(start, end),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

/** CSS features for the text of a style block. Formatting would rewrite the interpolations. */
const STYLE_FEATURES: CodeInformation = { ...FEATURES, verification: true, format: false };

/**
 * The style blocks of a file, each as its own CSS, SCSS or Less code. An
 * interpolation such as `${size}` becomes underscores of the same length, a
 * name that the CSS service accepts, so offsets stay the same.
 */
function styleCodes(source: string, fileName: string): VirtualCode[] {
  let styles;
  try {
    ({ styles } = parse(source, { filename: fileName }));
  } catch {
    return [];
  }
  return styles.map((style, index) => {
    const start = style.start + source.slice(style.start, style.end).indexOf('>') + 1;
    const content = source.slice(start, start + style.content.length);
    const text = content.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, (match) =>
      '_'.repeat(match.length),
    );
    return {
      id: `style_${index}`,
      languageId: style.lang,
      snapshot: createSnapshot(text),
      mappings: [
        {
          sourceOffsets: [start],
          generatedOffsets: [0],
          lengths: [text.length],
          data: STYLE_FEATURES,
        },
      ],
    };
  });
}

/** The virtual code of a `.brm` file: the file, and the TypeScript generated from it. */
export function createBrumateVirtualCode(
  fileName: string,
  snapshot: IScriptSnapshot,
  options: BrumateLanguagePluginOptions = {},
): VirtualCode {
  const source = snapshot.getText(0, snapshot.getLength());
  const { code, mappings, error } = toTypeScript(source, fileName);
  if (error) {
    options.onError?.(fileName, error);
  }
  const script: VirtualCode = {
    id: 'ts',
    languageId: 'typescript',
    snapshot: createSnapshot(code),
    mappings: mappings.map((mapping): CodeMapping => ({
      sourceOffsets: [mapping.source],
      generatedOffsets: [mapping.generated],
      lengths: [mapping.length],
      data: FEATURES,
    })),
  };
  return {
    id: 'root',
    languageId: LANGUAGE_ID,
    snapshot,
    mappings: [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [source.length],
        data: { ...FEATURES, structure: true },
      },
    ],
    embeddedCodes: [script, ...styleCodes(source, fileName)],
  };
}

function getFileName(scriptId: unknown): string {
  return typeof scriptId === 'string' ? scriptId : String(scriptId);
}

/** The Volar language plugin for `.brm` files. */
export function createBrumateLanguagePlugin<T>(
  options: BrumateLanguagePluginOptions = {},
  asFileName: (scriptId: T) => string = getFileName,
): LanguagePlugin<T> {
  return {
    getLanguageId(scriptId) {
      return asFileName(scriptId).endsWith(EXTENSION) ? LANGUAGE_ID : undefined;
    },
    createVirtualCode(scriptId, languageId, snapshot) {
      if (languageId === LANGUAGE_ID) {
        return createBrumateVirtualCode(asFileName(scriptId), snapshot, options);
      }
      return undefined;
    },
    updateVirtualCode(scriptId, _virtualCode, snapshot) {
      return createBrumateVirtualCode(asFileName(scriptId), snapshot, options);
    },
    typescript: {
      extraFileExtensions: [
        { extension: 'brm', isMixedContent: true, scriptKind: SCRIPT_KIND_DEFERRED },
      ],
      getServiceScript(root): TypeScriptServiceScript | undefined {
        const code = root.embeddedCodes?.find((embedded) => embedded.id === 'ts');
        return code ? { code, extension: '.ts', scriptKind: SCRIPT_KIND_TS } : undefined;
      },
    },
  };
}

/** The fields of a TypeScript diagnostic that `dedupeDiagnostics` reads. */
export interface DiagnosticLike {
  file?: { fileName: string } | undefined;
  start?: number | undefined;
  length?: number | undefined;
  code: number;
  messageText: string | MessageChain;
}

interface MessageChain {
  messageText: string;
  next?: MessageChain[];
}

function messageKey(message: string | MessageChain): string {
  if (typeof message === 'string') {
    return message;
  }
  let key = message.messageText;
  for (const next of message.next ?? []) {
    key += `\n${messageKey(next)}`;
  }
  return key;
}

/**
 * Drops each diagnostic that repeats an earlier one: the same file, place, code and message. The
 * type check copies a template that is passed to props at each use, so an error in its body that
 * does not depend on the prop is reported once for each use, at the same place in the `.brm` file.
 */
export function dedupeDiagnostics<T extends DiagnosticLike>(diagnostics: readonly T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.file?.fileName,
      diagnostic.start,
      diagnostic.length,
      diagnostic.code,
      messageKey(diagnostic.messageText),
    ].join('\0');
    if (!seen.has(key)) {
      seen.add(key);
      kept.push(diagnostic);
    }
  }
  return kept;
}
