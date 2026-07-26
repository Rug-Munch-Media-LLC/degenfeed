/**
 * @degenfeed/api-worker — Standardized error classes
 *
 * Every route handler and middleware MUST use these error classes instead
 * of constructing ad-hoc error responses. The `handleError()` catch-all in
 * app.ts catches these and returns consistent JSON error shapes.
 *
 * USAGE:
 *   import { NotFoundError, ValidationError, handleError } from '../lib/errors';
 *
 *   // In route handlers:
 *   if (!post) throw new NotFoundError('Post not found');
 *   if (!valid) throw new ValidationError('Invalid input', { field: 'email' });
 *
 *   // In catch blocks (when you can't rethrow):
 *   return handleError(err, env, { route: '/api/post', method: 'GET' });
 *
 * ERROR SHAPE (returned to client):
 *   {
