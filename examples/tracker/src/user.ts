import { createContext } from 'brumate/context';

/** The name of the user who is signed in. The root layout provides it. */
export const CurrentUser = createContext<string | undefined>('user', undefined);
