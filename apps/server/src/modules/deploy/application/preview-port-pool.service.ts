import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

/** PR 预览 SSR 端口占用：shipyard:preview-port:{serverId}:{port} -> previewId */
@Injectable()
export class PreviewPortPoolService {
  constructor(private readonly redis: RedisService) {}

  private key(serverId: string, port: number): string {
    return `shipyard:preview-port:${serverId}:${port}`;
  }

  /**
   * 尝试占用端口；成功返回 port，失败返回 null
   */
  async tryAllocate(
    serverId: string,
    previewId: string,
    minPort: number,
    maxPort: number,
  ): Promise<number | null> {
    if (minPort > maxPort) return null;
    const span = maxPort - minPort + 1;
    const start = minPort + Math.floor(Math.random() * span);
    const client = this.redis.getClient();
    for (let i = 0; i < span; i++) {
      const port = minPort + ((start - minPort + i) % span);
      const k = this.key(serverId, port);
      const ok = await client.set(k, previewId, 'NX');
      if (ok === 'OK') return port;
    }
    return null;
  }

  /** 若该端口由该 preview 占用则释放 */
  async releaseIfOwned(serverId: string, port: number, previewId: string): Promise<void> {
    const k = this.key(serverId, port);
    const client = this.redis.getClient();
    const v = await client.get(k);
    if (v === previewId) await client.del(k);
  }

  async release(serverId: string, port: number): Promise<void> {
    await this.redis.getClient().del(this.key(serverId, port));
  }
}
