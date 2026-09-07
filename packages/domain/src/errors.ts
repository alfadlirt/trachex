export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class InvalidOperationError extends DomainError {
  constructor(message: string) {
    super('INVALID_OPERATION', message);
    this.name = 'InvalidOperationError';
  }
}

export class ScopingError extends DomainError {
  constructor(message: string) {
    super('SCOPING', message);
    this.name = 'ScopingError';
  }
}
