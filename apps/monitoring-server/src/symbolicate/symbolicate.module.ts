import { Module } from '@nestjs/common';
import { SymbolicateService } from './symbolicate.service';

@Module({
  providers: [SymbolicateService],
  exports: [SymbolicateService],
})
export class SymbolicateModule {}
