import { fileURLToPath } from 'node:url';
import { BrumateError, CompileError, compile, findError } from 'brumate';
import type { Diagnostic as CompilerDiagnostic } from 'brumate';
import type { Diagnostic, LanguageServicePlugin } from '@volar/language-server';
import type { TextDocument } from 'vscode-languageserver-textdocument';

// `DiagnosticSeverity.Error` and `DiagnosticSeverity.Warning` of the protocol.
const ERROR = 1;
const WARNING = 2;

function toDiagnostic(document: TextDocument, diagnostic: CompilerDiagnostic): Diagnostic {
  // An error with an entry in the catalog has a code and a page that explains it.
  const entry = diagnostic.severity === 'error' ? findError(diagnostic.message) : undefined;
  return {
    severity: diagnostic.severity === 'error' ? ERROR : WARNING,
    message: diagnostic.message,
    source: 'brumate',
    ...(entry?.code && { code: entry.code }),
    ...(entry?.link && { codeDescription: { href: entry.link } }),
    range: {
      start: document.positionAt(diagnostic.range.start),
      end: document.positionAt(Math.max(diagnostic.range.end, diagnostic.range.start + 1)),
    },
  };
}

/**
 * The errors and warnings of the compiler for a `.brm` file, such as a
 * write outside a client root. Type errors come from TypeScript instead.
 */
export function diagnose(document: TextDocument, filename: string): Diagnostic[] {
  try {
    const diagnostics: Diagnostic[] = [];
    for (const warning of compile(document.getText(), { filename }).warnings) {
      diagnostics.push(toDiagnostic(document, warning));
    }
    return diagnostics;
  } catch (error) {
    if (error instanceof CompileError) {
      const diagnostics: Diagnostic[] = [];
      for (const diagnostic of error.diagnostics) {
        diagnostics.push(toDiagnostic(document, diagnostic));
      }
      return diagnostics;
    }
    if (error instanceof BrumateError) {
      // The code is in the message. It becomes the code of the diagnostic.
      const message = error.message.replace(/ \([^()]*:\d+:\d+\)$/, '').replace(/ \[BRM\d+\]$/, '');
      return [
        toDiagnostic(document, {
          severity: 'error',
          message,
          range: { start: error.offset, end: error.offset + 1 },
        }),
      ];
    }
    throw error;
  }
}

/** Reports the diagnostics of the compiler for `.brm` documents. */
export function createDiagnosticsPlugin(): LanguageServicePlugin {
  return {
    name: 'brumate-diagnostics',
    capabilities: {
      diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
    },
    create() {
      return {
        provideDiagnostics(document) {
          if (document.languageId !== 'brumate') {
            return undefined;
          }
          return diagnose(
            document,
            document.uri.startsWith('file:') ? fileURLToPath(document.uri) : document.uri,
          );
        },
      };
    },
  };
}
