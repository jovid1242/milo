import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CourseService } from '../course/course.service';
import { PrismaService } from '../prisma/prisma.service';

type Check = 'up' | 'down';

/**
 * For whoever runs the API, outside `/api/v1`. `/health` answers while the
 * process is alive and says whether the database is; `/ready` is 503 until
 * everything a request needs is there.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly course: CourseService,
  ) {}

  @Get('health')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness, with the database status' })
  @ApiResponse({
    status: 200,
    description: '`{ status: "ok", database: "up" | "down", uptimeSeconds }`',
  })
  async health() {
    const database: Check = (await this.prisma.isReachable()) ? 'up' : 'down';
    return { status: 'ok', database, uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: database reachable and course valid' })
  @ApiResponse({ status: 200, description: '`{ status: "ready", checks }`' })
  @ApiResponse({ status: 503, description: '`{ status: "not_ready", checks }`' })
  async ready(@Res({ passthrough: true }) response: Response) {
    const checks: Record<'database' | 'course', Check> = {
      database: (await this.prisma.isReachable()) ? 'up' : 'down',
      course: this.course.available ? 'up' : 'down',
    };
    const ready = Object.values(checks).every((check) => check === 'up');
    response.status(ready ? 200 : 503);
    return { status: ready ? 'ready' : 'not_ready', checks };
  }
}
