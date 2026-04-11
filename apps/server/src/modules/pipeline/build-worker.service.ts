import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import * as os from 'os';
import { Worker, Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { GitAccessTokenService } from '../git/git-access-token.service';
import { GitCommitStatusService } from '../git/git-commit-status.service';
import { spawn } from 'child_process';
import { mkdirSync, rmSync, existsSync, cpSync } from 'fs';
import { writeFile, readdir, readFile } from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';
import { buildCloneUrl, GitProvider, NotificationEvent } from '@shipyard/shared';
import { NotificationEnqueueApplicationService } from '../notifications/application/notification-enqueue.application.service';
import { ArtifactRetentionApplicationService } from '../artifacts/application/artifact-retention.application.service';
import { GitPrCommentApplicationService } from '../git/application/git-pr-comment.application.service';
import type { BuildJobData } from './pipeline.service';
import { logDockerBuildModeOnStartup } from './docker-build-flag';
import {
  argvToShellCommand,
  DEFAULT_BUILD_DOCKER_IMAGE,
  DockerBuildExecutor,
  probeDockerAvailable,
  shouldRunBuildInDocker,
} from './docker-build.executor';
import { ProcessBuildExecutor } from './process-build.executor';
import { resolveCacheMaxBytes, runDepsCacheEvictionPipeline } from './build-deps-cache';

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
    private readonly artifactRetention: ArtifactRetentionApplicationService,
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
    logDockerBuildModeOnStartup(this.logger);
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

      const useDocker = shouldRunBuildInDocker();
      if (useDocker) {
        const dockerOk = await probeDockerAvailable();
        if (!dockerOk) {
          throw new Error(
            '[docker-build] 无法连接 Docker daemon（`docker info` 失败）。请安装 Docker 并保证 Worker 进程用户有权访问，或设置 SHIPYARD_BUILD_USE_DOCKER=false。',
          );
        }
      }
      const dockerImage = DEFAULT_BUILD_DOCKER_IMAGE;

      // 获取构建环境变量（注入构建）
      // 合并策略：项目级构建变量作为默认值，环境变量同名覆盖（更符合“按环境覆盖”）
      const projectBuildEnv = await this.getDecryptedProjectBuildEnvVars(projectId);
      const environmentEnv = environmentId ? await this.getDecryptedEnvVars(environmentId) : {};
      const envVars = { ...projectBuildEnv, ...environmentEnv };

      let logSeq = 0;

      const processExecutor = new ProcessBuildExecutor();
      const dockerExecutor = new DockerBuildExecutor();

      const runCmd = async (
        cmd: string,
        args: string[],
        cwd: string,
        label: string,
        opts?: { hostOnly?: boolean },
      ) => {
        await this.appendLog(deploymentId, logSeq++, `[${label}] $ ${cmd} ${args.join(' ')}`);

        const safeEnv: Record<string, string> = {};
        for (const key of SAFE_ENV_KEYS) {
          const val = process.env[key];
          if (val !== undefined) safeEnv[key] = val;
        }
        Object.assign(safeEnv, envVars);

        const timeoutMs = pipelineConfig.timeoutSeconds * 1000;
        const appendLine = (line: string) => {
          void this.appendLog(deploymentId, logSeq++, line);
        };

        const inDocker = useDocker && !opts?.hostOnly;
        if (inDocker) {
          if (path.resolve(cwd) !== path.resolve(tmpDir)) {
            throw new Error(`[docker-build] 当前仅支持在仓库根目录执行命令，收到 cwd=${cwd}`);
          }
          const shellCommand = argvToShellCommand(cmd, args);
          await dockerExecutor.run({
            tmpDir,
            image: dockerImage,
            shellCommand,
            env: safeEnv,
            timeoutMs,
            onLine: appendLine,
          });
          return;
        }

        await processExecutor.run({
          cmd,
          args,
          cwd,
          env: safeEnv,
          timeoutMs,
          timeoutLabelSeconds: pipelineConfig.timeoutSeconds,
          onLine: appendLine,
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
          { hostOnly: true },
        );
      } else {
        await runCmd('git', ['clone', '--depth', '1', cloneUrl, tmpDir], '/tmp', 'clone', {
          hostOnly: true,
        });
      }

      const envFilePath = path.join(tmpDir, '.env');
      const envContent = Object.entries(envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      await writeFile(envFilePath, envContent, 'utf8');

      // 检测包管理器
      const pm = await this.detectPackageManager(tmpDir);

      const fp = await this.lockfileFingerprint(tmpDir, pm);
      const cacheModulesPath = path.join(this.buildDepsCacheRoot(), orgId, pm, fp, 'node_modules');
      if (existsSync(cacheModulesPath)) {
        await this.appendLog(
          deploymentId,
          logSeq++,
          `[install] cache_hit lockfile=${fp.slice(0, 12)}… 复制 node_modules`,
        );
        const destNm = path.join(tmpDir, 'node_modules');
        if (existsSync(destNm)) rmSync(destNm, { recursive: true, force: true });
        cpSync(cacheModulesPath, destNm, { recursive: true });
      } else {
        await this.appendLog(deploymentId, logSeq++, `[install] cache_miss (${pm}) lockfile=${fp.slice(0, 12)}…`);
      }

      // install
      const installCmd = pipelineConfig.installCommand ?? `${pm} install`;
      const [installBin, ...installArgs] = installCmd.split(' ');
      await this.appendLog(deploymentId, logSeq++, '[install] 开始安装依赖…');
      await runCmd(installBin!, installArgs, tmpDir, 'install');

      try {
        const parent = path.dirname(cacheModulesPath);
        mkdirSync(parent, { recursive: true });
        const srcNm = path.join(tmpDir, 'node_modules');
        if (existsSync(srcNm)) {
          rmSync(cacheModulesPath, { recursive: true, force: true });
          cpSync(srcNm, cacheModulesPath, { recursive: true });
        }
      } catch (e) {
        this.logger.warn(`写入依赖缓存失败 org=${orgId} fp=${fp.slice(0, 8)}: ${e}`);
      }
      try {
        const root = this.buildDepsCacheRoot();
        await runDepsCacheEvictionPipeline(root, orgId, resolveCacheMaxBytes(), this.logger);
      } catch (e) {
        this.logger.warn(`依赖缓存淘汰异常: ${e}`);
      }

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

      let imageRef: string | null = null;
      let imageDigest: string | null = null;
      if (pipelineConfig.containerImageEnabled) {
        const pushed = await this.pushBuiltImageToRegistry({
          deploymentId,
          tmpDir: tmpAbs,
          pipelineConfig,
          nextLog: () => logSeq++,
        });
        imageRef = pushed.imageRef;
        imageDigest = pushed.imageDigest;
        await this.appendLog(deploymentId, logSeq++, `[container] 已推送 ${imageRef}`);
      }

      // 获取文件大小
      const { statSync } = await import('fs');
      const stat = statSync(artifactPath);

      // 写入 BuildArtifact 记录
      const artifact = await this.prisma.buildArtifact.create({
        data: {
          deploymentId,
          storagePath: artifactPath,
          sizeBytes: BigInt(stat.size),
          imageRef: imageRef ?? undefined,
          imageDigest: imageDigest ?? undefined,
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

      void this.artifactRetention.enforceForOrganization(orgId).catch((e) => {
        this.logger.warn(`产物保留策略执行失败 org=${orgId}: ${e}`);
      });

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

  /** Docker 输出写入 Worker 进程 stdout/stderr（避免海量 seq 占满 deploymentLog） */
  private runDockerInherit(args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { cwd, stdio: 'inherit' });
      child.on('close', (code: number | null) => {
        if (code === 0) resolve();
        else reject(new Error(`docker ${args.join(' ')} 退出码 ${code}`));
      });
      child.on('error', reject);
    });
  }

  private runDockerCapture(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const child = spawn('docker', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout?.on('data', (c: Buffer) => chunks.push(c));
      child.stderr?.on('data', (c: Buffer) => chunks.push(c));
      child.on('close', (code: number | null) => {
        if (code === 0) resolve(Buffer.concat(chunks).toString('utf8').trim());
        else reject(new Error(`docker ${args.join(' ')} 失败`));
      });
      child.on('error', reject);
    });
  }

  /** 仓库根目录须有 Dockerfile；镜像名不含 tag */
  private async pushBuiltImageToRegistry(opts: {
    deploymentId: string;
    tmpDir: string;
    pipelineConfig: {
      containerImageName: string | null;
      containerRegistryAuthEncrypted: string | null;
    };
    nextLog: () => number;
  }): Promise<{ imageRef: string; imageDigest: string }> {
    const { deploymentId, tmpDir, pipelineConfig } = opts;
    const dockerOk = await probeDockerAvailable();
    if (!dockerOk) {
      throw new Error('[container] 需要可用 Docker（docker info）以构建/推送镜像');
    }
    const base = pipelineConfig.containerImageName?.trim();
    if (!base) {
      throw new Error('[container] 已启用镜像推送但缺少 containerImageName');
    }
    const tag = `shipyard-${deploymentId.slice(0, 12)}`;
    const localImage = `${base}:${tag}`;
    await this.appendLog(deploymentId, opts.nextLog(), `[container] docker build -t ${localImage} .`);
    await this.runDockerInherit(['build', '-t', localImage, '.'], tmpDir);

    const enc = pipelineConfig.containerRegistryAuthEncrypted;
    if (enc) {
      const auth = JSON.parse(this.crypto.decrypt(enc)) as { username?: string; password?: string };
      const reg = base.includes('/') ? base.split('/')[0]! : 'docker.io';
      await this.appendLog(deploymentId, opts.nextLog(), `[container] docker login ${reg}`);
      await new Promise<void>((resolve, reject) => {
        const child = spawn('docker', ['login', reg, '-u', auth.username ?? '', '--password-stdin'], {
          cwd: tmpDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        child.stdin?.write(auth.password ?? '');
        child.stdin?.end();
        let err = '';
        child.stderr?.on('data', (d: Buffer) => {
          err += d.toString();
        });
        child.on('close', (code: number | null) => {
          if (code === 0) resolve();
          else reject(new Error(err.trim() || `docker login 退出码 ${code}`));
        });
        child.on('error', reject);
      });
    }

    await this.appendLog(deploymentId, opts.nextLog(), `[container] docker push ${localImage}`);
    await this.runDockerInherit(['push', localImage], tmpDir);

    const ref = await this.runDockerCapture(['inspect', '--format={{index .RepoDigests 0}}', localImage], tmpDir);
    if (!ref.includes('@')) {
      throw new Error('[container] docker inspect 未返回 RepoDigest');
    }
    const imageDigest = ref.split('@')[1] ?? ref;
    return { imageRef: ref, imageDigest };
  }

  private buildDepsCacheRoot(): string {
    const raw = process.env['SHIPYARD_BUILD_DEPS_CACHE_PATH']?.trim();
    return raw && raw.length > 0 ? raw : path.join(os.tmpdir(), 'shipyard-build-deps-cache');
  }

  private nodeMajorFromProcess(): string {
    const m = /^v(\d+)/.exec(process.version);
    return m ? m[1]! : process.version;
  }

  private async lockfileFingerprint(tmpDir: string, pm: string): Promise<string> {
    const lockFile =
      pm === 'pnpm' ? 'pnpm-lock.yaml' : pm === 'yarn' ? 'yarn.lock' : 'package-lock.json';
    let lockPart: Buffer | string;
    try {
      lockPart = await readFile(path.join(tmpDir, lockFile));
    } catch {
      lockPart = `no-lock:${pm}`;
    }
    let meta = `node:${this.nodeMajorFromProcess()}`;
    try {
      const nvm = (await readFile(path.join(tmpDir, '.nvmrc'), 'utf8')).trim();
      if (nvm) meta += `|nvmrc:${createHash('sha256').update(nvm).digest('hex').slice(0, 12)}`;
    } catch {
      /* 无 .nvmrc */
    }
    return createHash('sha256').update(lockPart).update('\n').update(meta).digest('hex').slice(0, 48);
  }

  private async detectPackageManager(dir: string): Promise<string> {
    const files = await readdir(dir);
    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('yarn.lock')) return 'yarn';
    return 'npm';
  }

  private async appendLog(deploymentId: string, seq: number, content: string) {
    try {
      await this.prisma.deploymentLog.create({ data: { deploymentId, seq, content } });
    } catch (e) {
      this.logger.warn(`写入 deploymentLog 失败 deploymentId=${deploymentId}: ${e}`);
    }
    try {
      await this.redis.publishLog(deploymentId, { deploymentId, line: content, seq });
    } catch (e) {
      this.logger.warn(`发布构建日志到 Redis 失败 deploymentId=${deploymentId}: ${e}`);
    }
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
