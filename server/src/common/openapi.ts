import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiResponse, type SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

import { ApiErrorBodySchema } from '@/schemas';

/**
 * OpenAPI from the same Zod schemas the API validates with, so the
 * documentation cannot drift from the real DTOs.
 */
export function openApiSchema(schema: z.ZodType, io: 'input' | 'output' = 'output') {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  }) as SchemaObject;
}

export const ApiJsonBody = (schema: z.ZodType) =>
  ApiBody({ schema: openApiSchema(schema, 'input') });

export const ApiJsonResponse = (status: number, description: string, schema?: z.ZodType) =>
  ApiResponse({ status, description, ...(schema ? { schema: openApiSchema(schema) } : {}) });

/** The error responses an endpoint can give, all in the `{ code, message, details? }` shape. */
export const ApiErrors = (...errors: [status: number, description: string][]) =>
  applyDecorators(
    ...errors.map(([status, description]) =>
      ApiResponse({ status, description, schema: openApiSchema(ApiErrorBodySchema) }),
    ),
  );
