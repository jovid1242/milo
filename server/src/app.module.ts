import { Module, type DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';

import { AuthModule } from './auth/auth.module';
import { loggerParams } from './common/logging';
import { ConfigModule } from './config/config.module';
import type { AppConfig } from './config/env';
import { CourseModule } from './course/course.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

export type AppOptions = {
  /** A course document to publish instead of the bundled one (tests). */
  course?: unknown;
  /** Where log lines go instead of standard output (tests). */
  logDestination?: DestinationStream;
};

@Module({})
export class AppModule {
  static forRoot(config: AppConfig, options: AppOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        LoggerModule.forRoot(loggerParams(config, options.logDestination)),
        PrismaModule,
        AuthModule,
        UsersModule,
        CourseModule.forRoot(options.course),
      ],
      controllers: [HealthController],
    };
  }
}
