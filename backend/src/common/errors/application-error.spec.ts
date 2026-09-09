import test from 'node:test';
import assert from 'node:assert/strict';
import type { ArgumentsHost } from '@nestjs/common';
import { ApplicationErrorFilter } from '@/common/errors/application-error.filter';
import { ApplicationError, type ApplicationErrorCode } from '@/common/errors/application.error';

function hostWithResponse() {
  const sent: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) { sent.status = code; return this; },
    json(body: unknown) { sent.body = body; return this; },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
  return { host, sent };
}

const EXPECTED: Record<ApplicationErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  service_unavailable: 503,
};

test('every application error code maps to an HTTP status', () => {
  const filter = new ApplicationErrorFilter();
  for (const [code, status] of Object.entries(EXPECTED) as [ApplicationErrorCode, number][]) {
    const { host, sent } = hostWithResponse();
    filter.catch(new ApplicationError(code, `${code} happened`), host);
    assert.equal(sent.status, status, `${code} should map to ${status}`);
    assert.deepEqual(sent.body, { statusCode: status, message: `${code} happened`, error: code });
  }
});

test('fromDriver wraps an unknown failure as a bad request but keeps the original', () => {
  const driverError = new Error('syntax error at or near "SELCT"');
  const wrapped = ApplicationError.fromDriver(driverError);
  assert.equal(wrapped.code, 'bad_request');
  assert.equal(wrapped.message, 'syntax error at or near "SELCT"');
  assert.equal(wrapped.cause, driverError);
});

test('fromDriver passes an existing application error through unchanged', () => {
  const original = ApplicationError.notFound('Row not found');
  assert.equal(ApplicationError.fromDriver(original), original);
});
