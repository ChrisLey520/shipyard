import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';

interface SubscribeLogsPayload {
  deploymentId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialized');
    try {
      // 订阅所有 log-stream 频道，转发给对应房间
      const sub = this.redisService.getSubscriber();
      sub.psubscribe('log-stream:*');
      sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
        const deploymentId = channel.replace('log-stream:', '');
        this.server.to(`deployment:${deploymentId}`).emit('log:line', JSON.parse(message));
      });
    } catch (err) {
      // 避免 Redis 注入/连接异常导致服务崩溃（WebSocket 日志订阅降级）
      this.logger.warn(`Redis log subscription disabled: ${String(err)}`);
    }
  }

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as Record<string, string>)['token'] ??
      client.handshake.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      this.jwtService.verify(token);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:logs')
  handleSubscribeLogs(
    @MessageBody() payload: SubscribeLogsPayload,
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(`deployment:${payload.deploymentId}`);
    return { event: 'subscribed', data: { deploymentId: payload.deploymentId } };
  }

  @SubscribeMessage('unsubscribe:logs')
  handleUnsubscribeLogs(
    @MessageBody() payload: SubscribeLogsPayload,
    @ConnectedSocket() client: Socket,
  ) {
    void client.leave(`deployment:${payload.deploymentId}`);
  }

  /**
   * 广播部署状态变更
   */
  emitDeploymentUpdate(orgId: string, deploymentId: string, status: string) {
    this.server.to(`org:${orgId}`).emit('deployment:update', { deploymentId, status });
  }

  /**
   * 推送审批通知
   */
  emitApprovalRequired(orgId: string, approvalRequestId: string, deploymentId: string) {
    this.server.to(`org:${orgId}`).emit('approval:required', { approvalRequestId, deploymentId });
  }
}
