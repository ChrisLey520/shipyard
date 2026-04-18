import { Module } from '@nestjs/common';
import { SymbolicateModule } from '../symbolicate/symbolicate.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [SymbolicateModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
