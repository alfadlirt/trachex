import { DomainError } from '@trachex/domain';

export type ApiStatus = 200 | 201 | 400 | 404 | 409 | 500;

export function statusForError(error: unknown): ApiStatus {
  if (error instanceof DomainError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return 404;
      case 'CONFLICT':
        return 409;
      case 'INVALID_OPERATION':
      case 'SCOPING':
        return 400;
      default:
        return 400;
    }
  }
  if (error instanceof Error && error.name === 'ZodError') {
    return 400;
  }
  if (error instanceof Error && 'code' in error && error.code === 'INVALID_UPLOAD') return 400;
  return 500;
}

export function errorPayload(error: unknown): { error: { code: string; message: string } } {
  if (error instanceof DomainError) {
    return { error: { code: error.code, message: error.message } };
  }
  if (error instanceof Error && error.name === 'ZodError') {
    return { error: { code: 'INVALID_INPUT', message: error.message } };
  }
  if (error instanceof Error && 'code' in error && error.code === 'INVALID_UPLOAD') {
    return { error: { code: 'INVALID_UPLOAD', message: error.message } };
  }
  return {
    error: {
      code: 'INTERNAL',
      message: error instanceof Error ? error.message : String(error),
    },
  };
}
