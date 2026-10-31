// The versions of the packages, read when the site builds, for the badges of the header.
import brumate from '../../packages/brumate/package.json' with { type: 'json' };
import ui from '../../packages/ui/package.json' with { type: 'json' };

export const BRUMATE_VERSION = brumate.version;
export const UI_VERSION = ui.version;
