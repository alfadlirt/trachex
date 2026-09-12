import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

export function print(message = ''): void {
  process.stdout.write(`${message}\n`);
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function isInteractive(): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

export type ConfirmFn = (prompt: string) => Promise<boolean>;

let confirmImpl: ConfirmFn = async (prompt) => {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`${prompt} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
};

export function setConfirmImpl(fn: ConfirmFn): void {
  confirmImpl = fn;
}

export function confirm(prompt: string): Promise<boolean> {
  return confirmImpl(prompt);
}

export async function confirmIfInteractive(prompt: string): Promise<boolean | undefined> {
  return isInteractive() ? confirm(prompt) : undefined;
}
