import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { GateError } from '@/core/engine';
import { CongressApiError } from './congress';

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}
export class RateLimitError extends Error {}

export interface HttpError {
  status: number;
  body: Record<string, unknown>;
}

export function toHttpError(e: unknown): HttpError {
  if (e instanceof GateError) {
    return { status: 409, body: { error: e.code, detail: e.detail } };
  }
  if (e instanceof ZodError) {
    return {
      status: 400,
      body: { error: 'invalid_request', fields: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
    };
  }
  if (e instanceof NotFoundError) {
    return { status: 404, body: { error: 'not_found', message: e.message } };
  }
  if (e instanceof ForbiddenError) {
    return { status: 403, body: { error: 'forbidden', message: e.message } };
  }
  if (e instanceof RateLimitError) {
    return { status: 429, body: { error: 'rate_limited', message: e.message } };
  }
  if (e instanceof CongressApiError) {
    return { status: 502, body: { error: 'congress_import_failed', message: e.message } };
  }
  const requestId = randomUUID();
  console.error(`[${requestId}]`, e);
  return { status: 500, body: { error: 'internal_error', requestId } };
}
