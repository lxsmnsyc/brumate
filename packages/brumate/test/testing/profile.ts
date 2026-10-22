import { batched } from 'brumate/batch';
import { getProfiles } from './profiles.ts';

// Each row asks for one profile. The rows that the browser renders at once share one call.
export const getProfile: (id: string) => Promise<string> = batched(
  getProfiles,
  (found, id: string) => found[id] ?? 'Nobody',
);
