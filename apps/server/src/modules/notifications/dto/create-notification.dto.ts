import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationEvent } from '@shipyard/shared';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ type: [String], enum: NotificationEvent, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(NotificationEvent, { each: true })
  events!: NotificationEvent[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  config!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
