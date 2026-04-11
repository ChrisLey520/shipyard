import { spawn } from 'child_process';
import * as path from 'path';

export const DEFAULT_BUILD_DOCKER_IMAGE =
  process.env['SHIPYARD_BUILD_DOCKER_IMAGE']?.trim() || 'node:20-bookworm';

/** Linux 且显式开启时使用容器内执行构建命令 */
export function shouldRunBuildInDocker(): boolean {
  if (process.env['SHIPYARD_BUILD_USE_DOCKER'] !== 'true') return false;
  return process.platform === 'linux';
}

export function assertDockerBuildSupportedOrThrow(): void {
  if (process.env['SHIPYARD_BUILD_USE_DOCKER'] !== 'true') return;
  if (process.platform !== 'linux') {
    throw new Error(
      `[docker-build] SHIPYARD_BUILD_USE_DOCKER=true 仅在 Linux Worker 上支持；当前平台为 ${process.platform}。请关闭该开关或改用 Linux 构建机。`,
    );
  }
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`;
}

/**
 * 在容器内执行单条 shell 命令（工作目录 /workspace，与宿主 tmpDir 挂载一致）。
 */
export async function runInBuildContainer(opts: {
  tmpDir: string;
  image: string;
  shellCommand: string;
  env: Record<string, string>;
  timeoutMs: number;
  onLine: (line: string) => void;
}): Promise<void> {
  const envArgs: string[] = [];
  for (const [k, v] of Object.entries(opts.env)) {
    envArgs.push('-e', `${k}=${v}`);
  }

  const args = [
    'run',
    '--rm',
    ...envArgs,
    '-v',
    `${path.resolve(opts.tmpDir)}:/workspace`,
    '-w',
    '/workspace',
    opts.image,
    'bash',
    '-lc',
    opts.shellCommand,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new Error(`[docker-build] 命令超时（${Math.round(opts.timeoutMs / 1000)}s）`));
    }, opts.timeoutMs);

    const onData = (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        if (line) opts.onLine(line);
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code === 0) resolve();
      else reject(new Error(`[docker-build] 容器内命令退出码 ${code}`));
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(
        err instanceof Error
          ? new Error(`[docker-build] 无法启动 docker：${err.message}（请确认已安装 Docker 且当前用户有权访问 daemon）`)
          : err,
      );
    });
  });
}

/** 将 argv 拼成安全的 bash 单行（简单转义） */
export function argvToShellCommand(cmd: string, args: string[]): string {
  return [cmd, ...args].map((a) => shellQuote(a)).join(' ');
}

/** 构建开始前探测 docker 是否可用 */
export async function probeDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('docker', ['info'], { stdio: 'ignore' });
    child.on('close', (c) => resolve(c === 0));
    child.on('error', () => resolve(false));
  });
}
