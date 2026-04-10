import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('healthz')
  healthz() {
    return {
      ok: true,
      // 这里用 ISO 字符串方便日志/探针排查
      time: new Date().toISOString(),
    };
  }
}

