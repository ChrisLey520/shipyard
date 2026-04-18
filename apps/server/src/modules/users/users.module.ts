import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersApplicationService } from './application/users.application.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersApplicationService],
})
export class UsersModule {}

