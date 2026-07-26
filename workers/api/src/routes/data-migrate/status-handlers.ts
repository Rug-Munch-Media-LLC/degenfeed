import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import type { MigrationJob } from './types';

export async function handleMigrationStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const jobs = await listJobs(env, session.address);

  return ok({
    wallet: session.address,
    recentJobs: jobs.slice(0, 10),
    totalJobs: jobs.length,
    inProgress: jobs.filter((j) => j.status === 'processing' || j.status === 'pending').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  });
}

/**
 * GET /api/account/migrate/jobs
 * List all recent migration jobs.
 */
export async function handleMigrationJobs(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const jobs = await listJobs(env, session.address);

  return ok({
    jobs,
    total: jobs.length,
  });
}
