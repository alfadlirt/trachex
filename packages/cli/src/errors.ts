export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;
export const EXIT_DOMAIN = 3;

export class CliError extends Error {
  readonly exitCode: number;
  readonly code: string;

  constructor(message: string, exitCode = EXIT_ERROR, code = 'CLI_ERROR') {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    this.code = code;
  }
}

export function usageError(message: string): CliError {
  return new CliError(message, EXIT_USAGE, 'USAGE');
}
