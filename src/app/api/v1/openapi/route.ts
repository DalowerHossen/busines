// src/app/api/v1/openapi/route.ts
// A machine readable description of the public interface.
//
// Written by hand rather than generated, because a generated description
// documents what the code happens to do, and this one documents what the
// interface promises. The two diverging is the point at which somebody
// notices a breaking change before an integration does.

import { NextResponse } from 'next/server';

import { API_SCOPES } from '@/features/developers/scopes';
import { siteUrl } from '@/lib/seo/metadata';
import { HTTP_STATUS } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

/** The version of the interface this description belongs to. */
const API_VERSION = '2026-01-01';

/**
 * Builds the cursor paging parameters every list shares.
 *
 * @returns The parameter descriptions.
 */
function pagingParameters(): readonly Record<string, unknown>[] {
  return [
    {
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      description: 'How many records to return. A hundred is the most any page carries.',
    },
    {
      name: 'cursor',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description:
        'The next_cursor from the previous page. Paging by cursor rather than by page number means nothing is missed when older records change while you read.',
    },
  ];
}

/**
 * Serves the description of the public interface.
 *
 * @returns The description, as a document any client generator understands.
 */
export function GET(): NextResponse {
  const document = {
    openapi: '3.1.0',
    info: {
      title: 'KD SOLUTION IT public interface',
      version: API_VERSION,
      description:
        'Read the invoices, clients and payments of one business. Every request is made with an access token issued to an application that the business itself approved, and every token carries only the scopes that business agreed to.',
      contact: { email: 'support@kdsolutionit.com' },
    },
    servers: [{ url: `${siteUrl()}/api/v1` }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Invoices', description: 'Documents a business has issued.' },
      { name: 'Clients', description: 'The people and businesses being invoiced.' },
      { name: 'Payments', description: 'Money that has arrived.' },
      { name: 'Service', description: 'Checking that a token works.' },
    ],
    paths: {
      '/ping': {
        get: {
          tags: ['Service'],
          summary: 'Confirm a token works',
          description:
            'Answers with the account the token belongs to. Costs nothing and is the first call any integration should make.',
          responses: {
            '200': { description: 'The token is valid.' },
            '401': { description: 'The token is missing, expired or revoked.' },
            '429': { description: 'Too many requests; wait and try again.' },
          },
        },
      },
      '/invoices': {
        get: {
          tags: ['Invoices'],
          summary: 'List invoices',
          description: 'Newest first. Line items are not included; read one invoice for those.',
          parameters: [
            ...pagingParameters(),
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Narrow the list to one state, such as sent, paid or overdue.',
            },
          ],
          security: [{ bearerAuth: ['invoices:read'] }],
          responses: {
            '200': { description: 'A page of invoices.' },
            '403': { description: 'The application was not granted invoices:read.' },
          },
        },
      },
      '/invoices/{invoiceId}': {
        get: {
          tags: ['Invoices'],
          summary: 'Read one invoice',
          description: 'The whole document, including its lines.',
          parameters: [
            {
              name: 'invoiceId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Identifier of the invoice.',
            },
          ],
          security: [{ bearerAuth: ['invoices:read'] }],
          responses: {
            '200': { description: 'The invoice and its lines.' },
            '404': { description: 'No invoice with that identifier belongs to this account.' },
          },
        },
      },
      '/clients': {
        get: {
          tags: ['Clients'],
          summary: 'List clients',
          parameters: pagingParameters(),
          security: [{ bearerAuth: ['clients:read'] }],
          responses: {
            '200': { description: 'A page of clients.' },
            '403': { description: 'The application was not granted clients:read.' },
          },
        },
      },
      '/payments': {
        get: {
          tags: ['Payments'],
          summary: 'List payments',
          description:
            'Each payment reports what the collecting partner charged and what the platform kept, so the three parts always add back up to what the payer was charged.',
          parameters: [
            ...pagingParameters(),
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Narrow the list to one state, such as succeeded or refunded.',
            },
          ],
          security: [{ bearerAuth: ['payments:read'] }],
          responses: {
            '200': { description: 'A page of payments.' },
            '403': { description: 'The application was not granted payments:read.' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'An access token issued to an application the business approved. Send it as an Authorization header.',
        },
      },
      schemas: {
        Page: {
          type: 'object',
          properties: {
            has_more: { type: 'boolean' },
            next_cursor: { type: ['string', 'null'] },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string', description: 'A sentence a person can act on.' },
            code: { type: 'string' },
          },
        },
      },
    },
    'x-scopes': API_SCOPES.map((scope) => ({
      key: scope.key,
      label: scope.label,
      description: scope.description,
      is_write: scope.isWrite,
    })),
    'x-rate-limiting': {
      description:
        'Every response carries the remaining allowance in its headers. A refused request says how long to wait rather than leaving a client to guess.',
      headers: ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'],
    },
  };

  return NextResponse.json(document, {
    status: HTTP_STATUS.ok,
    headers: {
      'cache-control': 'public, max-age=300',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}
