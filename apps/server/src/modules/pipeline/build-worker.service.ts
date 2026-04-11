import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Worker, Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { GitAccessTokenService } from '../git/git-access-token.service';
import { GitCommitStatusService } from '../git/git-commit-status.service';
import { spawn } from 'child_process';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { writeFile, readdir } from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';
import { buildCloneUrl, GitProvider, NotificationEvent } from '@shipyard/shared';
import { NotificationEnqueueApplicationService } from '../notifications/application/notification-enqueue.application.service';
import { GitPrCommentApplicationService } from '../git/application/git-pr-comment.application.service';
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
    private readonly gitTokens: GitAccessTokenService,
    private readonly commitStatus: GitCommitStatusService,
    private readonly gitPrComment: GitPrCommentApplicationService,
    private readonly notifications: NotificationEnqueueApplicationService,
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
      `build-${orgId}`,
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
    const deployQueue = new Queue(`deploy-${orgId}`, {
      connection: this.redis.getClient(),
    });
    this.deployQueues.set(orgId, deployQueue);
  }

  private async processBuild(data: BuildJobData) {
    const { deploymentId, projectId, environmentId, orgId, previewId } = data;
    const tmpDir = path.join('/tmp', `build-${deploymentId}`);

    try {
      const depMeta = await this.prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { branch: true, trigger: true },
      });

      // 标记构建开始
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'building', startedAt: new Date() },
      });
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'build',
        'pending',
        'Shipyard build in progress',
      );

      const [project, gitConn, pipelineConfig] = await Promise.all([
        this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
        this.prisma.gitConnection.findUniqueOrThrow({ where: { projectId } }),
        this.prisma.pipelineConfig.findUniqueOrThrow({ where: { projectId } }),
      ]);

      const token = await this.gitTokens.getAccessTokenForProject(projectId);
      const cloneUrl = buildCloneUrl(
        gitConn.gitProvider,
        project.repoFullName,
        token,
        gitConn.gitUsername ?? undefined,
      );

      // 每次构建使用干净目录；Job 重试或异常退出时可能残留同名目录
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
      mkdirSync(tmpDir, { recursive: true });

      // 获取构建环境变量（注入构建）
      // 合并策略：项目级构建变量作为默认值，环境变量同名覆盖（更符合“按环境覆盖”）
      const projectBuildEnv = await this.getDecryptedProjectBuildEnvVars(projectId);
      const environmentEnv = environmentId ? await this.getDecryptedEnvVars(environmentId) : {};
      const envVars = { ...projectBuildEnv, ...environmentEnv };

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

      // Git clone（须在空目录执行；.env 需在 clone 之后写入，否则目标目录非空会报 fatal: ... already exists）
      await this.appendLog(deploymentId, logSeq++, '[clone] 开始拉取代码…');
      if (depMeta?.trigger === 'pr_preview' && depMeta.branch?.trim()) {
        await runCmd(
          'git',
          ['clone', '--depth', '1', '--single-branch', '--branch', depMeta.branch.trim(), cloneUrl, tmpDir],
          '/tmp',
          'clone',
        );
      } else {
        await runCmd('git', ['clone', '--depth', '1', cloneUrl, tmpDir], '/tmp', 'clone');
      }

      const envFilePath = path.join(tmpDir, '.env');
      const envContent = Object.entries(envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      await writeFile(envFilePath, envContent, 'utf8');

      // 检测包管理器
      const pm = await this.detectPackageManager(tmpDir);

      // install
      const installCmd = pipelineConfig.installCommand ?? `${pm} install`;
      const [installBin, ...installArgs] = installCmd.split(' ');
      await this.appendLog(deploymentId, logSeq++, '[install] 开始安装依赖…');
      await runCmd(installBin!, installArgs, tmpDir, 'install');

      // lint（可选）
      if (pipelineConfig.lintCommand) {
        const [bin, ...args] = pipelineConfig.lintCommand.split(' ');
        await this.appendLog(deploymentId, logSeq++, '[lint] 开始代码检查…');
        await runCmd(bin!, args, tmpDir, 'lint');
      } else {
        await this.appendLog(deploymentId, logSeq++, '[lint] 已跳过（未配置 lintCommand）');
      }

      // test（可选）
      if (pipelineConfig.testCommand) {
        const [bin, ...args] = pipelineConfig.testCommand.split(' ');
        await this.appendLog(deploymentId, logSeq++, '[test] 开始测试…');
        await runCmd(bin!, args, tmpDir, 'test');
      } else {
        await this.appendLog(deploymentId, logSeq++, '[test] 已跳过（未配置 testCommand）');
      }

      // build
      const [buildBin, ...buildArgs] = pipelineConfig.buildCommand.split(' ');
      await this.appendLog(deploymentId, logSeq++, '[build] 开始构建…');
      await runCmd(buildBin!, buildArgs, tmpDir, 'build');

      // 打包产物（outputDir 为仓库根下的相对路径，需与真实构建输出一致）
      const artifactDir = process.env['ARTIFACT_STORE_PATH'] ?? './artifacts';
      mkdirSync(artifactDir, { recursive: true });
      const artifactPath = path.join(artifactDir, `${deploymentId}.tar.gz`);
      const tmpAbs = path.resolve(tmpDir);
      const outputDir = path.resolve(tmpAbs, pipelineConfig.outputDir);
      const relToRepo = path.relative(tmpAbs, outputDir);
      if (relToRepo.startsWith('..') || path.isAbsolute(relToRepo)) {
        throw new Error('输出目录配置非法：必须位于仓库根目录内');
      }
      if (!existsSync(outputDir)) {
        let listing = '';
        try {
          const names = await readdir(tmpAbs);
          listing = names.length ? ` 仓库根下现有项: ${names.slice(0, 40).join(', ')}${names.length > 40 ? ' …' : ''}` : ' 仓库根下为空';
        } catch {
          listing = '';
        }
        throw new Error(
          `产物目录不存在: 「${pipelineConfig.outputDir}」→ ${outputDir}。请在项目「编辑 → 构建配置」把「输出目录」改成与构建结果一致（如 Vite 多为 dist，部分模板为 build 或子包路径 apps/web/dist）。${listing}`,
        );
      }

      await this.appendLog(deploymentId, logSeq++, `[archive] 开始打包产物（目录 ${pipelineConfig.outputDir}）…`);
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
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'build',
        'success',
        'Shipyard build succeeded',
      );

      void this.notifications.enqueue(
        projectId,
        NotificationEvent.BUILD_SUCCESS,
        `构建成功：部署 ${deploymentId.slice(0, 8)}…`,
        { deploymentId },
      );

      // 自动入 DeployQueue（如果有 environmentId）
      if (environmentId) {
        await this.enqueueDeployment(orgId, deploymentId, projectId, environmentId);
      } else {
        const pvId =
          previewId ??
          (await this.prisma.preview.findUnique({ where: { deploymentId }, select: { id: true } }))
            ?.id;
        if (pvId) {
          await this.enqueuePreviewDeployment(orgId, deploymentId, projectId, pvId);
        }
      }

      await this.appendLog(deploymentId, logSeq++, '[done] 构建成功 ✓');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.appendLog(data.deploymentId, -1, `[error] ${message}`);
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed', completedAt: new Date() },
      });
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'build',
        'failure',
        'Shipyard build failed',
      );

      void this.notifications.enqueue(
        projectId,
        NotificationEvent.BUILD_FAILED,
        `构建失败：${message}`,
        { deploymentId },
      );

      const pv = await this.prisma.preview.findUnique({ where: { deploymentId } });
      if (pv) {
        const [p, gc] = await Promise.all([
          this.prisma.project.findUnique({
            where: { id: projectId },
            select: { repoFullName: true },
          }),
          this.prisma.gitConnection.findUnique({
            where: { projectId },
            select: { gitProvider: true, baseUrl: true },
          }),
        ]);
        if (
          p?.repoFullName &&
          gc &&
          (gc.gitProvider === GitProvider.GITHUB ||
            gc.gitProvider === GitProvider.GITLAB ||
            gc.gitProvider === GitProvider.GITEE ||
            gc.gitProvider === GitProvider.GITEA)
        ) {
          const accessToken = await this.gitTokens.getAccessTokenForProject(projectId);
          const body = `❌ **Shipyard Preview** build failed for **#${pv.prNumber}**.\n\n\`\`\`\n${message}\n\`\`\``;
          const commentId = await this.gitPrComment.upsertPrPreviewComment({
            provider: gc.gitProvider,
            repoFullName: p.repoFullName,
            prNumber: pv.prNumber,
            accessToken,
            baseUrl: gc.baseUrl,
            body,
            existingCommentId: pv.commentId,
          });
          if (commentId) {
            await this.prisma.preview.update({ where: { id: pv.id }, data: { commentId } });
          }
        }
      }
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

  private async getDecryptedProjectBuildEnvVars(projectId: string): Promise<Record<string, string>> {
    const vars = await this.prisma.projectBuildEnvVariable.findMany({ where: { projectId } });
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

  private async enqueuePreviewDeployment(
    orgId: string,
    deploymentId: string,
    projectId: string,
    previewRowId: string,
  ) {
    const queue = this.deployQueues.get(orgId) ?? new Queue(`deploy-${orgId}`, { connection: this.redis.getClient() });
    await queue.add(
      'deploy',
      { deploymentId, projectId, previewId: previewRowId, orgId },
      { jobId: `deploy-${deploymentId}` },
    );
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
      const ar = await this.prisma.approvalRequest.create({
        data: {
          deploymentId,
          requestedByUserId: deployment.triggeredByUserId ?? undefined,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending',
        },
      });
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'build',
        'pending',
        'Waiting for deployment approval',
      );
      void this.notifications.enqueue(
        projectId,
        NotificationEvent.APPROVAL_PENDING,
        `部署待审批：${deploymentId.slice(0, 8)}…`,
        { deploymentId, approvalId: ar.id },
      );
      return;
    }

    // 入 DeployQueue
    await this.prisma.deployment.update({ where: { id: deploymentId }, data: { status: 'queued' } });
    const queue = this.deployQueues.get(orgId) ?? new Queue(`deploy-${orgId}`, { connection: this.redis.getClient() });
    await queue.add('deploy', { deploymentId, projectId, environmentId, orgId }, {
      jobId: `deploy-${deploymentId}`,
    });
  }
}
