import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ServerOs,
  GitProvider,
  resolveDeployAccessHost,
  buildNginxServerNameList,
  isLoopbackHostLabel,
  buildPm2StaticSiteRootUrl,
  normalizeHttpRootUrlWithSlash,
  isSameHttpSiteHost,
  shortId,
} from '@shipyard/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { Queue } from 'bullmq';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { GitCommitStatusService } from '../../git/git-commit-status.service';
import { GitPrCommentApplicationService } from '../../git/application/git-pr-comment.application.service';
import { NotificationEnqueueApplicationService } from '../../notifications/application/notification-enqueue.application.service';
import { NotificationEvent } from '@shipyard/shared';
import { PreviewPortPoolService } from './preview-port-pool.service';
import { KubernetesClustersApplicationService } from '../../kubernetes-clusters/application/kubernetes-clusters.application.service';
import { envReleaseConfig } from '../domain/env-release-config';
import { resolveCanaryNginxBodyForDeploy } from '../domain/canary-nginx-fragment';
import type { ReleaseConfig } from '../../environments/domain/release-config.schema';
import { assertSafeOutboundHttpUrl } from '../../notifications/outbound-url-guard';
import { Client as SshClient } from 'ssh2';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { spawn } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import * as tar from 'tar';

export interface DeployJobData {
  deploymentId: string;
  projectId: string;
  orgId: string;
  /** 常规环境部署 */
  environmentId?: string;
  /** PR 预览部署（与 environmentId 互斥） */
  previewId?: string;
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
    private readonly previewPorts: PreviewPortPoolService,
    private readonly gitPrComment: GitPrCommentApplicationService,
    private readonly notifications: NotificationEnqueueApplicationService,
    private readonly k8sClusters: KubernetesClustersApplicationService,
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
      const serverDirect = normalizeHttpRootUrlWithSlash(opts.serverHost);
      if (
        serverDirect &&
        opts.serverHost.trim().length > 0 &&
        !isSameHttpSiteHost(accessHost, opts.serverHost)
      ) {
        lines.push(`[deploy] 服务器直连访问（域名未解析时可先试）: ${serverDirect}`);
      }
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

  /** 部署失败日志与通知：附带 errno/code（如 SSH）便于排障 */
  private formatDeployFailureMessage(err: unknown): string {
    if (err instanceof Error) {
      const ext = err as Error & { code?: string; errno?: number };
      const hint =
        ext.code != null
          ? String(ext.code)
          : ext.errno != null
            ? `errno=${String(ext.errno)}`
            : '';
      return hint ? `${err.message} [${hint}]` : err.message;
    }
    return String(err);
  }

  /** 与构建日志同一套存储与 Pub/Sub，便于详情页连续展示 */
  private async appendLogLine(deploymentId: string, content: string): Promise<void> {
    const agg = await this.prisma.deploymentLog.aggregate({
      where: { deploymentId },
      _max: { seq: true },
    });
    const seq = (agg._max.seq ?? -1) + 1;
    try {
      await this.prisma.deploymentLog.create({ data: { deploymentId, seq, content } });
    } catch (e) {
      this.logger.warn(`写入 deploymentLog 失败 deploymentId=${deploymentId}: ${e}`);
    }
    try {
      await this.redis.publishLog(deploymentId, { deploymentId, line: content, seq });
    } catch (e) {
      this.logger.warn(`发布部署日志到 Redis 失败 deploymentId=${deploymentId}: ${e}`);
    }
  }

  async deploy(data: DeployJobData) {
    if (data.previewId) {
      return this.deployPreview({
        deploymentId: data.deploymentId,
        projectId: data.projectId,
        previewId: data.previewId,
        orgId: data.orgId,
      });
    }
    const environmentId = data.environmentId;
    if (!environmentId) throw new Error('缺少 environmentId');
    const { deploymentId, projectId } = data;
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
          include: {
            server: true,
            environmentServers: { orderBy: { sortOrder: 'asc' }, include: { server: true } },
          },
        }),
        this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
        this.prisma.pipelineConfig.findUniqueOrThrow({ where: { projectId } }),
      ]);

      if (!deployment.artifact) throw new Error('构建产物不存在');

      const rc = envReleaseConfig(env.releaseConfig);
      await this.appendLogLine(deploymentId, `[deploy] executor=${rc.executor} strategy=${rc.strategy}`);

      const lockKey = `deploy-lock:${environmentId}`;
      await this.appendLogLine(deploymentId, '[deploy] 获取部署锁…');
      const locked = await this.redis.acquireLock(lockKey, 600);
      if (!locked) throw new Error('该环境正在部署中，请稍后重试');

      const sshKeyPath = path.join('/tmp', `shipyard-deploy-${deploymentId}.pem`);
      let tmpExtractDir: string | null = null;
      /** 蓝绿：健康/Prometheus 失败时回滚入口流量 */
      let blueGreenRollback:
        | {
            kind: 'static';
            connParams: { host: string; port: number; username: string; privateKey: string };
            slug: string;
            serverNames: string;
            deployPath: string;
            oldSlot: 0 | 1;
          }
        | {
            kind: 'ssr';
            connParams: { host: string; port: number; username: string; privateKey: string };
            slug: string;
            serverNames: string;
            oldPort: number;
            candidatePm2Name: string;
          }
        | null = null;
      let blueGreenSuccessSlot: 0 | 1 | null = null;
      /** SSR 蓝绿：仅在外网健康与 Prometheus 通过后再摘除旧 PM2，以便失败时仍能回滚入口 */
      let blueGreenSsrCutover: (() => Promise<void>) | null = null;

      try {
        if (rc.executor === 'kubernetes') {
          if (rc.strategy === 'canary') {
            throw new Error('Kubernetes 执行器不支持 strategy=canary，请在环境中改用 SSH 或调整 strategy');
          }
          if (rc.strategy === 'blue_green') {
            throw new Error('Kubernetes 执行器不支持 strategy=blue_green，请在环境中改用 SSH 或调整 strategy');
          }
          await this.performKubernetesRollout({
            deploymentId,
            orgId: data.orgId,
            deployment,
            pipelineConfig,
            rc,
          });
          await this.appendLogLine(deploymentId, '[deploy] 远端 Kubernetes 步骤已完成');
        } else if (rc.executor === 'object_storage') {
          tmpExtractDir = path.join('/tmp', `deploy-${deploymentId}`);
          mkdirSync(tmpExtractDir, { recursive: true });
          await this.appendLogLine(deploymentId, '[deploy] object_storage：解压产物包…');
          await tar.extract({ file: deployment.artifact.storagePath, cwd: tmpExtractDir });
          await this.appendLogLine(deploymentId, '[deploy] object_storage：开始 S3 同步…');
          await this.performObjectStorageSync({ deploymentId, localDir: tmpExtractDir, rc });
          await this.appendLogLine(deploymentId, '[deploy] object_storage：同步完成');
        } else {
          const targets = this.resolveDeployTargetServers(env);
          const primaryId = this.resolvePrimaryServerId(env, rc);
          const primaryServer =
            targets.find((s) => s.id === primaryId) ?? targets[0] ?? env.server;
          await this.appendLogLine(
            deploymentId,
            `[deploy] 目标 ${targets.length} 台，入口机 ${primaryServer.host}:${primaryServer.port}，路径 ${env.deployPath}`,
          );

          const envVars = await this.getDecryptedEnvVars(environmentId);
          tmpExtractDir = path.join('/tmp', `deploy-${deploymentId}`);
          mkdirSync(tmpExtractDir, { recursive: true });
          await this.appendLogLine(deploymentId, '[deploy] 开始解压产物包…');
          await tar.extract({ file: deployment.artifact.storagePath, cwd: tmpExtractDir });
          await this.appendLogLine(deploymentId, '[deploy] 产物包已解压到本地临时目录');

          const primaryKey = this.crypto.decrypt(primaryServer.privateKey);
          await writeFile(sshKeyPath, primaryKey, { encoding: 'utf8', mode: 0o600 });

          await this.maybeRunSshHooks({
            deploymentId,
            commands: rc.hooks?.preDeploy,
            label: 'preDeploy',
            host: primaryServer.host,
            port: primaryServer.port,
            username: primaryServer.user,
            privateKey: primaryKey,
            deployPath: env.deployPath,
          });

          const canaryResolved = resolveCanaryNginxBodyForDeploy(rc);
          if (rc.strategy === 'canary' && canaryResolved.kind === 'none') {
            await this.appendLogLine(
              deploymentId,
              '[deploy] canary：配置不足以生成或手写片段（须 nginxCanaryPath，且手写 body 或生成模式字段齐全），本次跳过片段写入',
            );
          }

          const useBgStatic =
            rc.strategy === 'blue_green' &&
            project.frameworkType !== 'ssr' &&
            primaryServer.os === ServerOs.LINUX &&
            !!env.domain?.trim();

          const useBgSsr =
            rc.strategy === 'blue_green' &&
            project.frameworkType === 'ssr' &&
            primaryServer.os === ServerOs.LINUX &&
            !!env.domain?.trim();

          if (useBgStatic) {
            const bg = await this.sshDeployBlueGreenStatic({
              deploymentId,
              env,
              primaryServer,
              privateKey: primaryKey,
              sshKeyPath,
              localDir: tmpExtractDir,
              projectSlug: project.slug,
            });
            macStaticPort = undefined;
            blueGreenRollback = bg.rollback;
            blueGreenSuccessSlot = bg.candidateSlot;
          } else if (useBgSsr) {
            if (targets.length > 1) {
              await this.appendLogLine(
                deploymentId,
                '[deploy] blue_green SSR：多机环境下仅对入口机执行双槽与 Nginx 切换（与静态蓝绿一致），其余目标机本次未同步',
              );
            }
            const bg = await this.sshDeployBlueGreenSsr({
              deploymentId,
              environmentId,
              env: {
                deployPath: env.deployPath,
                domain: env.domain,
                blueGreenActiveSlot: env.blueGreenActiveSlot,
                name: env.name,
                healthCheckUrl: env.healthCheckUrl,
              },
              primaryServer,
              privateKey: primaryKey,
              sshKeyPath,
              localDir: tmpExtractDir,
              projectSlug: project.slug,
              ssrEntryPoint: pipelineConfig.ssrEntryPoint ?? 'dist/index.js',
              envVars,
            });
            macStaticPort = undefined;
            blueGreenRollback = bg.rollback;
            blueGreenSuccessSlot = bg.candidateSlot;
            blueGreenSsrCutover = bg.cutover;
          } else {
            if (rc.strategy === 'blue_green') {
              await this.appendLogLine(
                deploymentId,
                '[deploy] blue_green：当前不满足静态/SSR 蓝绿条件（须 Linux 且配置域名），回退为与 direct 相同的多机同步语义',
              );
            }
            for (let i = 0; i < targets.length; i++) {
              const server = targets[i]!;
              const isPrimary = server.id === primaryId;
              const pk = this.crypto.decrypt(server.privateKey);
              await writeFile(sshKeyPath, pk, { encoding: 'utf8', mode: 0o600 });
              await this.appendLogLine(
                deploymentId,
                `[deploy] rsync → ${server.user}@${server.host}:${env.deployPath} (${i + 1}/${targets.length})`,
              );
              const sshResult = await this.sshDeploy({
                deploymentId,
                host: server.host,
                port: server.port,
                username: server.user,
                privateKey: pk,
                sshKeyPath,
                serverOs: server.os,
                deployPath: env.deployPath,
                localDir: tmpExtractDir,
                frameworkType: project.frameworkType,
                projectSlug: project.slug,
                domain: isPrimary ? (env.domain ?? null) : null,
                ssrEntryPoint: pipelineConfig.ssrEntryPoint ?? 'dist/index.js',
                envVars,
                skipNginx: !isPrimary,
                skipPm2: !isPrimary && project.frameworkType === 'static',
              });
              if (isPrimary) macStaticPort = sshResult.macStaticPort;
            }

            if (rc.strategy === 'canary' && canaryResolved.body && primaryServer.os === ServerOs.LINUX) {
              const fragPath = rc.ssh?.nginxCanaryPath?.trim();
              if (!fragPath) {
                await this.appendLogLine(deploymentId, '[deploy] canary：缺少 nginxCanaryPath，跳过片段写入');
              } else {
                if (canaryResolved.kind === 'generated') {
                  const sub =
                    canaryResolved.generatedTemplate === 'upstream_weight'
                      ? 'upstream_weight'
                      : 'split_clients';
                  await this.appendLogLine(
                    deploymentId,
                    `[deploy] canary_fragment_generated ${sub}`,
                  );
                } else {
                  await this.appendLogLine(deploymentId, '[deploy] canary_fragment_manual');
                }
                await this.appendLogLine(deploymentId, '[deploy] traffic_switch 写入金丝雀 Nginx 片段');
                await this.sshWriteCanaryNginxAtomic({
                  deploymentId,
                  host: primaryServer.host,
                  port: primaryServer.port,
                  username: primaryServer.user,
                  privateKey: primaryKey,
                  fragmentPath: fragPath,
                  body: canaryResolved.body,
                });
              }
            }
          }

          await this.maybeRunSshHooks({
            deploymentId,
            commands: rc.hooks?.postDeploy,
            label: 'postDeploy',
            host: primaryServer.host,
            port: primaryServer.port,
            username: primaryServer.user,
            privateKey: primaryKey,
            deployPath: env.deployPath,
          });

          await this.appendLogLine(deploymentId, '[deploy] 远端 rsync / PM2 / Nginx 步骤已完成');
        }
      } finally {
        await unlink(sshKeyPath).catch(() => undefined);
        await this.redis.releaseLock(lockKey);
        if (tmpExtractDir) rmSync(tmpExtractDir, { recursive: true, force: true });
      }

      // 健康检查
      if (!skipHealthCheck && env.healthCheckUrl) {
        await this.appendLogLine(deploymentId, `[deploy] health_ok 探测 ${env.healthCheckUrl}`);
        const healthy = await this.healthCheck(env.healthCheckUrl);
        if (!healthy) {
          await this.appendLogLine(deploymentId, '[deploy] 健康检查未通过');
          if (blueGreenRollback) {
            await this.revertBlueGreenTraffic(deploymentId, blueGreenRollback);
          }
          await this.triggerAutoRollback(data);
          return;
        }
        await this.appendLogLine(deploymentId, '[deploy] health_ok 通过');
      } else if (skipHealthCheck) {
        await this.appendLogLine(deploymentId, '[deploy] 已跳过健康检查（回滚流程）');
      }

      try {
        await this.maybePrometheusGate(deploymentId, rc);
      } catch (pe) {
        const msg = this.formatDeployFailureMessage(pe);
        await this.appendLogLine(deploymentId, `[deploy] gate prometheus 未通过: ${msg}`);
        if (blueGreenRollback) {
          await this.revertBlueGreenTraffic(deploymentId, blueGreenRollback);
        }
        throw pe;
      }

      if (blueGreenSsrCutover) {
        await blueGreenSsrCutover();
        blueGreenSsrCutover = null;
      }

      if (blueGreenSuccessSlot != null) {
        await this.prisma.environment.update({
          where: { id: environmentId },
          data: { blueGreenActiveSlot: blueGreenSuccessSlot },
        });
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

      void this.notifications.enqueue(
        projectId,
        NotificationEvent.DEPLOY_SUCCESS,
        `部署成功：${deploymentId.slice(0, 8)}…`,
        { deploymentId },
      );
    } catch (err) {
      const message = this.formatDeployFailureMessage(err);
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

      void this.notifications.enqueue(
        projectId,
        NotificationEvent.DEPLOY_FAILED,
        `部署失败：${message}`,
        { deploymentId },
      );
    }
  }

  private static readonly PREVIEW_NGINX_DIR = '/etc/nginx/shipyard-previews.d';
  private static readonly PREVIEW_WWW_ROOT = '/var/www/shipyard-previews';

  private previewPm2AppName(projectSlug: string, prNumber: number): string {
    return `sh-preview-${this.sanitizePm2Segment(projectSlug)}-pr-${prNumber}`;
  }

  /** SSR 蓝绿：双槽位 PM2 进程名（与 Preview.ssrBgSlot 对应） */
  private previewPm2BgName(baseName: string, slot: 0 | 1): string {
    return `${baseName}-bg${slot}`;
  }

  /** 常规环境 SSR 蓝绿：按环境 id 稳定分配一对本地端口，避免与预览池冲突 */
  private envSsrBlueGreenPorts(environmentId: string): { port0: number; port1: number } {
    let h = 0;
    for (let i = 0; i < environmentId.length; i++) {
      h = (h * 31 + environmentId.charCodeAt(i)) >>> 0;
    }
    const base = 32200 + (h % 900) * 2;
    return { port0: base, port1: base + 1 };
  }

  private envRegularPm2BgBase(projectSlug: string, envName: string): string {
    return `sh-env-${this.sanitizePm2Segment(projectSlug)}-${this.sanitizePm2Segment(envName)}`;
  }

  /** 从环境健康检查 URL 推导本地探活 path（与预览路径规则一致，非法则退化为 /） */
  private envSsrLocalHealthPath(healthCheckUrl: string | null | undefined): string {
    const s = healthCheckUrl?.trim();
    if (!s) return '/';
    try {
      const u = new URL(s);
      const p = (u.pathname || '/').trim() || '/';
      if (!/^[/a-zA-Z0-9._~-]*$/.test(p)) return '/';
      return p;
    } catch {
      const p = s.startsWith('/') ? s : `/${s}`;
      if (!/^[/a-zA-Z0-9._~-]+$/.test(p)) return '/';
      return p;
    }
  }

  /** SSH 连通后检测远端必备命令，失败时抛出带 [precheck] 前缀的说明 */
  private async sshRemotePrecheck(
    conn: SshClient,
    deploymentId: string,
    opts: { needNginx: boolean; needPm2: boolean },
  ): Promise<void> {
    const parts: string[] = [
      'command -v bash >/dev/null 2>&1 || { echo "missing: bash"; exit 2; }',
      'command -v rsync >/dev/null 2>&1 || { echo "missing: rsync"; exit 2; }',
    ];
    if (opts.needNginx) {
      parts.push('command -v nginx >/dev/null 2>&1 || { echo "missing: nginx"; exit 2; }');
    }
    if (opts.needPm2) {
      parts.push('command -v pm2 >/dev/null 2>&1 || { echo "missing: pm2"; exit 2; }');
      parts.push(
        'command -v node >/dev/null 2>&1 || { echo "missing: node"; exit 2; }',
      );
    }
    const script = parts.join('; ');
    try {
      await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(script)}`);
    } catch (e) {
      const tail = this.formatDeployFailureMessage(e);
      let hint = `[precheck] 远端环境检测未通过（需 bash、rsync` +
        (opts.needNginx ? '、nginx' : '') +
        (opts.needPm2 ? '、node、pm2' : '') +
        `）。详情: ${tail}`;
      if (opts.needPm2 && tail.includes('missing: node')) {
        hint +=
          '。nvm 常把 node 写在 ~/.bashrc，SSH 非登录 shell 可能未加载；请用 `bash -lc "command -v node"` 在远端自测，或将 node 装到全局 PATH；详见 README「运维与 nvm」。';
      }
      throw new Error(hint);
    }
    await this.appendLogLine(
      deploymentId,
      `[precheck] 通过（bash/rsync${opts.needNginx ? '/nginx' : ''}${opts.needPm2 ? '/node/pm2' : ''}）`,
    );
  }

  /** 预览 Nginx 片段：先写临时文件再 rename，避免 include 读到半成品 */
  private async sshWritePreviewNginxAtomic(
    conn: SshClient,
    nginxSnippetPath: string,
    body: string,
    deploymentId: string,
  ): Promise<void> {
    const tag = `SYXSH_${randomBytes(8).toString('hex')}`;
    if (body.includes(tag)) {
      throw new Error('Nginx 片段内容与内部分隔符冲突，请调整域名或路径后重试');
    }
    const qDir = this.shellSingleQuote(DeployApplicationService.PREVIEW_NGINX_DIR);
    const qFinal = this.shellSingleQuote(nginxSnippetPath);
    const staging = `/tmp/shipyard-preview-nginx.${randomBytes(12).toString('hex')}.tmp`;
    const qStaging = this.shellSingleQuote(staging);
    const inner = [
      'set -euo pipefail',
      `sudo mkdir -p ${qDir}`,
      `tmp=${qStaging}`,
      `cat > "$tmp" <<'${tag}'`,
      body,
      tag,
      `sudo mv -f "$tmp" ${qFinal}`,
      'sudo nginx -t && sudo nginx -s reload',
    ].join('\n');
    await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(inner)}`);
    await this.appendLogLine(deploymentId, '[preview-deploy] nginx 片段已原子更新并重载');
  }

  /** Linux 常规站点：sites-available 原子写入后与 sites-enabled 软链 */
  private async sshWriteLinuxSiteNginxAtomic(
    conn: SshClient,
    slug: string,
    nginxConf: string,
    deploymentId: string,
  ): Promise<void> {
    const tag = `SYXLNX_${randomBytes(8).toString('hex')}`;
    if (nginxConf.includes(tag)) {
      throw new Error('Nginx 配置与内部分隔符冲突，请调整域名后重试');
    }
    const conf = `/etc/nginx/sites-available/${slug}.conf`;
    const enabled = `/etc/nginx/sites-enabled/${slug}.conf`;
    const qFinal = this.shellSingleQuote(conf);
    const qEn = this.shellSingleQuote(enabled);
    const staging = `/tmp/shipyard-site-nginx.${randomBytes(12).toString('hex')}.tmp`;
    const qStaging = this.shellSingleQuote(staging);
    const inner = [
      'set -euo pipefail',
      'sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled',
      `tmp=${qStaging}`,
      `cat > "$tmp" <<'${tag}'`,
      nginxConf,
      tag,
      `sudo mv -f "$tmp" ${qFinal}`,
      `sudo ln -sf ${qFinal} ${qEn}`,
      'sudo nginx -t && sudo nginx -s reload',
    ].join('\n');
    await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(inner)}`);
    await this.appendLogLine(deploymentId, '[deploy] Linux 站点 Nginx 已原子更新并重载');
  }

  /** 预览 SSR 健康路径：须以 / 开头，防注入仅允许常见 path 字符 */
  private normalizePreviewHealthCheckPath(raw: string | null | undefined): string {
    const s = (raw ?? '/').trim() || '/';
    if (!s.startsWith('/')) return `/${s}`;
    if (!/^[/a-zA-Z0-9._~-]+$/.test(s)) {
      throw new Error('previewHealthCheckPath 仅允许字母数字及 / . _ - ~');
    }
    return s;
  }

  /** 在远端对 SSR 候选端口做 HTTP 探活（与 Nginx 切换前门禁一致） */
  private async sshPreviewSsrHealthCheck(
    conn: SshClient,
    port: number,
    deploymentId: string,
    healthPath: string,
  ): Promise<void> {
    const max = 5;
    const sleepSec = 2;
    const inner = `for i in $(seq 1 ${max}); do curl -fsS --max-time 5 "http://127.0.0.1:${port}${healthPath}" >/dev/null 2>&1 && exit 0; sleep ${sleepSec}; done; exit 1`;
    try {
      await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(inner)}`);
    } catch {
      throw new Error(
        `SSR 候选实例健康检查未通过（http://127.0.0.1:${port}${healthPath} ，已重试 ${max} 次）`,
      );
    }
    await this.appendLogLine(
      deploymentId,
      `[preview-deploy] health_ok localhost:${port}${healthPath}`,
    );
  }

  private shellSingleQuote(s: string): string {
    return `'${s.replace(/'/g, `'"'"'`)}'`;
  }

  /** 移除 build/deploy 队列中尚未执行的同名 job（与 Pipeline/BuildWorker 的 jobId 约定一致） */
  private async cancelQueuedJobsForDeployment(orgId: string, deploymentId: string): Promise<void> {
    const jobId = `deploy-${deploymentId}`;
    const connection = this.redis.getClient();
    for (const queueName of [`build-${orgId}`, `deploy-${orgId}`]) {
      const queue = new Queue(queueName, { connection });
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          try {
            await job.remove();
            this.logger.log(`Removed queued job ${jobId} from ${queueName}`);
          } catch (e) {
            this.logger.warn(`Failed to remove job ${jobId} from ${queueName}: ${e}`);
          }
        }
      } finally {
        await queue.close();
      }
    }
  }

  /** PR 关闭时清理远端资源与数据库（幂等） */
  async teardownPreviewForPr(orgId: string, projectId: string, prNumber: number): Promise<void> {
    const preview = await this.prisma.preview.findUnique({
      where: { projectId_prNumber: { projectId, prNumber } },
      include: { project: { include: { previewServer: true } } },
    });
    if (!preview) return;

    await this.cancelQueuedJobsForDeployment(orgId, preview.deploymentId);

    if (!preview.project.previewServer) return;

    const project = preview.project;
    const server = preview.project.previewServer;
    if (server.os !== ServerOs.LINUX) {
      await this.prisma.preview.delete({ where: { id: preview.id } }).catch(() => undefined);
      return;
    }

    const privateKey = this.crypto.decrypt(server.privateKey);
    const sshKeyPath = path.join('/tmp', `shipyard-preview-teardown-${preview.id}.pem`);
    const deployBase = `${DeployApplicationService.PREVIEW_WWW_ROOT}/${project.slug}/pr-${preview.prNumber}-${shortId(projectId)}`;
    const pm2Name = this.previewPm2AppName(project.slug, preview.prNumber);
    const nginxPath = `${DeployApplicationService.PREVIEW_NGINX_DIR}/shipyard-preview-${preview.id}.conf`;

    try {
      await writeFile(sshKeyPath, privateKey, { encoding: 'utf8', mode: 0o600 });
      const conn = await this.createSshClient({
        host: server.host,
        port: server.port,
        username: server.user,
        privateKey,
      });
      try {
        const q0 = this.shellSingleQuote(this.previewPm2BgName(pm2Name, 0));
        const q1 = this.shellSingleQuote(this.previewPm2BgName(pm2Name, 1));
        const qLegacy = this.shellSingleQuote(pm2Name);
        const inner = [
          `pm2 describe ${qLegacy} >/dev/null 2>&1 && pm2 delete ${qLegacy} || true`,
          `pm2 describe ${q0} >/dev/null 2>&1 && pm2 delete ${q0} || true`,
          `pm2 describe ${q1} >/dev/null 2>&1 && pm2 delete ${q1} || true`,
          `sudo rm -f ${this.shellSingleQuote(nginxPath)}`,
          `(sudo nginx -t && sudo nginx -s reload) || true`,
          `rm -rf ${this.shellSingleQuote(deployBase)}`,
        ].join('; ');
        await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(inner)}`);
      } finally {
        conn.end();
      }
    } catch (e) {
      this.logger.warn(`Preview teardown SSH failed project=${projectId} pr=${prNumber}: ${e}`);
    } finally {
      await unlink(sshKeyPath).catch(() => undefined);
    }

    if (preview.allocatedPort != null) {
      await this.previewPorts.releaseIfOwned(server.id, preview.allocatedPort, preview.id);
    }
    await this.prisma.preview.delete({ where: { id: preview.id } }).catch(() => undefined);
  }

  private resolveDeployTargetServers(env: {
    server: {
      id: string;
      host: string;
      port: number;
      user: string;
      privateKey: string;
      os: string;
    };
    environmentServers: Array<{ server: (typeof env)['server'] }>;
  }): Array<(typeof env)['server']> {
    if (env.environmentServers?.length) {
      return env.environmentServers.map((es) => es.server);
    }
    return [env.server];
  }

  private resolvePrimaryServerId(
    env: { serverId: string; environmentServers: Array<{ serverId: string; sortOrder: number }> },
    rc: ReleaseConfig,
  ): string {
    if (rc.ssh?.primaryServerId) return rc.ssh.primaryServerId;
    if (env.environmentServers?.length) {
      return [...env.environmentServers].sort((a, b) => a.sortOrder - b.sortOrder)[0]!.serverId;
    }
    return env.serverId;
  }

  private async sshDeployBlueGreenStatic(opts: {
    deploymentId: string;
    env: {
      deployPath: string;
      domain: string | null;
      blueGreenActiveSlot: number | null;
    };
    primaryServer: { host: string; port: number; user: string; privateKey: string; os: string };
    privateKey: string;
    sshKeyPath: string;
    localDir: string;
    projectSlug: string;
  }): Promise<{
    candidateSlot: 0 | 1;
    rollback: {
      kind: 'static';
      connParams: { host: string; port: number; username: string; privateKey: string };
      slug: string;
      serverNames: string;
      deployPath: string;
      oldSlot: 0 | 1;
    } | null;
  }> {
    const active = opts.env.blueGreenActiveSlot;
    const candidate: 0 | 1 = active === null || active === 1 ? 0 : 1;
    const oldSlot: 0 | 1 | null = active === 0 || active === 1 ? active : null;
    const { deployPath } = opts.env;
    const slotPath = `${deployPath}/.shipyard-bg${candidate}`;
    const server = opts.primaryServer;

    const connMk = await this.createSshClient({
      host: server.host,
      port: server.port,
      username: server.user,
      privateKey: opts.privateKey,
    });
    try {
      await this.sshRemotePrecheck(connMk, opts.deploymentId, { needNginx: true, needPm2: false });
      await this.sshExec(connMk, `bash -lc ${this.shellSingleQuote(`mkdir -p ${slotPath}`)}`);
    } finally {
      connMk.end();
    }

    await this.execLocal('rsync', [
      '-avz',
      '--delete',
      `${opts.localDir}/`,
      `${server.user}@${server.host}:${slotPath}/`,
      '-e',
      `ssh -p ${server.port} -i ${opts.sshKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`,
    ]);

    const conn = await this.createSshClient({
      host: server.host,
      port: server.port,
      username: server.user,
      privateKey: opts.privateKey,
    });
    try {
      const serverNames = buildNginxServerNameList(opts.env.domain!.trim(), server.host);
      const nginxConf = this.generateStaticNginxConf(serverNames, slotPath);
      await this.sshWriteLinuxSiteNginxAtomic(conn, opts.projectSlug, nginxConf, opts.deploymentId);
      await this.appendLogLine(opts.deploymentId, '[deploy] traffic_switch Nginx root → 候选槽');
      const rollback =
        oldSlot === 0 || oldSlot === 1
          ? {
              kind: 'static' as const,
              connParams: {
                host: server.host,
                port: server.port,
                username: server.user,
                privateKey: opts.privateKey,
              },
              slug: opts.projectSlug,
              serverNames,
              deployPath,
              oldSlot,
            }
          : null;
      return { candidateSlot: candidate, rollback };
    } finally {
      conn.end();
    }
  }

  private async sshDeployBlueGreenSsr(opts: {
    deploymentId: string;
    environmentId: string;
    env: {
      deployPath: string;
      domain: string | null;
      blueGreenActiveSlot: number | null;
      name: string;
      healthCheckUrl: string | null;
    };
    primaryServer: { host: string; port: number; user: string; privateKey: string; os: string };
    privateKey: string;
    sshKeyPath: string;
    localDir: string;
    projectSlug: string;
    ssrEntryPoint: string;
    envVars: Record<string, string>;
  }): Promise<{
    candidateSlot: 0 | 1;
    rollback: {
      kind: 'ssr';
      connParams: { host: string; port: number; username: string; privateKey: string };
      slug: string;
      serverNames: string;
      oldPort: number;
      candidatePm2Name: string;
    };
    cutover: () => Promise<void>;
  }> {
    const active = opts.env.blueGreenActiveSlot;
    const candidate: 0 | 1 = active === null || active === 1 ? 0 : 1;
    const oldSlot: 0 | 1 | null = active === 0 || active === 1 ? active : null;
    const { deployPath } = opts.env;
    const ports = this.envSsrBlueGreenPorts(opts.environmentId);
    const candidatePort = candidate === 0 ? ports.port0 : ports.port1;
    const oldPortForNginx = oldSlot === 0 ? ports.port0 : oldSlot === 1 ? ports.port1 : 3000;
    const slotPath = `${deployPath}/.shipyard-bg${candidate}`;
    const server = opts.primaryServer;

    const connMk = await this.createSshClient({
      host: server.host,
      port: server.port,
      username: server.user,
      privateKey: opts.privateKey,
    });
    try {
      await this.sshRemotePrecheck(connMk, opts.deploymentId, { needNginx: true, needPm2: true });
      await this.sshExec(connMk, `bash -lc ${this.shellSingleQuote(`mkdir -p ${slotPath}`)}`);
    } finally {
      connMk.end();
    }

    await this.appendLogLine(
      opts.deploymentId,
      `[deploy] blue_green SSR：槽位=${candidate} 本地端口=${candidatePort}（另一槽 ${oldSlot === 0 || oldSlot === 1 ? (oldSlot === 0 ? ports.port1 : ports.port0) : 'n/a'}，回滚 Nginx 目标端口=${oldPortForNginx}）`,
    );

    await this.execLocal('rsync', [
      '-avz',
      '--delete',
      `${opts.localDir}/`,
      `${server.user}@${server.host}:${slotPath}/`,
      '-e',
      `ssh -p ${server.port} -i ${opts.sshKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`,
    ]);

    const pm2Base = this.envRegularPm2BgBase(opts.projectSlug, opts.env.name);
    const candPm2Name = this.previewPm2BgName(pm2Base, candidate);
    const oldSlotPm2Name =
      oldSlot === 0 || oldSlot === 1 ? this.previewPm2BgName(pm2Base, oldSlot) : null;

    const mergedEnv = { ...opts.envVars, PORT: String(candidatePort) };
    const envStr = Object.entries(mergedEnv)
      .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`)
      .join(',\n');
    const ecosystemJs = `module.exports = {
  apps: [{
    name: ${JSON.stringify(candPm2Name)},
    script: ${JSON.stringify(opts.ssrEntryPoint)},
    cwd: ${JSON.stringify(slotPath)},
    env: {\n${envStr}\n    }
  }]
};`;

    const conn = await this.createSshClient({
      host: server.host,
      port: server.port,
      username: server.user,
      privateKey: opts.privateKey,
    });
    try {
      const serverNames = buildNginxServerNameList(opts.env.domain!.trim(), server.host);
      const nginxBodyNew = this.generateSsrNginxConf(serverNames, '127.0.0.1', candidatePort);
      const nginxBodyOld = this.generateSsrNginxConf(serverNames, '127.0.0.1', oldPortForNginx);

      const ecoPath = `${slotPath}/ecosystem.bg${candidate}.config.js`;
      await this.appendLogLine(
        opts.deploymentId,
        `[deploy] candidate_up SSR pm2=${candPm2Name} cwd=${slotPath}`,
      );
      await this.sshExec(
        conn,
        `cat > ${this.shellSingleQuote(ecoPath)} << 'EOFCONFIG'\n${ecosystemJs}\nEOFCONFIG`,
      );
      const qCand = this.shellSingleQuote(candPm2Name);
      const qEco = this.shellSingleQuote(ecoPath);
      const pm2Cand = `(pm2 describe ${qCand} >/dev/null 2>&1 && pm2 delete ${qCand} || true); pm2 start ${qEco}`;
      await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(pm2Cand)}`);

      const healthPath = this.envSsrLocalHealthPath(opts.env.healthCheckUrl);
      if (healthPath !== '/') {
        await this.appendLogLine(opts.deploymentId, `[deploy] SSR 本地健康路径: ${healthPath}（自 healthCheckUrl 推导）`);
      }
      try {
        await this.sshPreviewSsrHealthCheck(conn, candidatePort, opts.deploymentId, healthPath);
      } catch (hcErr) {
        await this.sshExec(
          conn,
          `bash -lc ${this.shellSingleQuote(`pm2 describe ${qCand} >/dev/null 2>&1 && pm2 delete ${qCand} || true`)}`,
        ).catch(() => undefined);
        throw hcErr;
      }

      await this.appendLogLine(opts.deploymentId, '[deploy] traffic_switch Nginx → 候选 SSR 端口');
      try {
        await this.sshWriteLinuxSiteNginxAtomic(conn, opts.projectSlug, nginxBodyNew, opts.deploymentId);
      } catch (nginxErr) {
        await this.sshWriteLinuxSiteNginxAtomic(conn, opts.projectSlug, nginxBodyOld, opts.deploymentId).catch((e) =>
          this.logger.warn(`蓝绿 SSR Nginx 回滚失败: ${e}`),
        );
        await this.sshExec(
          conn,
          `bash -lc ${this.shellSingleQuote(`pm2 describe ${qCand} >/dev/null 2>&1 && pm2 delete ${qCand} || true`)}`,
        ).catch(() => undefined);
        throw nginxErr;
      }

      const qLegacy = this.shellSingleQuote(opts.projectSlug);
      const oldSlotPm2NameCaptured = oldSlotPm2Name;
      const oldNameQ = oldSlotPm2NameCaptured ? this.shellSingleQuote(oldSlotPm2NameCaptured) : null;
      const cutoverHost = server.host;
      const cutoverPort = server.port;
      const cutoverUser = server.user;
      const cutoverPk = opts.privateKey;
      const cutoverDeploymentId = opts.deploymentId;

      const cutover = async (): Promise<void> => {
        const c = await this.createSshClient({
          host: cutoverHost,
          port: cutoverPort,
          username: cutoverUser,
          privateKey: cutoverPk,
        });
        try {
          const cutoverPm2 = [
            `pm2 describe ${qLegacy} >/dev/null 2>&1 && pm2 delete ${qLegacy} || true`,
            oldNameQ
              ? `pm2 describe ${oldNameQ} >/dev/null 2>&1 && pm2 delete ${oldNameQ} || true`
              : 'true',
          ].join('; ');
          await this.sshExec(c, `bash -lc ${this.shellSingleQuote(cutoverPm2)}`);
          await this.appendLogLine(
            cutoverDeploymentId,
            '[deploy] rollback_old_instance 已摘除旧 SSR 槽位/direct PM2',
          );
        } finally {
          c.end();
        }
      };

      const rollback = {
        kind: 'ssr' as const,
        connParams: {
          host: server.host,
          port: server.port,
          username: server.user,
          privateKey: opts.privateKey,
        },
        slug: opts.projectSlug,
        serverNames,
        oldPort: oldPortForNginx,
        candidatePm2Name: candPm2Name,
      };
      return { candidateSlot: candidate, rollback, cutover };
    } finally {
      conn.end();
    }
  }

  private async revertBlueGreenTraffic(
    deploymentId: string,
    rb:
      | {
          kind: 'static';
          connParams: { host: string; port: number; username: string; privateKey: string };
          slug: string;
          serverNames: string;
          deployPath: string;
          oldSlot: 0 | 1;
        }
      | {
          kind: 'ssr';
          connParams: { host: string; port: number; username: string; privateKey: string };
          slug: string;
          serverNames: string;
          oldPort: number;
          candidatePm2Name: string;
        },
  ): Promise<void> {
    if (rb.kind === 'static') {
      await this.revertBlueGreenNginxRoot(deploymentId, rb);
      return;
    }
    await this.revertBlueGreenSsr(deploymentId, rb);
  }

  private async revertBlueGreenNginxRoot(
    deploymentId: string,
    rb: {
      connParams: { host: string; port: number; username: string; privateKey: string };
      slug: string;
      serverNames: string;
      deployPath: string;
      oldSlot: 0 | 1;
    },
  ): Promise<void> {
    const c = rb.connParams;
    const conn = await this.createSshClient({
      host: c.host,
      port: c.port,
      username: c.username,
      privateKey: c.privateKey,
    });
    try {
      const root = `${rb.deployPath}/.shipyard-bg${rb.oldSlot}`;
      const nginxConf = this.generateStaticNginxConf(rb.serverNames, root);
      await this.sshWriteLinuxSiteNginxAtomic(conn, rb.slug, nginxConf, deploymentId);
      await this.appendLogLine(deploymentId, '[deploy] rollback 蓝绿：Nginx 已指回旧槽');
    } finally {
      conn.end();
    }
  }

  private async revertBlueGreenSsr(
    deploymentId: string,
    rb: {
      connParams: { host: string; port: number; username: string; privateKey: string };
      slug: string;
      serverNames: string;
      oldPort: number;
      candidatePm2Name: string;
    },
  ): Promise<void> {
    const c = rb.connParams;
    const conn = await this.createSshClient({
      host: c.host,
      port: c.port,
      username: c.username,
      privateKey: c.privateKey,
    });
    try {
      const nginxConf = this.generateSsrNginxConf(rb.serverNames, '127.0.0.1', rb.oldPort);
      await this.sshWriteLinuxSiteNginxAtomic(conn, rb.slug, nginxConf, deploymentId);
      const q = this.shellSingleQuote(rb.candidatePm2Name);
      await this.sshExec(
        conn,
        `bash -lc ${this.shellSingleQuote(`pm2 describe ${q} >/dev/null 2>&1 && pm2 delete ${q} || true`)}`,
      );
      await this.appendLogLine(deploymentId, '[deploy] rollback 蓝绿 SSR：Nginx 已指回旧端口并已摘除候选 PM2');
    } finally {
      conn.end();
    }
  }

  private async sshWriteCanaryNginxAtomic(opts: {
    deploymentId: string;
    host: string;
    port: number;
    username: string;
    privateKey: string;
    fragmentPath: string;
    body: string;
  }): Promise<void> {
    const conn = await this.createSshClient({
      host: opts.host,
      port: opts.port,
      username: opts.username,
      privateKey: opts.privateKey,
    });
    try {
      const dir = opts.fragmentPath.replace(/\/[^/]+$/, '') || '/';
      const tag = `SYXCY_${randomBytes(8).toString('hex')}`;
      if (opts.body.includes(tag)) {
        throw new Error('金丝雀 Nginx 片段与内部分隔符冲突');
      }
      const qDir = this.shellSingleQuote(dir);
      const qFinal = this.shellSingleQuote(opts.fragmentPath);
      const qBak = this.shellSingleQuote(`${opts.fragmentPath}.shipyard-canary-prev`);
      const staging = `/tmp/shipyard-canary-nginx.${randomBytes(12).toString('hex')}.tmp`;
      const qStaging = this.shellSingleQuote(staging);
      const inner = [
        'set -euo pipefail',
        `sudo mkdir -p ${qDir}`,
        `tmp=${qStaging}`,
        `final=${qFinal}`,
        `bak=${qBak}`,
        'if [ -f "$final" ]; then sudo cp -a "$final" "$bak"; fi',
        `cat > "$tmp" <<'${tag}'`,
        opts.body,
        tag,
        'sudo mv -f "$tmp" "$final"',
        'if ! sudo nginx -t; then',
        '  if [ -f "$bak" ]; then sudo mv -f "$bak" "$final"; else sudo rm -f "$final"; fi',
        '  exit 1',
        'fi',
        'sudo nginx -s reload',
        'sudo rm -f "$bak"',
      ].join('\n');
      await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(inner)}`);
      await this.appendLogLine(opts.deploymentId, '[deploy] 金丝雀 Nginx 片段已原子更新并重载');
    } finally {
      conn.end();
    }
  }

  /** 对象存储：本地目录同步至 S3（Worker 须安装 aws CLI；凭证见 objectStorage 与 IAM） */
  private async performObjectStorageSync(opts: {
    deploymentId: string;
    localDir: string;
    rc: ReleaseConfig;
  }): Promise<void> {
    const { deploymentId, localDir, rc } = opts;
    const os = rc.objectStorage;
    if (!os) throw new Error('缺少 objectStorage 配置');
    const bucket = os.bucket.trim();
    const prefix = (os.prefix ?? '').trim().replace(/^\/+/, '');
    const s3Uri = prefix
      ? `s3://${bucket}/${prefix.endsWith('/') ? prefix : `${prefix}/`}`
      : `s3://${bucket}/`;

    const extraEnv: NodeJS.ProcessEnv = {};
    if (os.region?.trim()) {
      const r = os.region.trim();
      extraEnv.AWS_DEFAULT_REGION = r;
      extraEnv.AWS_REGION = r;
    }
    if (os.credentialsEncrypted?.trim()) {
      try {
        const raw = this.crypto.decrypt(os.credentialsEncrypted.trim());
        const j = JSON.parse(raw) as { accessKeyId?: string; secretAccessKey?: string };
        if (typeof j.accessKeyId === 'string' && j.accessKeyId) {
          extraEnv.AWS_ACCESS_KEY_ID = j.accessKeyId;
        }
        if (typeof j.secretAccessKey === 'string' && j.secretAccessKey) {
          extraEnv.AWS_SECRET_ACCESS_KEY = j.secretAccessKey;
        }
      } catch {
        throw new Error('objectStorage.credentialsEncrypted 解密或解析失败');
      }
    }

    await this.appendLogLine(deploymentId, `[deploy] object_storage s3 sync → ${s3Uri}`);
    await this.execLocalEnv('aws', ['s3', 'sync', localDir, s3Uri, '--delete'], extraEnv);
  }

  /** K8s：set image + rollout status；健康检查与收尾由调用方与 SSH 路径共用 */
  private async performKubernetesRollout(opts: {
    deploymentId: string;
    orgId: string;
    deployment: { artifact: { imageRef: string | null; imageDigest: string | null } | null };
    pipelineConfig: { containerImageName: string | null };
    rc: ReleaseConfig;
  }): Promise<void> {
    const { deploymentId, orgId, deployment, pipelineConfig, rc } = opts;
    const k = rc.kubernetes;
    if (!k) throw new Error('缺少 kubernetes 配置');
    const artifact = deployment.artifact;
    if (!artifact) throw new Error('构建产物不存在');
    const image =
      artifact.imageRef?.trim() ||
      (artifact.imageDigest?.trim() && pipelineConfig.containerImageName?.trim()
        ? `${pipelineConfig.containerImageName.trim()}@${artifact.imageDigest.trim()}`
        : null);
    if (!image) {
      throw new Error('K8s 部署需要构建启用容器镜像并成功推送（制品须含 imageRef 或 imageDigest + 流水线 imageName）');
    }
    const kubeconfig = await this.k8sClusters.getDecryptedKubeconfig(orgId, k.clusterId);
    const kubePath = path.join('/tmp', `shipyard-kube-${deploymentId}.yaml`);
    await writeFile(kubePath, kubeconfig, { encoding: 'utf8', mode: 0o600 });
    try {
      const ns = k.namespace;
      const timeoutSec = k.rolloutTimeoutSeconds ?? 600;

      const primaryContainer = k.containerName?.trim();
      if (!primaryContainer) {
        throw new Error(
          'Kubernetes 缺少 kubernetes.containerName（须与 Pod 模板中容器名一致；勿依赖与 Deployment 同名）',
        );
      }
      const primary = {
        deploymentName: k.deploymentName.trim(),
        containerName: primaryContainer,
      };
      const extras =
        k.additionalDeployments?.map((ad) => ({
          deploymentName: ad.deploymentName.trim(),
          containerName: (ad.containerName ?? ad.deploymentName).trim(),
        })) ?? [];
      const seen = new Set<string>();
      const rolloutTargets = [primary, ...extras].filter((t) => {
        if (seen.has(t.deploymentName)) return false;
        seen.add(t.deploymentName);
        return true;
      });

      const rollingPatchSpec =
        rc.strategy === 'rolling' &&
        (k.rollingUpdateMaxSurge?.trim() || k.rollingUpdateMaxUnavailable?.trim())
          ? (() => {
              const ru: Record<string, string> = {};
              if (k.rollingUpdateMaxSurge?.trim()) ru.maxSurge = k.rollingUpdateMaxSurge.trim();
              if (k.rollingUpdateMaxUnavailable?.trim()) {
                ru.maxUnavailable = k.rollingUpdateMaxUnavailable.trim();
              }
              return {
                spec: {
                  strategy: {
                    type: 'RollingUpdate',
                    rollingUpdate: ru,
                  },
                },
              };
            })()
          : null;

      let rolloutIndex = 0;
      for (const target of rolloutTargets) {
        rolloutIndex += 1;
        const label =
          rolloutTargets.length > 1 ? `${rolloutIndex}/${rolloutTargets.length}` : '';

        if (rollingPatchSpec) {
          const ru = rollingPatchSpec.spec.strategy.rollingUpdate;
          await this.appendLogLine(
            deploymentId,
            `[deploy] k8s patch rollingUpdate ${label} surge=${ru.maxSurge ?? '—'} unavail=${ru.maxUnavailable ?? '—'} deploy=${target.deploymentName}`,
          );
          await this.execLocal('kubectl', [
            `--kubeconfig=${kubePath}`,
            '-n',
            ns,
            'patch',
            `deployment/${target.deploymentName}`,
            '-p',
            JSON.stringify(rollingPatchSpec),
            '--type=strategic',
          ]);
        }

        await this.appendLogLine(
          deploymentId,
          `[deploy] k8s set-image ${label} ns=${ns} deploy=${target.deploymentName} container=${target.containerName}`,
        );
        await this.execLocal('kubectl', [
          `--kubeconfig=${kubePath}`,
          '-n',
          ns,
          'set',
          'image',
          `deployment/${target.deploymentName}`,
          `${target.containerName}=${image}`,
        ]);
        await this.appendLogLine(
          deploymentId,
          `[deploy] k8s rollout status ${label} timeout=${timeoutSec}s deploy=${target.deploymentName}…`,
        );
        await this.execLocal('kubectl', [
          `--kubeconfig=${kubePath}`,
          '-n',
          ns,
          'rollout',
          'status',
          `deployment/${target.deploymentName}`,
          `--timeout=${timeoutSec}s`,
        ]);
      }

      await this.appendLogLine(deploymentId, '[deploy] traffic_switch k8s rollout 完成');
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          containerImageDigest: artifact.imageDigest ?? undefined,
          containerImageRef: artifact.imageRef ?? image,
        },
      });
    } finally {
      await unlink(kubePath).catch(() => undefined);
    }
  }

  private static readonly HOOK_LOG_MAX_LINE_CHARS = 4096;
  private static readonly HOOK_LOG_MAX_TOTAL_CHARS = 65536;

  /** 限制 hook 输出写入 deploymentLog 的体积 */
  private truncateHookLogOutput(raw: string): string {
    let total = 0;
    const lines = raw.split('\n');
    const parts: string[] = [];
    for (const line of lines) {
      const truncatedLine =
        line.length > DeployApplicationService.HOOK_LOG_MAX_LINE_CHARS
          ? `${line.slice(0, DeployApplicationService.HOOK_LOG_MAX_LINE_CHARS)}…[truncated-line]`
          : line;
      const addLen = truncatedLine.length + (parts.length > 0 ? 1 : 0);
      if (total + addLen > DeployApplicationService.HOOK_LOG_MAX_TOTAL_CHARS) {
        parts.push('…[truncated-total]');
        break;
      }
      parts.push(truncatedLine);
      total += addLen;
    }
    return parts.join('\n');
  }

  private async maybeRunSshHooks(opts: {
    deploymentId: string;
    commands: string[] | undefined;
    label: string;
    host: string;
    port: number;
    username: string;
    privateKey: string;
    deployPath: string;
  }): Promise<void> {
    const cmds = opts.commands?.filter((c) => c.trim().length > 0) ?? [];
    if (!cmds.length) return;
    const conn = await this.createSshClient({
      host: opts.host,
      port: opts.port,
      username: opts.username,
      privateKey: opts.privateKey,
    });
    try {
      const cwd = this.shellSingleQuote(opts.deployPath);
      for (const raw of cmds) {
        const cmd = raw.trim().slice(0, 4096);
        await this.appendLogLine(opts.deploymentId, `[deploy] hook ${opts.label}: ${cmd.slice(0, 200)}`);
        const inner = `set -euo pipefail; cd ${cwd}; timeout 120 bash -lc ${this.shellSingleQuote(cmd)}`;
        const out = await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(inner)}`);
        await this.appendRemoteStdoutToDeployLog(
          opts.deploymentId,
          this.truncateHookLogOutput(out),
        );
      }
    } finally {
      conn.end();
    }
  }

  private async maybePrometheusGate(deploymentId: string, rc: ReleaseConfig): Promise<void> {
    const prom = rc.gates?.prometheus;
    if (!prom?.queryUrl) return;
    if (!prom.queryUrl.trim().toLowerCase().startsWith('https://')) {
      throw new Error('Prometheus queryUrl 仅允许 https');
    }
    const u = await assertSafeOutboundHttpUrl(prom.queryUrl);
    await this.appendLogLine(deploymentId, `[deploy] gate prometheus GET ${u.toString().slice(0, 120)}…`);
    const { default: https } = await import('https');
    const { default: http } = await import('http');
    const client = u.protocol === 'https:' ? https : http;
    const body = await new Promise<string>((resolve, reject) => {
      const req = client.get(u, (res) => {
        let d = '';
        res.on('data', (c: Buffer) => {
          d += c.toString();
          if (d.length > 2_000_000) {
            req.destroy();
            reject(new Error('Prometheus 响应过大'));
          }
        });
        res.on('end', () => resolve(d));
      });
      req.on('error', reject);
      req.setTimeout(15_000, () => {
        req.destroy();
        reject(new Error('Prometheus 请求超时'));
      });
    });
    let parsed: { data?: { result?: Array<{ value?: [unknown, string] }> } };
    try {
      parsed = JSON.parse(body) as { data?: { result?: Array<{ value?: [unknown, string] }> } };
    } catch {
      throw new Error('Prometheus 响应非 JSON');
    }
    const samples = parsed.data?.result ?? [];
    let maxV = Number.NEGATIVE_INFINITY;
    for (const s of samples) {
      const v = parseFloat(String(s.value?.[1] ?? ''));
      if (!Number.isNaN(v)) maxV = Math.max(maxV, v);
    }
    if (samples.length === 0) maxV = 0;
    const threshold = prom.maxSampleValue ?? 0;
    const passBelow = prom.passIfBelowOrEqual !== false;
    const ok = passBelow ? maxV <= threshold : maxV >= threshold;
    if (!ok) {
      throw new Error(
        `Prometheus 门禁未通过：样本最大值=${maxV}，阈值=${threshold}（passIfBelowOrEqual=${passBelow}）`,
      );
    }
    await this.appendLogLine(deploymentId, `[deploy] gate prometheus ok max=${maxV}`);
  }

  async deployPreview(opts: { deploymentId: string; projectId: string; previewId: string; orgId: string }) {
    const { deploymentId, projectId, previewId } = opts;
    let gitConn: { gitProvider: string; accessToken: string; baseUrl: string | null } | null = null;
    /** SSR：已 tryAllocate 但未写入 Preview.allocatedPort 时，失败路径须释放 Redis 避免端口泄漏 */
    let ssrPortRollback: { serverId: string; port: number; previewRowId: string } | null = null;

    try {
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'deploying' },
      });
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'deploy',
        'pending',
        'Shipyard preview deployment in progress',
      );
      await this.appendLogLine(deploymentId, '[preview-deploy] 开始 PR 预览部署…');

      gitConn = await this.prisma.gitConnection.findUnique({
        where: { projectId },
        select: { gitProvider: true, accessToken: true, baseUrl: true },
      });

      const preview = await this.prisma.preview.findUniqueOrThrow({
        where: { id: previewId },
        include: { project: { include: { previewServer: true, pipelineConfig: true } } },
      });

      if (preview.deploymentId !== deploymentId) {
        await this.appendLogLine(
          deploymentId,
          '[preview-deploy] 已跳过：该构建已被更新的 PR commit 取代',
        );
        await this.prisma.deployment.update({
          where: { id: deploymentId },
          data: { status: 'cancelled', completedAt: new Date() },
        });
        return;
      }

      const project = preview.project;
      const baseDomain = project.previewBaseDomain?.trim();
      const server = project.previewServer;
      if (!server || !baseDomain) {
        throw new Error('预览未配置 previewServer 或 previewBaseDomain');
      }
      if (server.os !== ServerOs.LINUX) {
        throw new Error('PR 预览部署当前仅支持 Linux 目标服务器');
      }

      const deployment = await this.prisma.deployment.findUniqueOrThrow({
        where: { id: deploymentId },
        include: { artifact: true },
      });
      const pipelineConfig = project.pipelineConfig;
      if (!deployment.artifact) throw new Error('构建产物不存在');
      if (!pipelineConfig) throw new Error('缺少流水线配置');

      const previewHost = (() => {
        try {
          return new URL(preview.url).hostname;
        } catch {
          return preview.url.replace(/^https?:\/\//, '').split('/')[0] ?? '';
        }
      })();
      if (!previewHost) throw new Error('预览 URL 无效');

      const deployBase = `${DeployApplicationService.PREVIEW_WWW_ROOT}/${project.slug}/pr-${preview.prNumber}-${shortId(projectId)}`;
      const releaseDir = `${deployBase}/releases/${deploymentId}`;
      const nginxSnippet = `${DeployApplicationService.PREVIEW_NGINX_DIR}/shipyard-preview-${previewId}.conf`;

      const privateKey = this.crypto.decrypt(server.privateKey);
      const envVars = await this.getDecryptedProjectBuildEnvVars(projectId);

      const isSsr = project.frameworkType === 'ssr';
      /** SSR 蓝绿：每次部署新占端口，成功后再释放旧端口 */
      let oldSsrPort: number | undefined;
      let newSsrPort: number | undefined;
      const minP = server.previewPortMin ?? 40_000;
      const maxP = server.previewPortMax ?? 41_000;

      if (isSsr) {
        let prev = preview.allocatedPort ?? undefined;
        if (prev != null) {
          const client = this.redis.getClient();
          const k = `shipyard:preview-port:${server.id}:${prev}`;
          const v = await client.get(k);
          if (v !== preview.id) prev = undefined;
        }
        oldSsrPort = prev;
        const p = await this.previewPorts.tryAllocate(server.id, preview.id, minP, maxP);
        if (p == null) throw new Error('预览端口池已满');
        newSsrPort = p;
        ssrPortRollback = { serverId: server.id, port: p, previewRowId: preview.id };
        envVars['PORT'] = String(newSsrPort);
      }

      const tmpExtractDir = path.join('/tmp', `preview-deploy-${deploymentId}`);
      mkdirSync(tmpExtractDir, { recursive: true });
      await tar.extract({ file: deployment.artifact.storagePath, cwd: tmpExtractDir });

      const sshKeyPath = path.join('/tmp', `shipyard-preview-deploy-${deploymentId}.pem`);
      await writeFile(sshKeyPath, privateKey, { encoding: 'utf8', mode: 0o600 });

      const lockKey = `deploy-lock:preview:${preview.projectId}:${preview.prNumber}`;
      await this.appendLogLine(deploymentId, '[preview-deploy] 获取预览部署锁…');
      const locked = await this.redis.acquireLock(lockKey, 900);
      if (!locked) throw new Error('该 PR 预览正在部署中');

      try {
        const conn = await this.createSshClient({
          host: server.host,
          port: server.port,
          username: server.user,
          privateKey,
        });
        try {
          await this.sshRemotePrecheck(conn, deploymentId, { needNginx: true, needPm2: isSsr });

          await this.appendLogLine(
            deploymentId,
            `[preview-deploy] rsync → ${server.user}@${server.host}:${releaseDir}`,
          );
          await this.execLocal('rsync', [
            '-avz',
            `${tmpExtractDir}/`,
            `${server.user}@${server.host}:${releaseDir}/`,
            '-e',
            `ssh -p ${server.port} -i ${sshKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`,
          ]);

          await this.sshExec(
            conn,
            `bash -lc ${this.shellSingleQuote(`mkdir -p "${deployBase}/releases" && ln -sfn "releases/${deploymentId}" "${deployBase}/current"`)}`,
          );

          const pm2Base = this.previewPm2AppName(project.slug, preview.prNumber);
          const entry = pipelineConfig.ssrEntryPoint ?? 'dist/index.js';

          if (isSsr && newSsrPort != null) {
            const activeSlot = preview.ssrBgSlot;
            const candidateSlot: 0 | 1 = activeSlot == null ? 0 : activeSlot === 0 ? 1 : 0;
            const candPm2Name = this.previewPm2BgName(pm2Base, candidateSlot);
            const oldSlotName =
              activeSlot === 0 || activeSlot === 1 ? this.previewPm2BgName(pm2Base, activeSlot as 0 | 1) : null;

            const nginxBodyNew = this.generateSsrNginxConf(previewHost, '127.0.0.1', newSsrPort);
            const nginxBodyOld =
              oldSsrPort != null ? this.generateSsrNginxConf(previewHost, '127.0.0.1', oldSsrPort) : null;

            const envStr = Object.entries(envVars)
              .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`)
              .join(',\n');
            const cwd = `${deployBase}/current`;
            const ecoPath = `${deployBase}/current/ecosystem.bg${candidateSlot}.config.js`;
            const ecosystemJs = `module.exports = {
  apps: [{
    name: ${JSON.stringify(candPm2Name)},
    script: ${JSON.stringify(entry)},
    cwd: ${JSON.stringify(cwd)},
    env: {\n${envStr}\n    }
  }]
};`;

            await this.appendLogLine(
              deploymentId,
              `[preview-deploy] candidate_up slot=${candidateSlot} pm2=${candPm2Name} port=${newSsrPort}`,
            );

            await this.sshExec(
              conn,
              `cat > ${this.shellSingleQuote(ecoPath)} << 'EOFCONFIG'\n${ecosystemJs}\nEOFCONFIG`,
            );
            const qCand = this.shellSingleQuote(candPm2Name);
            const qEco = this.shellSingleQuote(ecoPath);
            const pm2Cand = `(pm2 describe ${qCand} >/dev/null 2>&1 && pm2 delete ${qCand} || true); pm2 start ${qEco}`;
            await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(pm2Cand)}`);

            const previewHealthPath = this.normalizePreviewHealthCheckPath(
              pipelineConfig.previewHealthCheckPath,
            );
            if (previewHealthPath !== '/') {
              await this.appendLogLine(
                deploymentId,
                `[preview-deploy] 使用自定义健康路径: ${previewHealthPath}`,
              );
            }
            try {
              await this.sshPreviewSsrHealthCheck(conn, newSsrPort, deploymentId, previewHealthPath);
            } catch (hcErr) {
              await this.sshExec(
                conn,
                `bash -lc ${this.shellSingleQuote(`pm2 describe ${qCand} >/dev/null 2>&1 && pm2 delete ${qCand} || true`)}`,
              ).catch(() => undefined);
              throw hcErr;
            }

            await this.appendLogLine(deploymentId, '[preview-deploy] traffic_switch nginx → 候选端口');
            try {
              await this.sshWritePreviewNginxAtomic(conn, nginxSnippet, nginxBodyNew, deploymentId);
            } catch (nginxErr) {
              if (nginxBodyOld) {
                await this.sshWritePreviewNginxAtomic(conn, nginxSnippet, nginxBodyOld, deploymentId).catch((e) =>
                  this.logger.warn(`预览 Nginx 回滚失败: ${e}`),
                );
              }
              const qCandDel = this.shellSingleQuote(candPm2Name);
              await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(`pm2 describe ${qCandDel} >/dev/null 2>&1 && pm2 delete ${qCandDel} || true`)}`).catch(
                () => undefined,
              );
              throw nginxErr;
            }

            const qLegacy = this.shellSingleQuote(pm2Base);
            const cutoverPm2 = [
              `pm2 describe ${qLegacy} >/dev/null 2>&1 && pm2 delete ${qLegacy} || true`,
              oldSlotName
                ? `pm2 describe ${this.shellSingleQuote(oldSlotName)} >/dev/null 2>&1 && pm2 delete ${this.shellSingleQuote(oldSlotName)} || true`
                : 'true',
            ].join('; ');
            await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(cutoverPm2)}`);
            await this.appendLogLine(deploymentId, '[preview-deploy] rollback_old_instance 已摘除旧 PM2 槽位/遗留进程名');

            await this.prisma.preview.update({
              where: { id: preview.id },
              data: { allocatedPort: newSsrPort, ssrBgSlot: candidateSlot },
            });
            ssrPortRollback = null;
          } else {
            const nginxBody = this.generateStaticNginxConf(previewHost, `${deployBase}/current`);
            await this.sshWritePreviewNginxAtomic(conn, nginxSnippet, nginxBody, deploymentId);
          }
        } finally {
          conn.end();
        }

        if (isSsr && newSsrPort != null) {
          if (oldSsrPort != null && oldSsrPort !== newSsrPort) {
            await this.previewPorts.releaseIfOwned(server.id, oldSsrPort, preview.id);
          }
        }
      } finally {
        await this.redis.releaseLock(lockKey);
        await unlink(sshKeyPath).catch(() => undefined);
        rmSync(tmpExtractDir, { recursive: true, force: true });
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
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'deploy',
        'success',
        'Preview deployment succeeded',
      );
      await this.appendLogLine(deploymentId, `[preview-deploy] 预览地址: ${preview.url}`);
      await this.appendLogLine(deploymentId, '[preview-deploy] 部署成功 ✓');

      if (
        gitConn &&
        (gitConn.gitProvider === GitProvider.GITHUB ||
          gitConn.gitProvider === GitProvider.GITLAB ||
          gitConn.gitProvider === GitProvider.GITEE ||
          gitConn.gitProvider === GitProvider.GITEA)
      ) {
        const token = this.crypto.decrypt(gitConn.accessToken);
        const body = `🚀 **Shipyard Preview** deployed for **#${preview.prNumber}**.\n\n🔗 ${preview.url}`;
        const commentId = await this.gitPrComment.upsertPrPreviewComment({
          provider: gitConn.gitProvider,
          repoFullName: project.repoFullName,
          prNumber: preview.prNumber,
          accessToken: token,
          baseUrl: gitConn.baseUrl,
          body,
          existingCommentId: preview.commentId,
        });
        if (commentId) {
          await this.prisma.preview.update({
            where: { id: preview.id },
            data: { commentId },
          });
        }
      }

      void this.notifications.enqueue(
        projectId,
        NotificationEvent.DEPLOY_SUCCESS,
        `PR 预览部署成功：${deploymentId.slice(0, 8)}…`,
        { deploymentId },
      );
    } catch (err) {
      const message = this.formatDeployFailureMessage(err);
      this.logger.error(`Preview deploy failed for ${deploymentId}: ${err}`);
      if (ssrPortRollback) {
        await this.previewPorts
          .releaseIfOwned(
            ssrPortRollback.serverId,
            ssrPortRollback.port,
            ssrPortRollback.previewRowId,
          )
          .catch((e) => this.logger.warn(`SSR 预览新端口 Redis 回滚失败: ${e}`));
      }
      try {
        await this.appendLogLine(deploymentId, `[preview-deploy] [error] ${message}`);
      } catch (logErr) {
        this.logger.error(`Failed to append preview deploy log: ${logErr}`);
      }
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed', completedAt: new Date() },
      });
      void this.commitStatus.reportForDeployment(
        deploymentId,
        'deploy',
        'failure',
        'Preview deployment failed',
      );

      const pv = await this.prisma.preview.findUnique({ where: { id: previewId } });
      if (
        pv &&
        gitConn &&
        (gitConn.gitProvider === GitProvider.GITHUB ||
          gitConn.gitProvider === GitProvider.GITLAB ||
          gitConn.gitProvider === GitProvider.GITEE ||
          gitConn.gitProvider === GitProvider.GITEA)
      ) {
        const token = this.crypto.decrypt(gitConn.accessToken);
        const body = `❌ **Shipyard Preview** deploy failed for **#${pv.prNumber}**.\n\n\`\`\`\n${message}\n\`\`\``;
        const proj = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
        const commentId = await this.gitPrComment.upsertPrPreviewComment({
          provider: gitConn.gitProvider,
          repoFullName: proj.repoFullName,
          prNumber: pv.prNumber,
          accessToken: token,
          baseUrl: gitConn.baseUrl,
          body,
          existingCommentId: pv.commentId,
        });
        if (commentId) {
          await this.prisma.preview.update({ where: { id: pv.id }, data: { commentId } });
        }
      }

      void this.notifications.enqueue(
        projectId,
        NotificationEvent.DEPLOY_FAILED,
        `PR 预览部署失败：${message}`,
        { deploymentId },
      );
    }
  }

  private async getDecryptedProjectBuildEnvVars(projectId: string): Promise<Record<string, string>> {
    const vars = await this.prisma.projectBuildEnvVariable.findMany({ where: { projectId } });
    const result: Record<string, string> = {};
    for (const v of vars) {
      result[v.key] = this.crypto.decrypt(v.value);
    }
    return result;
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
    /** 多机滚动：非入口机仅同步文件 */
    skipNginx?: boolean;
    skipPm2?: boolean;
  }): Promise<{ macStaticPort?: number }> {
    const { host, port, username, privateKey, sshKeyPath } = opts;

    const conn = await this.createSshClient({ host, port, username, privateKey });
    let macNginxOut = '';

    try {
      const needNginx = !opts.skipNginx && !!opts.domain?.trim();
      const needPm2 = !opts.skipPm2 && opts.frameworkType === 'ssr';
      if (opts.serverOs === ServerOs.LINUX) {
        await this.sshRemotePrecheck(conn, opts.deploymentId, {
          needNginx,
          needPm2,
        });
      } else if (opts.serverOs === ServerOs.MACOS) {
        await this.sshRemotePrecheck(conn, opts.deploymentId, {
          needNginx: false,
          needPm2,
        });
      }

      // rsync 不会在远端递归创建缺失父目录；未预先 mkdir -p 会报 code 11 / mkdir failed。
      // /opt 等路径普通用户不可写：先 mkdir，失败则用 sudo 创建。
      // 目录已存在但曾由 root 写入子文件（如 assets、半成品 rsync）时，仅 chown 叶子不够；部署前统一 chown -R 给 SSH 用户，避免 rsync code 23。
      const qDeployDir = this.shellSingleQuote(opts.deployPath);
      await this.appendLogLine(opts.deploymentId, '[deploy] 确保远端部署目录存在…');
      const ensureDeployDirInner = [
        'set -euo pipefail',
        `if ! mkdir -p ${qDeployDir} 2>/dev/null; then`,
        `  sudo mkdir -p ${qDeployDir}`,
        `fi`,
        `sudo chown -R "$(id -u)":"$(id -g)" ${qDeployDir}`,
      ].join('\n');
      await this.sshExec(conn, `bash -lc ${this.shellSingleQuote(ensureDeployDirInner)}`);

      await this.appendLogLine(opts.deploymentId, '[deploy] 远端阶段：开始 rsync 上传…');
      await this.execLocal('rsync', [
        '-avz', '--delete',
        `${opts.localDir}/`,
        `${username}@${host}:${opts.deployPath}/`,
        '-e',
        `ssh -p ${port} -i ${sshKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`,
      ]);

      if (opts.frameworkType === 'ssr' && !opts.skipPm2) {
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
      if (opts.domain && !opts.skipNginx) {
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
          await this.sshWriteLinuxSiteNginxAtomic(conn, slug, nginxConf, opts.deploymentId);
        }
      }

      // macOS + 静态站点：无 Nginx 或未配置域名时，用 Node 脚本 + PM2 在固定端口提供站点
      let macStaticPort: number | undefined;
      if (opts.serverOs === ServerOs.MACOS && opts.frameworkType === 'static' && !opts.skipNginx) {
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

  private execLocalEnv(
    cmd: string,
    args: string[],
    extraEnv: NodeJS.ProcessEnv,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let combined = '';
      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...extraEnv },
      });
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

  /** 为常见 kubectl 错误追加可操作的排障提示（会写入部署日志） */
  private formatSpawnFailureMessage(cmd: string, code: number | null, combined: string): string {
    const tail = combined.trim().slice(-2000);
    const base = tail ? `${cmd} exited with code ${code}: ${tail}` : `${cmd} exited with code ${code}`;
    if (cmd !== 'kubectl') return base;
    const nsM = /namespaces "([^"]+)" not found/i.exec(tail);
    if (nsM?.[1]) {
      const ns = nsM[1];
      return `${base}\n提示：命名空间 "${ns}" 在集群中不存在。可执行 kubectl create namespace ${ns}，或先按仓库 deploy/k8s 执行 kubectl apply -k …（base 含 Namespace）；环境 releaseConfig.kubernetes.namespace 须与集群实际一致。`;
    }
    const depM = /deployments(?:\.apps)? "([^"]+)" not found/i.exec(tail);
    if (depM?.[1]) {
      const dep = depM[1];
      return `${base}\n提示：Deployment "${dep}" 在目标命名空间中不存在。请先按仓库 deploy/k8s 执行 kubectl apply -k base（或你的 overlay）创建 server/worker/web 等清单；并核对环境 releaseConfig.kubernetes.deploymentName、additionalDeployments 是否与集群中 metadata.name 完全一致。`;
    }
    return base;
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
        else reject(new Error(this.formatSpawnFailureMessage(cmd, code, combined)));
      });
    });
  }

  private async healthCheck(url: string, retries = 3): Promise<boolean> {
    const tlsInsecure =
      process.env['SHIPYARD_HEALTHCHECK_TLS_INSECURE'] === '1' ||
      process.env['SHIPYARD_HEALTHCHECK_TLS_INSECURE']?.toLowerCase() === 'true';

    for (let i = 0; i < retries; i++) {
      try {
        const { default: https } = await import('https');
        const { default: http } = await import('http');
        await new Promise<void>((resolve, reject) => {
          const onRes = (res: import('http').IncomingMessage) => {
            if (res.statusCode && res.statusCode < 400) resolve();
            else reject(new Error(`HTTP ${res.statusCode}`));
          };
          const req =
            url.startsWith('https') && tlsInsecure
              ? https.get(url, { rejectUnauthorized: false }, onRes)
              : url.startsWith('https')
                ? https.get(url, onRes)
                : http.get(url, onRes);
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
    const environmentId = data.environmentId;
    if (!environmentId) return;
    const { deploymentId, projectId, orgId } = data;
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
      void this.notifications.enqueue(
        projectId,
        NotificationEvent.DEPLOY_FAILED,
        '部署失败：健康检查未通过且无可用回滚产物',
        { deploymentId },
      );
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

    void this.notifications.enqueue(
      projectId,
      NotificationEvent.DEPLOY_FAILED,
      `部署失败：健康检查未通过，已排队自动回滚`,
      { deploymentId },
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
