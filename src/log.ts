import { createInterface } from "node:readline/promises";

export type LogType = "info" | "success" | "error" | "warn";

export function log(message: string, type?: LogType): void {
  const color = type && colors[type];
  console.log(color ? `${color}${message}${colors.reset}` : message);
}

export async function prompt(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return true;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `${colors.info}?${colors.reset} ${message} ${colors.dim}(Y/n)${colors.reset} `,
    );
    return !/^n(o)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  info: "\x1b[36m",
  success: "\x1b[32m",
  error: "\x1b[31m",
  warn: "\x1b[33m",
} as const;
