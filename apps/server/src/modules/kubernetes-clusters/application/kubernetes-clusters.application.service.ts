import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';

@Injectable()
export class KubernetesClustersApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async list(orgId: string) {
    return this.prisma.kubernetesCluster.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  async create(orgId: string, body: { name: string; kubeconfig: string }) {
    const name = body.name?.trim() ?? '';
    if (!name || name.length > 128) throw new BadRequestException('集群名称须为 1–128 字符');
    const kube = body.kubeconfig?.trim() ?? '';
    if (!kube) throw new BadRequestException('kubeconfig 不能为空');
    const dup = await this.prisma.kubernetesCluster.findFirst({
      where: { organizationId: orgId, name },
    });
    if (dup) throw new ConflictException('同名集群已存在');
    const kubeconfigEncrypted = this.crypto.encrypt(kube);
    return this.prisma.kubernetesCluster.create({
      data: { organizationId: orgId, name, kubeconfigEncrypted },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  async delete(orgId: string, clusterId: string) {
    const row = await this.prisma.kubernetesCluster.findFirst({
      where: { id: clusterId, organizationId: orgId },
    });
    if (!row) throw new NotFoundException('集群不存在');
    await this.prisma.kubernetesCluster.delete({ where: { id: clusterId } });
  }

  /** Deploy Worker：取解密 kubeconfig */
  async getDecryptedKubeconfig(orgId: string, clusterId: string): Promise<string> {
    const row = await this.prisma.kubernetesCluster.findFirst({
      where: { id: clusterId, organizationId: orgId },
    });
    if (!row) throw new NotFoundException('集群不存在');
    return this.crypto.decrypt(row.kubeconfigEncrypted);
  }
}
