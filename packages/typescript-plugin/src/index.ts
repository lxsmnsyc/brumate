import { createBrumateLanguagePlugin, dedupeDiagnostics } from '@brumate/language-core';
import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';

type Factory = ReturnType<typeof createLanguageServicePlugin>;
type PluginInfo = Parameters<ReturnType<Factory>['create']>[0];

const volar: Factory = createLanguageServicePlugin(() => ({
  languagePlugins: [createBrumateLanguagePlugin<string>()],
}));

/**
 * A TypeScript server plugin. Editors that use the TypeScript server check
 * `.brm` files, and `.ts` files that import them get each component's props.
 * The proxy of Volar maps diagnostics back to the file without removing
 * repeats, so the same error of a template used twice is dropped here.
 */
function plugin(modules: Parameters<Factory>[0]): ReturnType<Factory> {
  const module = volar(modules);
  return {
    ...module,
    create(info: PluginInfo) {
      const service = module.create(info);
      const semantic = service.getSemanticDiagnostics.bind(service);
      const suggestion = service.getSuggestionDiagnostics.bind(service);
      return new Proxy(service, {
        get(target, key, receiver) {
          if (key === 'getSemanticDiagnostics') {
            return (fileName: string) => dedupeDiagnostics(semantic(fileName));
          }
          if (key === 'getSuggestionDiagnostics') {
            return (fileName: string) => dedupeDiagnostics(suggestion(fileName));
          }
          return Reflect.get(target, key, receiver);
        },
      });
    },
  };
}

export default plugin;
