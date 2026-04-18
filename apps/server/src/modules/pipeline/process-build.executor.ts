import { spawn } from 'child_process';
import type { ProcessBuildRunOpts } from './container-build-runner.types';

export async function runProcessBuildCommand(opts: ProcessBuildRunOpts): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(opts.cmd, opts.args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onData = (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        if (line) opts.onLine(line);
      }
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`构建超时（${opts.timeoutLabelSeconds}s）`));
    }, opts.timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`命令退出码 ${code}`));
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/** 宿主进程构建执行器（与 {@link DockerBuildExecutor} 对偶）。 */
export class ProcessBuildExecutor {
  run(opts: ProcessBuildRunOpts): Promise<void> {
    return runProcessBuildCommand(opts);
  }
}
