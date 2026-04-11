import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaProjectRepository } from './infrastructure/prisma-project.repository';
import { HttpRemoteWebhookRegistrar } from './infrastructure/http-remote-webhook.registrar';
import { PROJECT_REPOSITORY } from './application/ports/project.repository.port';
import { REMOTE_WEBHOOK_REGISTRAR } from './application/ports/remote-webhook.registrar.port';

@Module({
  imports: [CryptoModule, PrismaModule],
  providers: [
    PrismaProjectRepository,
    { provide: PROJECT_REPOSITORY, useExisting: PrismaProjectRepository },
    HttpRemoteWebhookRegistrar,
    { provide: REMOTE_WEBHOOK_REGISTRAR, useExisting: HttpRemoteWebhookRegistrar },
    ProjectsService,
  ],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
