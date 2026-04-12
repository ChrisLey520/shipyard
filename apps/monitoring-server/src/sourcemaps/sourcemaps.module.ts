import { Module } from '@nestjs/common';
import { SourcemapsController } from './sourcemaps.controller';

@Module({
  controllers: [SourcemapsController],
})
export class SourcemapsModule {}
