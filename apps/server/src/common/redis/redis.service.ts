import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly subscriber: Redis;

  constructor() {
    const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    // BullMQ Worker/Queue 要求阻塞连接使用 maxRetriesPerRequest: null
    const opts = { maxRetriesPerRequest: null } as const;
    this.client = new Redis(redisUrl, opts);
    this.subscriber = new Redis(redisUrl, opts);
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * 分布式锁（SET NX）
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * 检查幂等键是否存在（Webhook 去重）
   */
  async checkAndSetIdempotency(key: string, ttlSeconds = 86400): Promise<boolean> {
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * 追加日志到 Redis List
   */
  async appendLog(deploymentId: string, line: string): Promise<void> {
    await this.client.rpush(`log:${deploymentId}`, line);
  }

  /**
   * 获取日志列表
   */
  async getLogs(deploymentId: string): Promise<string[]> {
    return this.client.lrange(`log:${deploymentId}`, 0, -1);
  }

  /**
   * 发布日志行到 Pub/Sub
   */
  async publishLog(deploymentId: string, payload: object): Promise<void> {
    await this.client.publish(`log-stream:${deploymentId}`, JSON.stringify(payload));
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.subscriber.quit();
  }
}
