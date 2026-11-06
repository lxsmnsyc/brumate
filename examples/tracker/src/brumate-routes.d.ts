// Written by the brumate Vite plugin from the route files. Do not edit.
export {};

declare module 'brumate/routes' {
  interface Routes {
    '/': {};
    '/about': {};
    '/api/issues.json': {};
    '/from': {};
    '/issues/[id]': { id: string };
    '/issues/new': {};
    '/sign-in': {};
    '/titles': {};
    '/titles/other': {};
  }
}
