import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import { parseReleaseConfig, type ReleaseConfig } from '../domain/release-config.schema';

/** 校验 releaseConfig 并与组织资源（集群、服务器）对齐 */
export async function validateAndNormalizeReleaseConfig(
  prisma: PrismaService,
  orgId: string,
  raw: unknown,
): Promise<ReleaseConfig | null | undefined> {
  if (raw === undefined) return undefined;
  if (raw === null) return null;

  let cfg: ReleaseConfig;
  try {
    cfg = parseReleaseConfig(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new BadRequestException(`releaseConfig 无效: ${msg}`);
  }

  if (cfg.executor === 'kubernetes') {
    const k = cfg.kubernetes;
    if (!k?.namespace || !k.deploymentName || !k.clusterId) {
      throw new BadRequestException('Kubernetes 执行器须填写 kubernetes.namespace、deploymentName、clusterId');
    }
    if (!k.containerName?.trim()) {
      throw new BadRequestException(
        'Kubernetes 执行器须填写 kubernetes.containerName（须与 Deployment 模板中容器名一致，例如 shipyard-server → server）',
      );
    }
    const cluster = await prisma.kubernetesCluster.findFirst({
      where: { id: k.clusterId, organizationId: orgId },
    });
    if (!cluster) throw new BadRequestException('Kubernetes 集群不存在或不属于当前组织');
  }

  if (cfg.executor === 'object_storage') {
    const os = cfg.objectStorage;
    if (!os?.bucket?.trim() || os.provider !== 's3') {
      throw new BadRequestException('object_storage 执行器须配置 objectStorage.provider=s3 与 bucket');
    }
  }

  const ssh = cfg.ssh;
  if (ssh?.targets?.length) {
    const ids = [...new Set(ssh.targets.map((t) => t.serverId))];
    const n = await prisma.server.count({ where: { organizationId: orgId, id: { in: ids } } });
    if (n !== ids.length) throw new BadRequestException('releaseConfig.ssh.targets 含有无效或不属于当前组织的服务器');
  }
  if (ssh?.primaryServerId) {
    const s = await prisma.server.findFirst({
      where: { id: ssh.primaryServerId, organizationId: orgId },
    });
    if (!s) throw new BadRequestException('primaryServerId 无效或不属于当前组织');
  }

  return cfg;
}
