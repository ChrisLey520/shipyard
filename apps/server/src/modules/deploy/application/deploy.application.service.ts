import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ServerOs,
  resolveDeployAccessHost,
  buildNginxServerNameList,
  isLoopbackHostLabel,
  buildPm2StaticSiteRootUrl,
  normalizeHttpRootUrlWithSlash,
} from '@shipyard/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { GitCommitStatusService } from '../../git/git-commit-status.service';
import { Client as SshClient } from 'ssh2';
import * as path from 'path';
import { spawn } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import * as tar from 'tar';

export interface DeployJobData {
  deploymentId: string;
  projectId: string;
  environmentId: string;
  orgId: string;
  /** 自动回滚部署时跳过健康检查，避免级联失败 */
  skipHealthCheck?: boolean;
}

@Injectable()
export class DeployApplicationService {
  private readonly logger = new Logger(DeployApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
    private readonly commitStatus: GitCommitStatusService,
  ) {}

  /** 成功收尾时在日志中提示如何访问（与前端详情卡片字段对齐） */
  private buildDeployAccessLogLines(opts: {
    domain: string | null;
    healthCheckUrl: string | null;
    deployPath: string;
    serverHost: string;
    frameworkType: string;
    staticFallback?: { port: number; host: string };
  }): string[] {
    const lines: string[] = [];
    const rawDomain = opts.domain?.trim();
    const accessHost = rawDomain ? resolveDeployAccessHost(rawDomain, opts.serverHost) : '';
    if (rawDomain && accessHost && accessHost !== rawDomain) {
      lines.push(
        `[deploy] 环境域名为「${rawDomain}」且部署目标非本机，已改用部署主机「${accessHost}」作为 Nginx server_name 与下方访问地址。`,
      );
    }
    if (accessHost) {
      lines.push(`[deploy] 访问地址: ${normalizeHttpRootUrlWithSlash(accessHost)}`);
    }
    if (opts.staticFallback) {
      const pm2Url = buildPm2StaticSiteRootUrl(opts.staticFallback.host, opts.staticFallback.port);
      if (pm2Url) {
        lines.push(`[deploy] macOS 无 Nginx（或未配置域名）时已由 PM2+Node 提供静态站点: ${pm2Url}`);
      }
    }
    if (rawDomain && isLoopbackHostLabel(rawDomain)) {
      if (opts.staticFallback) {
        lines.push(
          `[deploy] 本机：请用 http://127.0.0.1:${opts.staticFallback.port}/ 或 http://localhost:${opts.staticFallback.port}/（PM2 监听该端口，非 Vite 端口）。`,
        );
      } else {
        lines.push(
          '[deploy] 本机调试：站点在 80 端口（与前端 Vite 等开发端口不同）。请用 http://localhost/ 或 http://127.0.0.1/；需本机已安装 Nginx、主配置包含站点目录且 80 未被占用。若未装 Nginx，部署仍会成功但仅同步文件到目录。',
        );
      }
    }
    const hc = opts.healthCheckUrl?.trim();
    if (hc) {
      lines.push(`[deploy] 健康检查 URL: ${hc}`);
    }
    if (!accessHost && !hc) {
      lines.push(
        `[deploy] 未配置环境域名与健康检查 URL。产物目录: ${opts.deployPath}（服务器 ${opts.serverHost}）`,
      );
      if (opts.frameworkType === 'ssr') {
        lines.push('[deploy] SSR 通常由 Nginx 反代至 Node；请在环境中配置域名或在服务器上自行访问。');
      }
    }
    return lines;
  }

  private computeFinalAccessUrl(opts: {
    domain: string | null;
    serverHost: string;
    staticFallback?: { port: number; host: string };
  }): string | null {
    if (opts.staticFallback) {
      const host = resolveDeployAccessHost(opts.domain, opts.staticFallback.host) || opts.staticFallback.host;
      return buildPm2StaticSiteRootUrl(host, opts.staticFallback.port) || null;
    }
    const rawDomain = opts.domain?.trim();
    const accessHost = rawDomain ? resolveDeployAccessHost(rawDomain, opts.serverHost) : '';
    if (!accessHost) return null;
    return normalizeHttpRootUrlWithSlash(accessHost) || null;
  }

  /** 与构建日志同一套存储与 Pub/Sub，便于详情页连续展示 */
  private async appendLogLine(deploymentId: string, content: string): Promise<void> {
    const agg = await this.prisma.deploymentLog.aggregate({
      where: { deploymentId },
      _max: { seq: true },
    });
    const seq = (agg._max.seq ?? -1) + 1;
    await Promise.all([
      this.prisma.deploymentLog.create({ data: { deploymentId, seq, content } }),
      this.redis.publishLog(deploymentId, { deploymentId, line: content, seq }),
    ]);
  }

  async deploy(data: DeployJobData) {
    const { deploymentId, projectId, environmentId } = data;
    const skipHealthCheck = data.skipHealthCheck === true;
    let macStaticPort: number | undefined;

    try {
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'deploying' },
      });
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'deploy',
        'pending',
        'Shipyard deployment in progress',
      );
      await this.appendLogLine(deploymentId, '[deploy] 开始部署（上传产物并执行远端命令）…');

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

      await this.appendLogLine(
        deploymentId,
        `[deploy] 目标服务器 ${env.server.host}:${env.server.port}，路径 ${env.deployPath}`,
      );

      const server = env.server;
      const privateKey = this.crypto.decrypt(server.privateKey);

      // 获取部署时的环境变量
      const envVars = await this.getDecryptedEnvVars(environmentId);

      // 解压产物到临时目录
      const tmpExtractDir = path.join('/tmp', `deploy-${deploymentId}`);
      mkdirSync(tmpExtractDir, { recursive: true });
      await this.appendLogLine(deploymentId, '[deploy] 开始解压产物包…');
      await tar.extract({ file: deployment.artifact.storagePath, cwd: tmpExtractDir });
      await this.appendLogLine(deploymentId, '[deploy] 产物包已解压到本地临时目录');

      // 获取部署锁
      const lockKey = `deploy-lock:${environmentId}`;
      await this.appendLogLine(deploymentId, '[deploy] 获取部署锁…');
      const locked = await this.redis.acquireLock(lockKey, 600);
      if (!locked) throw new Error('该环境正在部署中，请稍后重试');

      // rsync 走系统 ssh，必须把私钥落到可读文件（此前用 /tmp/key-${host} 但未写入，会导致 exit 255）
      const sshKeyPath = path.join('/tmp', `shipyard-deploy-${deploymentId}.pem`);

      try {
        await writeFile(sshKeyPath, privateKey, { encoding: 'utf8', mode: 0o600 });
        await this.appendLogLine(
          deploymentId,
          `[deploy] rsync → ${server.user}@${server.host}:${env.deployPath}`,
        );
        await this.appendLogLine(deploymentId, '[deploy] 开始同步文件（rsync）…');
        const sshResult = await this.sshDeploy({
          deploymentId,
          host: server.host,
          port: server.port,
          username: server.user,
          privateKey,
          sshKeyPath,
          serverOs: server.os,
          deployPath: env.deployPath,
          localDir: tmpExtractDir,
          frameworkType: project.frameworkType,
          projectSlug: project.slug,
          domain: env.domain ?? null,
          ssrEntryPoint: pipelineConfig.ssrEntryPoint ?? 'dist/index.js',
          envVars,
        });
        macStaticPort = sshResult.macStaticPort;
        await this.appendLogLine(deploymentId, '[deploy] 远端 rsync / PM2 / Nginx 步骤已完成');
      } finally {
        await unlink(sshKeyPath).catch(() => undefined);
        await this.redis.releaseLock(lockKey);
        rmSync(tmpExtractDir, { recursive: true, force: true });
      }

      // 健康检查
      if (!skipHealthCheck && env.healthCheckUrl) {
        await this.appendLogLine(deploymentId, `[deploy] 健康检查 ${env.healthCheckUrl}`);
        const healthy = await this.healthCheck(env.healthCheckUrl);
        if (!healthy) {
          await this.appendLogLine(deploymentId, '[deploy] 健康检查未通过');
          await this.triggerAutoRollback(data);
          return;
        }
        await this.appendLogLine(deploymentId, '[deploy] 健康检查通过');
      } else if (skipHealthCheck) {
        await this.appendLogLine(deploymentId, '[deploy] 已跳过健康检查（回滚流程）');
      }

      const now = new Date();
      const startedAt = deployment.startedAt?.getTime() ?? now.getTime();
      const prevSnap = deployment.configSnapshot;
      const snapBase =
        typeof prevSnap === 'object' && prevSnap !== null && !Array.isArray(prevSnap)
          ? { ...(prevSnap as Record<string, unknown>) }
          : {};
      if (macStaticPort != null) {
        snapBase.shipyardAccess = { staticPort: macStaticPort, staticHost: env.server.host };
      }
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'success',
          completedAt: now,
          durationMs: now.getTime() - startedAt,
          configSnapshot: snapBase as Prisma.InputJsonValue,
        },
      });
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'deploy',
        'success',
        'Shipyard deployment succeeded',
      );

      // 将“最终可访问地址”落库到环境上，避免删除部署历史后访问地址消失
      const finalAccessUrl = this.computeFinalAccessUrl({
        domain: env.domain ?? null,
        serverHost: env.server.host,
        staticFallback:
          macStaticPort != null
            ? { port: macStaticPort, host: env.server.host }
            : undefined,
      });
      await this.prisma.environment.update({
        where: { id: environmentId },
        data: { accessUrl: finalAccessUrl },
      });

      for (const line of this.buildDeployAccessLogLines({
        domain: env.domain ?? null,
        healthCheckUrl: env.healthCheckUrl ?? null,
        deployPath: env.deployPath,
        serverHost: env.server.host,
        frameworkType: project.frameworkType,
        staticFallback:
          macStaticPort != null
            ? { port: macStaticPort, host: env.server.host }
            : undefined,
      })) {
        await this.appendLogLine(deploymentId, line);
      }
      await this.appendLogLine(deploymentId, '[deploy] 部署成功 ✓');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Deploy failed for ${deploymentId}: ${err}`);
      try {
        await this.appendLogLine(deploymentId, `[deploy] [error] ${message}`);
      } catch (logErr) {
        this.logger.error(`Failed to append deploy log: ${logErr}`);
      }
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed', completedAt: new Date() },
      });
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'deploy',
        'failure',
        'Shipyard deployment failed',
      );
    }
  }

  private async appendRemoteStdoutToDeployLog(deploymentId: string, out: string): Promise<void> {
    const t = out.trim();
    if (!t) return;
    for (const line of t.split('\n')) {
      const s = line.trim();
      if (s) await this.appendLogLine(deploymentId, `[deploy] ${s}`);
    }
  }

  private async sshDeploy(opts: {
    deploymentId: string;
    host: string;
    port: number;
    username: string;
    privateKey: string;
    sshKeyPath: string;
    serverOs: string;
    deployPath: string;
    localDir: string;
    frameworkType: string;
    projectSlug: string;
    domain: string | null;
    ssrEntryPoint: string;
    envVars: Record<string, string>;
  }): Promise<{ macStaticPort?: number }> {
    const { host, port, username, privateKey, sshKeyPath } = opts;

    // rsync 上传（ssh 使用与上面 writeFile 一致的密钥文件）
    await this.appendLogLine(opts.deploymentId, '[deploy] 远端阶段：开始 rsync 上传…');
    await this.execLocal('rsync', [
      '-avz', '--delete',
      `${opts.localDir}/`,
      `${username}@${host}:${opts.deployPath}/`,
      '-e',
      `ssh -p ${port} -i ${sshKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`,
    ]);

    const conn = await this.createSshClient({ host, port, username, privateKey });
    let macNginxOut = '';

    try {
      if (opts.frameworkType === 'ssr') {
        await this.appendLogLine(opts.deploymentId, '[deploy] SSR：开始生成 PM2 配置并启动/重载服务…');
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

      // 生成/更新 Nginx 配置（Linux 用 sites-available；macOS Homebrew 用 etc/nginx/servers/）
      if (opts.domain) {
        await this.appendLogLine(opts.deploymentId, '[deploy] 开始生成/更新 Nginx 配置…');
        const serverNames = buildNginxServerNameList(opts.domain.trim(), opts.host);
        const nginxConf = opts.frameworkType === 'ssr'
          ? this.generateSsrNginxConf(serverNames, 'localhost', 3000)
          : this.generateStaticNginxConf(serverNames, opts.deployPath);

        if (opts.serverOs === ServerOs.MACOS) {
          macNginxOut = await this.sshExec(conn, this.buildMacosNginxInstallScript(opts.projectSlug, nginxConf));
          const filtered = macNginxOut
            .split('\n')
            .filter((l) => !l.trim().startsWith('SHIPYARD_NGINX_SKIPPED='))
            .join('\n');
          await this.appendRemoteStdoutToDeployLog(opts.deploymentId, filtered);
        } else if (opts.serverOs === ServerOs.WINDOWS) {
          throw new Error(
            '当前不支持在 Windows 目标上自动写入 Nginx；请去掉环境域名或改用手动配置 Web 服务器',
          );
        } else {
          const slug = opts.projectSlug;
          await this.sshExec(
            conn,
            `mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled && ` +
              `cat > /etc/nginx/sites-available/${slug}.conf <<'EOFNGINX'\n${nginxConf}\nEOFNGINX\n` +
              `ln -sf /etc/nginx/sites-available/${slug}.conf /etc/nginx/sites-enabled/${slug}.conf && nginx -s reload`,
          );
        }
      }

      // macOS + 静态站点：无 Nginx 或未配置域名时，用 Node 脚本 + PM2 在固定端口提供站点
      let macStaticPort: number | undefined;
      if (opts.serverOs === ServerOs.MACOS && opts.frameworkType === 'static') {
        const nginxSkipped = !opts.domain?.trim() || macNginxOut.includes('SHIPYARD_NGINX_SKIPPED=1');
        if (nginxSkipped) {
            await this.appendLogLine(opts.deploymentId, '[deploy] macOS：Nginx 不可用，准备使用 PM2 + Node 启动静态站点…');
          macStaticPort = this.computeStaticFallbackPort(opts.projectSlug);
          const bash = this.buildMacPm2StaticBashScript(
            opts.deployPath,
            opts.projectSlug,
            macStaticPort,
            this.getShipyardStaticServerCjsSource(),
          );
          // 直接执行多行 bash 脚本（不要再包装成字符串，否则 \n 会变成字面量导致 bash 解析 JS 失败）
          await this.sshExec(conn, bash);
          const pm2Name = this.pm2StaticAppName(opts.projectSlug);
          await this.appendLogLine(
            opts.deploymentId,
            `[deploy] 已用 PM2 启动静态站点进程「${pm2Name}」，端口 ${macStaticPort}（需本机已安装 pm2 与 node）`,
          );
        }
      }
      return { macStaticPort };
    } finally {
      conn.end();
    }
  }

  /** 与 SSR 的 PM2 应用名区分，避免冲突 */
  private pm2StaticAppName(projectSlug: string): string {
    return `sh-static-${this.sanitizePm2Segment(projectSlug)}`;
  }

  private sanitizePm2Segment(slug: string): string {
    let s = slug.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
    if (s.length > 48) s = s.slice(0, 48);
    return s || 'app';
  }

  /** 按项目 slug 稳定映射端口，减少多项目冲突 */
  private computeStaticFallbackPort(projectSlug: string): number {
    let h = 0;
    for (let i = 0; i < projectSlug.length; i++) {
      h = (h * 31 + projectSlug.charCodeAt(i)) >>> 0;
    }
    return 41000 + (h % 900);
  }

  /** 写入部署目录的极简静态服务（SPA 回退 index.html） */
  private getShipyardStaticServerCjsSource(): string {
    return `'use strict';
const http = require('http');
const fsp = require('fs/promises');
const path = require('path');
const PORT = parseInt(process.env.PORT || '4173', 10);
const ROOT = path.resolve(__dirname);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};
function safeFilePath(urlPath) {
  const p = decodeURIComponent(urlPath.split('?')[0] || '/');
  const rel = p === '/' || p === '' ? 'index.html' : p.replace(/^\\/+/,'');
  if (!rel || rel.includes('..')) return null;
  const resolved = path.normalize(path.join(ROOT, rel));
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (resolved !== ROOT && !resolved.startsWith(rootWithSep)) return null;
  return resolved;
}
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  try {
    const fp = safeFilePath(req.url || '/');
    const sendFile = async (abs) => {
      const st = await fsp.stat(abs).catch(() => null);
      if (!st || !st.isFile()) return false;
      const ext = path.extname(abs).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';
      const buf = await fsp.readFile(abs);
      res.statusCode = 200;
      res.setHeader('Content-Type', type);
      if (req.method === 'HEAD') res.end();
      else res.end(buf);
      return true;
    };
    if (fp && (await sendFile(fp))) return;
    if (fp) {
      const st = await fsp.stat(fp).catch(() => null);
      if (st && st.isDirectory() && (await sendFile(path.join(fp, 'index.html')))) return;
    }
    const idx = path.join(ROOT, 'index.html');
    const ist = await fsp.stat(idx).catch(() => null);
    if (ist && ist.isFile()) {
      const buf = await fsp.readFile(idx);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.method === 'HEAD') res.end();
      else res.end(buf);
      return;
    }
    res.statusCode = 404;
    res.end('Not Found');
  } catch {
    res.statusCode = 500;
    res.end('Server Error');
  }
});
server.listen(PORT, '0.0.0.0', () => {
  console.error('[shipyard-static] listening on ' + PORT + ' root=' + ROOT);
});
`;
  }

  private buildMacPm2StaticBashScript(
    deployPath: string,
    projectSlug: string,
    port: number,
    serverSource: string,
  ): string {
    const tag = `SHIPYARD_SRV_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    if (serverSource.includes(tag)) {
      throw new Error('静态服务脚本与 heredoc 分隔符冲突');
    }
    const dp = JSON.stringify(deployPath);
    const name = JSON.stringify(this.pm2StaticAppName(projectSlug));
    return [
      'set -e',
      // 非交互 SSH 会缺少用户 PATH（例如 pnpm 全局 bin: ~/Library/pnpm，node: /opt/homebrew/bin 或 /usr/local/bin）
      'export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/Library/pnpm:$PATH"',
      `cd ${dp}`,
      `export PORT=${port}`,
      `cat > .shipyard-static-server.cjs <<'${tag}'`,
      serverSource,
      tag,
      'command -v node >/dev/null 2>&1 || { echo "未找到 node：macOS 无 Nginx 回退需要 Node 运行静态服务。请先安装 Node（或确保 SSH 环境 PATH 包含 node 路径，如 /opt/homebrew/bin 或 /usr/local/bin）。" >&2; exit 1; }',
      // 自动安装 pm2（优先 pnpm，其次 npm），避免本机未配置 PATH 导致误判“未安装”
      'if ! command -v pm2 >/dev/null 2>&1; then ' +
        'echo "未检测到 pm2，尝试自动安装…" >&2; ' +
        'if command -v pnpm >/dev/null 2>&1; then pnpm add -g pm2; ' +
        'elif command -v npm >/dev/null 2>&1; then npm i -g pm2; ' +
        'else echo "未找到 pnpm/npm，无法安装 pm2" >&2; exit 1; fi; ' +
        'export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/Library/pnpm:$PATH"; ' +
        'fi',
      'command -v pm2 >/dev/null 2>&1 || { echo "pm2 安装后仍不可用（PATH 可能未生效）" >&2; exit 1; }',
      `pm2 describe ${name} >/dev/null 2>&1 && pm2 delete ${name} || true`,
      `pm2 start .shipyard-static-server.cjs --name ${name} --cwd ${dp} --update-env`,
    ].join('\n');
  }

  /** macOS Homebrew nginx：配置放在 etc/nginx/servers/，无 sites-available */
  private buildMacosNginxInstallScript(projectSlug: string, nginxConf: string): string {
    const tag = `SHIPYARD_NGX_${Date.now().toString(36)}`;
    if (nginxConf.includes(tag)) {
      throw new Error('Nginx 配置内容与内部分隔符冲突，请修改仓库或域名相关配置后重试');
    }
    return [
      `NGD=""`,
      `if [ -f /opt/homebrew/etc/nginx/nginx.conf ]; then NGD=/opt/homebrew/etc/nginx/servers`,
      `elif [ -f /usr/local/etc/nginx/nginx.conf ]; then NGD=/usr/local/etc/nginx/servers`,
      `fi`,
      `if [ -z "$NGD" ]; then echo "未检测到 Homebrew Nginx（无 etc/nginx/nginx.conf），已跳过自动站点配置；静态文件已在部署目录。需要域名反代请: brew install nginx 并在 http 块加入 include servers/*; 或清空环境「域名」。"; echo SHIPYARD_NGINX_SKIPPED=1; exit 0; fi`,
      `mkdir -p "$NGD"`,
      `cat > "$NGD/${projectSlug}.conf" <<'${tag}'`,
      nginxConf,
      tag,
      `if command -v nginx >/dev/null 2>&1; then nginx -s reload`,
      `elif [ -x /opt/homebrew/bin/nginx ]; then /opt/homebrew/bin/nginx -s reload`,
      `elif [ -x /usr/local/bin/nginx ]; then /usr/local/bin/nginx -s reload`,
      `else echo "Shipyard: 已写入配置，请手动执行 nginx -s reload" >&2; fi`,
      `echo SHIPYARD_NGINX_SKIPPED=0`,
    ].join('\n');
  }

  /** @param serverNames 已拼接好的 server_name 列表（可含多个主机名，空格分隔） */
  private generateStaticNginxConf(serverNames: string, deployPath: string): string {
    return `server {
    listen 80;
    server_name ${serverNames};
    root ${deployPath};
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}`;
  }

  private generateSsrNginxConf(serverNames: string, upstreamHost: string, port: number): string {
    return `server {
    listen 80;
    server_name ${serverNames};
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
      let combined = '';
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout?.on('data', (c: Buffer) => {
        combined += c.toString();
      });
      child.stderr?.on('data', (c: Buffer) => {
        combined += c.toString();
      });
      child.on('close', (code: number | null) => {
        if (code === 0) resolve();
        else {
          const tail = combined.trim().slice(-2000);
          reject(
            new Error(
              tail ? `${cmd} exited with code ${code}: ${tail}` : `${cmd} exited with code ${code}`,
            ),
          );
        }
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
      await this.appendLogLine(
        deploymentId,
        '[deploy] [error] 健康检查失败且无可用历史产物，无法自动回滚',
      ).catch(() => undefined);
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed', completedAt: new Date() },
      });
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'deploy',
        'failure',
        'Health check failed; no rollback artifact',
      );
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
    const deployQueue = new BullQueue(`deploy-${orgId}`, { connection: this.redis.getClient() });
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

    await this.appendLogLine(
      deploymentId,
      `[deploy] 已排队自动回滚部署 #${rollbackDeployment.id.slice(0, 8)}`,
    ).catch(() => undefined);

    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'failed', completedAt: new Date() },
    });
    void this.commitStatus.reportForDeployment(
      deploymentId,
      'deploy',
      'failure',
      'Health check failed; rollback queued',
    );
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
