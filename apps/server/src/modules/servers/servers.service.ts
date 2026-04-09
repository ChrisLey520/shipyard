import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { Client as SshClient } from 'ssh2';

@Injectable()
export class ServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async createServer(
    orgId: string,
    data: { name: string; host: string; port: number; user: string; privateKey: string },
  ) {
    const encryptedKey = this.crypto.encrypt(data.privateKey);
    return this.prisma.server.create({
      data: {
        organizationId: orgId,
        name: data.name,
        host: data.host,
        port: data.port,
        user: data.user,
        privateKey: encryptedKey,
      },
      select: { id: true, name: true, host: true, port: true, user: true, createdAt: true },
    });
  }

  async listServers(orgId: string) {
    return this.prisma.server.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, host: true, port: true, user: true, createdAt: true },
    });
  }

  async deleteServer(orgId: string, serverId: string) {
    await this.getServer(orgId, serverId);
    await this.prisma.server.delete({ where: { id: serverId } });
  }

  async testConnection(orgId: string, serverId: string): Promise<{ success: boolean; message: string }> {
    const server = await this.getServer(orgId, serverId);
    const privateKey = this.crypto.decrypt(server.privateKey);

    return new Promise((resolve) => {
      const conn = new SshClient();
      const timeout = setTimeout(() => {
        conn.end();
        resolve({ success: false, message: '连接超时（10s）' });
      }, 10_000);

      conn
        .on('ready', () => {
          clearTimeout(timeout);
          conn.end();
          resolve({ success: true, message: '连接成功' });
        })
        .on('error', (err: Error) => {
          clearTimeout(timeout);
          resolve({ success: false, message: err.message });
        })
        .connect({
          host: server.host,
          port: server.port,
          username: server.user,
          privateKey,
        });
    });
  }

  async getServer(orgId: string, serverId: string) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId: orgId },
    });
    if (!server) throw new NotFoundException('服务器不存在');
    return server;
  }

  /**
   * 解密 SSH 私钥（供 Worker 内部使用）
   */
  decryptPrivateKey(encryptedKey: string): string {
    return this.crypto.decrypt(encryptedKey);
  }
}
