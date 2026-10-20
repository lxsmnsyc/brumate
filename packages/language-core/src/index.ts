import type {
  CodeInformation,
  CodeMapping,
  IScriptSnapshot,
  LanguagePlugin,
  VirtualCode,
} from '@volar/language-core';
import type { TypeScriptServiceScript } from '@volar/typescript';
import { toTypeScript } from 'brumate';
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
    embeddedCodes: [script],
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
