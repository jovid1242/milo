import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { ApiException } from './api-exception';

type FieldError = { path: string; message: string };

const pathOf = (path: readonly PropertyKey[]) => path.map(String).join('.');

/** One entry per field; an unknown field is named by its own path. */
function fieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.flatMap((issue) =>
    issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => ({ path: pathOf([...issue.path, key]), message: 'Unknown field' }))
      : [{ path: pathOf(issue.path), message: issue.message }],
  );
}

/**
 * Validates a request with one of the shared schemas — the same ones the app
 * uses — and hands the handler the parsed (normalized) value.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ApiException(
      400,
      'VALIDATION_ERROR',
      'Some fields are not valid.',
      fieldErrors(result.error),
    );
  }
}
