import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Worker, Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, rmSync, existsSync } from 'fs';
import { unlink, writeFile, readdir } from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';
import { buildCloneUrl } from '@shipyard/shared';
import type { BuildJobData } from './pipeline.service';

// 安全的构建环境变量白名单
const SAFE_ENV_KEYS = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'TMP', 'TEMP'];

@Injectable()
export class BuildWorkerService implements OnModuleInit {
  private readonly logger = new Logger(BuildWorkerService.name);
  private workers = new Map<string, Worker>();
  private deployQueues = new Map<string, Queue>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
  ) {}

  async onModuleInit() {
    // 启动时为所有已有组织初始化 Worker
    const orgs = await this.prisma.organization.findMany({
      select: { id: true, buildConcurrency: true },
    });

    for (const org of orgs) {
      this.startWorkerForOrg(org.id, org.buildConcurrency);
    }

    // 监听新组织注册广播
    const sub = this.redis.getSubscriber();
    await sub.subscribe('worker:new-org');
    sub.on('message', (_channel: string, orgId: string) => {
      void this.prisma.organization
        .findUnique({ where: { id: orgId }, select: { buildConcurrency: true } })
        .then((org) => {
          if (org) this.startWorkerForOrg(orgId, org.buildConcurrency);
        });
    });

    this.logger.log(`BuildWorker initialized for ${orgs.length} organizations`);
  }

  private startWorkerForOrg(orgId: string, concurrency: number) {
    if (this.workers.has(orgId)) return;

    const worker = new Worker<BuildJobData>(
      `build:${orgId}`,
      async (job) => this.processBuild(job.data),
      {
        connection: this.redis.getClient(),
        concurrency,
      },
    );

    worker.on('failed', (job, err) => {
      this.logger.error(`Build job ${job?.id} failed: ${err.message}`);
    });

    this.workers.set(orgId, worker);

    // 为该组织准备 DeployQueue
    const deployQueue = new Queue(`deploy:${orgId}`, {
      connection: this.redis.getClient(),
    });
    this.deployQueues.set(orgId, deployQueue);
  }

  private async processBuild(data: BuildJobData) {
    const { deploymentId, projectId, environmentId, orgId } = data;
    const tmpDir = path.join('/tmp', `build-${deploymentId}`);

    try {
      // 标记构建开始
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'building', startedAt: new Date() },
      });

      const [project, gitConn, pipelineConfig] = await Promise.all([
        this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
        this.prisma.gitConnection.findUniqueOrThrow({ where: { projectId } }),
        this.prisma.pipelineConfig.findUniqueOrThrow({ where: { projectId } }),
      ]);

      // 解密 token，构造 clone URL
      const token = this.crypto.decrypt(gitConn.accessToken);
      const cloneUrl = buildCloneUrl(
        gitConn.gitProvider,
        project.repoFullName,
        token,
        gitConn.gitUsername ?? undefined,
      );

      mkdirSync(tmpDir, { recursive: true });

      // 获取环境变量（注入构建）
      const envVars = environmentId ? await this.getDecryptedEnvVars(environmentId) : {};

      // 写入 .env 文件（Phase 1）
      const envFilePath = path.join(tmpDir, '.env');
      const envContent = Object.entries(envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      await writeFile(envFilePath, envContent, 'utf8');

      let logSeq = 0;

      const runCmd = async (cmd: string, args: string[], cwd: string, label: string) => {
        await this.appendLog(deploymentId, logSeq++, `[${label}] $ ${cmd} ${args.join(' ')}`);

        // 只传入白名单环境变量 + 构建变量
        const safeEnv: Record<string, string> = {};
        for (const key of SAFE_ENV_KEYS) {
          const val = process.env[key];
          if (val !== undefined) safeEnv[key] = val;
        }
        // 注入项目环境变量
        Object.assign(safeEnv, envVars);

        await new Promise<void>((resolve, reject) => {
          const child = spawn(cmd, args, {
            cwd,
            env: safeEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          const onData = (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              void this.appendLog(deploymentId, logSeq++, line);
            }
          };

          child.stdout?.on('data', onData);
          child.stderr?.on('data', onData);

          // 超时处理
          const timeout = setTimeout(
            () => {
              child.kill('SIGTERM');
              reject(new Error(`构建超时（${pipelineConfig.timeoutSeconds}s）`));
            },
            pipelineConfig.timeoutSeconds * 1000,
          );

          child.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) resolve();
            else reject(new Error(`命令退出码 ${code}`));
          });
        });
      };

      // Git clone
      await runCmd('git', ['clone', '--depth', '1', cloneUrl, tmpDir], '/tmp', 'clone');

      // 检测包管理器
      const pm = await this.detectPackageManager(tmpDir);

      // install
      const installCmd = pipelineConfig.installCommand ?? `${pm} install`;
      const [installBin, ...installArgs] = installCmd.split(' ');
      await runCmd(installBin!, installArgs, tmpDir, 'install');

      // lint（可选）
      if (pipelineConfig.lintCommand) {
        const [bin, ...args] = pipelineConfig.lintCommand.split(' ');
        await runCmd(bin!, args, tmpDir, 'lint');
      }

      // test（可选）
      if (pipelineConfig.testCommand) {
        const [bin, ...args] = pipelineConfig.testCommand.split(' ');
        await runCmd(bin!, args, tmpDir, 'test');
      }

      // build
      const [buildBin, ...buildArgs] = pipelineConfig.buildCommand.split(' ');
      await runCmd(buildBin!, buildArgs, tmpDir, 'build');

      // 打包产物
      const artifactDir = process.env['ARTIFACT_STORE_PATH'] ?? './artifacts';
      mkdirSync(artifactDir, { recursive: true });
      const artifactPath = path.join(artifactDir, `${deploymentId}.tar.gz`);
      const outputDir = path.join(tmpDir, pipelineConfig.outputDir);

      await tar.create({ gzip: true, file: artifactPath, cwd: outputDir }, ['.']);

      await this.appendLog(deploymentId, logSeq++, `[archive] 产物打包完成: ${artifactPath}`);

      // 获取文件大小
      const { statSync } = await import('fs');
      const stat = statSync(artifactPath);

      // 写入 BuildArtifact 记录
      const artifact = await this.prisma.buildArtifact.create({
        data: {
          deploymentId,
          storagePath: artifactPath,
          sizeBytes: BigInt(stat.size),
        },
      });

      // 更新 Deployment 状态
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'success',
          artifactId: artifact.id,
          completedAt: new Date(),
          durationMs: Date.now() - (await this.getStartedAt(deploymentId)),
        },
      });

      // 自动入 DeployQueue（如果有 environmentId）
      if (environmentId) {
        await this.enqueueDeployment(orgId, deploymentId, projectId, environmentId);
      }

      await this.appendLog(deploymentId, logSeq++, '[done] 构建成功 ✓');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.appendLog(data.deploymentId, -1, `[error] ${message}`);
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed', completedAt: new Date() },
      });
    } finally {
      // 清理临时目录（含 .env）
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  }

  private async detectPackageManager(dir: string): Promise<string> {
    const files = await readdir(dir);
    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('yarn.lock')) return 'yarn';
    return 'npm';
  }

  private async appendLog(deploymentId: string, seq: number, content: string) {
    await Promise.all([
      this.prisma.deploymentLog.create({ data: { deploymentId, seq, content } }),
      this.redis.publishLog(deploymentId, { deploymentId, line: content, seq }),
    ]);
  }

  private async getDecryptedEnvVars(environmentId: string): Promise<Record<string, string>> {
    const vars = await this.prisma.envVariable.findMany({ where: { environmentId } });
    const result: Record<string, string> = {};
    for (const v of vars) {
      result[v.key] = this.crypto.decrypt(v.value);
    }
    return result;
  }

  private async getStartedAt(deploymentId: string): Promise<number> {
    const d = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { startedAt: true },
    });
    return d?.startedAt?.getTime() ?? Date.now();
  }

  private async enqueueDeployment(
    orgId: string,
    deploymentId: string,
    projectId: string,
    environmentId: string,
  ) {
    // 检查环境是否受保护（需要审批）
    const env = await this.prisma.environment.findUniqueOrThrow({ where: { id: environmentId } });
    if (env.protected) {
      const deployment = await this.prisma.deployment.findUniqueOrThrow({ where: { id: deploymentId } });
      await this.prisma.deployment.update({ where: { id: deploymentId }, data: { status: 'pending_approval' } });
      await this.prisma.approvalRequest.create({
        data: {
          deploymentId,
          requestedByUserId: deployment.triggeredByUserId ?? undefined,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending',
        },
      });
      return;
    }

    // 入 DeployQueue
    await this.prisma.deployment.update({ where: { id: deploymentId }, data: { status: 'queued' } });
    const queue = this.deployQueues.get(orgId) ?? new Queue(`deploy:${orgId}`, { connection: this.redis.getClient() });
    await queue.add('deploy', { deploymentId, projectId, environmentId, orgId }, {
      jobId: `deploy-${deploymentId}`,
    });
  }
}
