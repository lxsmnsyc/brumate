import { createContext } from 'brumate';
export const LabelCtx = createContext<{ label: () => string }>();
