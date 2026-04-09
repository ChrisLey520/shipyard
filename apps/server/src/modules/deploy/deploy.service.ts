import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { Client as SshClient } from 'ssh2';
import * as path from 'path';
import { mkdirSync, rmSync } from 'fs';
import * as tar from 'tar';

export interface DeployJobData {
  deploymentId: string;
  projectId: string;
  environmentId: string;
  orgId: string;
}

@Injectable()
export class DeployService {
  private readonly logger = new Logger(DeployService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
  ) {}

  async deploy(data: DeployJobData) {
    const { deploymentId, projectId, environmentId } = data;

    try {
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'deploying' },
      });

      const [deployment, env, project, pipelineConfig] = await Promise.all([
        this.prisma.deployment.findUniqueOrThrow({
          where: { id: deploymentId },
          include: { artifact: true },
        }),
        this.prisma.environment.findUniqueOrThrow({
          where: { id: environmentId },
          include: { server: true },
        }),
        this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
        this.prisma.pipelineConfig.findUniqueOrThrow({ where: { projectId } }),
      ]);

      if (!deployment.artifact) throw new Error('构建产物不存在');

      const server = env.server;
      const privateKey = this.crypto.decrypt(server.privateKey);

      // 获取部署时的环境变量
      const envVars = await this.getDecryptedEnvVars(environmentId);

      // 解压产物到临时目录
      const tmpExtractDir = path.join('/tmp', `deploy-${deploymentId}`);
      mkdirSync(tmpExtractDir, { recursive: true });
      await tar.extract({ file: deployment.artifact.storagePath, cwd: tmpExtractDir });

      // 获取部署锁
      const lockKey = `deploy-lock:${environmentId}`;
      const locked = await this.redis.acquireLock(lockKey, 600);
      if (!locked) throw new Error('该环境正在部署中，请稍后重试');

      try {
        await this.sshDeploy({
          host: server.host,
          port: server.port,
          username: server.user,
          privateKey,
          deployPath: env.deployPath,
          localDir: tmpExtractDir,
          frameworkType: project.frameworkType,
          projectSlug: project.slug,
          domain: env.domain ?? null,
          ssrEntryPoint: pipelineConfig.ssrEntryPoint ?? 'dist/index.js',
          envVars,
        });
      } finally {
        await this.redis.releaseLock(lockKey);
        rmSync(tmpExtractDir, { recursive: true, force: true });
      }

      // 健康检查
      if (env.healthCheckUrl) {
        const healthy = await this.healthCheck(env.healthCheckUrl);
        if (!healthy) {
          await this.triggerAutoRollback(data);
          return;
        }
      }

      const now = new Date();
      const startedAt = deployment.startedAt?.getTime() ?? now.getTime();
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'success',
          completedAt: now,
          durationMs: now.getTime() - startedAt,
        },
      });
    } catch (err) {
      this.logger.error(`Deploy failed for ${deploymentId}: ${err}`);
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed', completedAt: new Date() },
      });
    }
  }

  private async sshDeploy(opts: {
    host: string;
    port: number;
    username: string;
    privateKey: string;
    deployPath: string;
    localDir: string;
    frameworkType: string;
    projectSlug: string;
    domain: string | null;
    ssrEntryPoint: string;
    envVars: Record<string, string>;
  }) {
    const { host, port, username, privateKey } = opts;

    // rsync 上传
    await this.execLocal('rsync', [
      '-avz', '--delete',
      `${opts.localDir}/`,
      `${username}@${host}:${opts.deployPath}/`,
      '-e', `ssh -p ${port} -i /tmp/key-${host} -o StrictHostKeyChecking=no`,
    ]);

    const conn = await this.createSshClient({ host, port, username, privateKey });

    try {
      if (opts.frameworkType === 'ssr') {
        // 生成 ecosystem.config.js
        const envStr = Object.entries(opts.envVars)
          .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`)
          .join(',\n');
        const ecosystemJs = `module.exports = {
  apps: [{
    name: ${JSON.stringify(opts.projectSlug)},
    script: ${JSON.stringify(opts.ssrEntryPoint)},
    cwd: ${JSON.stringify(opts.deployPath)},
    env: {\n${envStr}\n    }
  }]
};`;
        await this.sshExec(conn, `cat > ${opts.deployPath}/ecosystem.config.js << 'EOFCONFIG'\n${ecosystemJs}\nEOFCONFIG`);

        // 切换 Node 版本并管理 PM2 进程
        const pm2Check = `pm2 describe ${opts.projectSlug} > /dev/null 2>&1`;
        await this.sshExec(
          conn,
          `${pm2Check} && pm2 reload ${opts.deployPath}/ecosystem.config.js --update-env || pm2 start ${opts.deployPath}/ecosystem.config.js`,
        );
      }

      // 生成/更新 Nginx 配置
      if (opts.domain) {
        const nginxConf = opts.frameworkType === 'ssr'
          ? this.generateSsrNginxConf(opts.domain, 'localhost', 3000)
          : this.generateStaticNginxConf(opts.domain, opts.deployPath);

        await this.sshExec(
          conn,
          `cat > /etc/nginx/sites-available/${opts.projectSlug}.conf << 'EOFNGINX'\n${nginxConf}\nEOFNGINX\n` +
          `ln -sf /etc/nginx/sites-available/${opts.projectSlug}.conf /etc/nginx/sites-enabled/ && nginx -s reload`,
        );
      }
    } finally {
      conn.end();
    }
  }

  private generateStaticNginxConf(domain: string, deployPath: string): string {
    return `server {
    listen 80;
    server_name ${domain};
    root ${deployPath};
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}`;
  }

  private generateSsrNginxConf(domain: string, upstreamHost: string, port: number): string {
    return `server {
    listen 80;
    server_name ${domain};
    location / {
        proxy_pass http://${upstreamHost}:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;
  }

  private createSshClient(opts: { host: string; port: number; username: string; privateKey: string }): Promise<SshClient> {
    return new Promise((resolve, reject) => {
      const conn = new SshClient();
      conn.on('ready', () => resolve(conn))
        .on('error', reject)
        .connect({ host: opts.host, port: opts.port, username: opts.username, privateKey: opts.privateKey });
    });
  }

  private sshExec(conn: SshClient, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) return reject(err);
        let output = '';
        stream.on('data', (d: Buffer) => { output += d.toString(); });
        stream.stderr?.on('data', (d: Buffer) => { output += d.toString(); });
        stream.on('close', (code: number) => {
          if (code === 0) resolve(output);
          else reject(new Error(`SSH 命令失败 (exit ${code}): ${output}`));
        });
      });
    });
  }

  private execLocal(cmd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process') as typeof import('child_process');
      const child = spawn(cmd, args);
      child.on('close', (code: number | null) => {
        if (code === 0) resolve();
        else reject(new Error(`${cmd} exited with code ${code}`));
      });
    });
  }

  private async healthCheck(url: string, retries = 3): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        const { default: https } = await import('https');
        const { default: http } = await import('http');
        const client = url.startsWith('https') ? https : http;
        await new Promise<void>((resolve, reject) => {
          const req = client.get(url, (res) => {
            if (res.statusCode && res.statusCode < 400) resolve();
            else reject(new Error(`HTTP ${res.statusCode}`));
          });
          req.on('error', reject);
          req.setTimeout(10_000, () => reject(new Error('timeout')));
        });
        return true;
      } catch {
        if (i < retries - 1) await new Promise((r) => setTimeout(r, 10_000));
      }
    }
    return false;
  }

  private async triggerAutoRollback(data: DeployJobData) {
    const { deploymentId, projectId, environmentId, orgId } = data;
    this.logger.warn(`Health check failed for ${deploymentId}, triggering auto-rollback`);

    // 找到上一个成功的部署（非当前）
    const lastSuccess = await this.prisma.deployment.findFirst({
      where: {
        environmentId,
        projectId,
        status: 'success',
        id: { not: deploymentId },
      },
      orderBy: { createdAt: 'desc' },
      include: { artifact: true },
    });

    if (!lastSuccess?.artifact) {
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed', completedAt: new Date() },
      });
      this.logger.error(`Auto-rollback failed: no valid artifact found for env ${environmentId}`);
      return;
    }

    // 创建 rollback Deployment（isAutoRollback=true 标记，不再级联触发健康检查回滚）
    const rollbackDeployment = await this.prisma.deployment.create({
      data: {
        projectId,
        environmentId,
        status: 'queued',
        trigger: 'rollback',
        artifactId: lastSuccess.artifactId,
        configSnapshot: (lastSuccess.configSnapshot ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    // 直接入 DeployQueue（跳过 BuildQueue）
    const { Queue: BullQueue } = await import('bullmq');
    const deployQueue = new BullQueue(`deploy:${orgId}`, { connection: this.redis.getClient() });
    await deployQueue.add(
      'deploy',
      {
        deploymentId: rollbackDeployment.id,
        projectId,
        environmentId,
        orgId,
        skipHealthCheck: true, // 防止级联
      },
      { jobId: `deploy-${rollbackDeployment.id}` },
    );

    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'failed', completedAt: new Date() },
    });
  }

  private async getDecryptedEnvVars(environmentId: string): Promise<Record<string, string>> {
    const vars = await this.prisma.envVariable.findMany({ where: { environmentId } });
    const result: Record<string, string> = {};
    for (const v of vars) {
      result[v.key] = this.crypto.decrypt(v.value);
    }
    return result;
  }
}
