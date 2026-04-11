import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ServersModule } from './modules/servers/servers.module';
import { EnvironmentsModule } from './modules/environments/environments.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { DeployModule } from './modules/deploy/deploy.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { GatewayModule } from './common/gateway/gateway.module';
import { UsersModule } from './modules/users/users.module';
import { GitModule } from './modules/git/git.module';
import { NotificationsApiModule } from './modules/notifications/notifications-api.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    RedisModule,
    CryptoModule,
    GatewayModule,
    AuthModule,
    UsersModule,
    OrgsModule,
    ProjectsModule,
    ServersModule,
    EnvironmentsModule,
    PipelineModule,
    DeployModule,
    WebhooksModule,
    ApprovalsModule,
    GitModule,
    NotificationsApiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
