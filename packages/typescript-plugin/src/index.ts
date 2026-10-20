import { createBrumateLanguagePlugin } from '@brumate/language-core';
import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';

/**
 * A TypeScript server plugin. Editors that use the TypeScript server check
 * `.brm` files, and `.ts` files that import them get each component's props.
 */
const plugin: ReturnType<typeof createLanguageServicePlugin> = createLanguageServicePlugin(() => ({
  languagePlugins: [createBrumateLanguagePlugin<string>()],
}));

export default plugin;
