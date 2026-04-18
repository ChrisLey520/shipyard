import { spawn } from 'child_process';
import * as path from 'path';
import type { ContainerBuildRunOpts } from './container-build-runner.types';

export const DEFAULT_BUILD_DOCKER_IMAGE =
  process.env['SHIPYARD_BUILD_DOCKER_IMAGE']?.trim() || 'node:20-bookworm';

/** 默认 bridge，保证 pnpm/npm 可访问 registry（none 会导致 install 失败） */
export const DEFAULT_DOCKER_NETWORK = 'bridge';

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

/** 允许的 docker network 模式（防注入） */
const ALLOWED_NETWORKS = new Set(['bridge', 'host', 'none']);

function resolveDockerNetwork(): string {
  const raw = process.env['SHIPYARD_BUILD_DOCKER_NETWORK']?.trim();
  if (!raw) return DEFAULT_DOCKER_NETWORK;
  if (raw.startsWith('container:')) {
    const name = raw.slice('container:'.length).replace(/[^a-zA-Z0-9_.-]/g, '');
    if (!name) {
      throw new Error('[docker-build] SHIPYARD_BUILD_DOCKER_NETWORK=container: 须为非空容器名');
    }
    return `container:${name}`;
  }
  if (!ALLOWED_NETWORKS.has(raw)) {
    throw new Error(
      `[docker-build] SHIPYARD_BUILD_DOCKER_NETWORK 非法：${raw}。允许 bridge|host|none|container:<name>`,
    );
  }
  return raw;
}

function resolveDockerCpusArg(): string[] {
  const raw = process.env['SHIPYARD_BUILD_DOCKER_CPUS']?.trim();
  if (!raw) return [];
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`[docker-build] SHIPYARD_BUILD_DOCKER_CPUS 须为正数，收到：${raw}`);
  }
  return ['--cpus', String(n)];
}

function resolveDockerMemoryArg(): string[] {
  const raw = process.env['SHIPYARD_BUILD_DOCKER_MEMORY']?.trim();
  if (!raw) return [];
  if (raw.length > 32 || /[^0-9.kmgtKMGTbBiI]/.test(raw)) {
    throw new Error(`[docker-build] SHIPYARD_BUILD_DOCKER_MEMORY 格式可疑：${raw}（示例 512m、4g、1g）`);
  }
  return ['--memory', raw];
}

function resolvePrivilegedArgs(): string[] {
  if (process.env['SHIPYARD_BUILD_DOCKER_PRIVILEGED'] === 'true') {
    return ['--privileged'];
  }
  return [];
}

/**
 * 供测试与日志：生成 docker run 的资源/安全相关参数（不含 -v/-w/image）
 */
export function buildDockerResourceArgs(): { args: string[]; summary: Record<string, string> } {
  const network = resolveDockerNetwork();
  const cpus = resolveDockerCpusArg();
  const memory = resolveDockerMemoryArg();
  const priv = resolvePrivilegedArgs();
  const args = [`--network`, network, ...cpus, ...memory, ...priv];
  const summary: Record<string, string> = {
    network,
    cpus: cpus[1] ?? '(未限制)',
    memory: memory[1] ?? '(未限制)',
    privileged: priv.length ? 'true' : 'false',
  };
  return { args, summary };
}

/**
 * 在容器内执行单条 shell 命令（工作目录 /workspace，与宿主 tmpDir 挂载一致）。
 */
export async function runInBuildContainer(opts: ContainerBuildRunOpts): Promise<void> {
  const envArgs: string[] = [];
  for (const [k, v] of Object.entries(opts.env)) {
    envArgs.push('-e', `${k}=${v}`);
  }

  const { args: resourceArgs, summary } = buildDockerResourceArgs();
  opts.onLine(
    `[docker-build] run opts: network=${summary.network} cpus=${summary.cpus} memory=${summary.memory} privileged=${summary.privileged} image=${opts.image}`,
  );

  const args = [
    'run',
    '--rm',
    ...resourceArgs,
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

/** Docker 容器内构建执行器（与 {@link ProcessBuildExecutor} 对偶）。 */
export class DockerBuildExecutor {
  run(opts: ContainerBuildRunOpts): Promise<void> {
    return runInBuildContainer(opts);
  }
}
