import { allIssues } from '../../store.ts';

// An endpoint: GET /api/issues.json answers with the issues as JSON.
// `?open=true` or `?open=false` keeps only open or closed ones.
export function GET(request: Request): Response {
  const open = new URL(request.url).searchParams.get('open');
  const issues = allIssues().filter((issue) => open === null || String(issue.open) === open);
  return Response.json(issues);
}
