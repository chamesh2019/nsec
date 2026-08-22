import { spawn } from 'node:child_process';

export function runCommandWithSecrets(
  command: string[],
  secrets: Record<string, string>
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!command || command.length === 0) {
      return reject(new Error('No command provided to execute.'));
    }

    const [cmd, ...args] = command;
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...secrets
      }
    });

    const forwardSignal = (signal: NodeJS.Signals) => {
      if (child.pid && !child.killed) {
        child.kill(signal);
      }
    };

    process.on('SIGINT', () => forwardSignal('SIGINT'));
    process.on('SIGTERM', () => forwardSignal('SIGTERM'));
    process.on('SIGHUP', () => forwardSignal('SIGHUP'));

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code, signal) => {
      if (signal) {
        resolve(128 + 15);
      } else {
        resolve(code ?? 0);
      }
    });
  });
}
