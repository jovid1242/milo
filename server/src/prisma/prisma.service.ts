import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { APP_CONFIG, type AppConfig } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

/** The database client (Prisma 7 over the `pg` driver adapter), one per process. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Readiness: can the database answer right now? */
  async isReachable(timeoutMs = 1_000): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    const probe = this.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    try {
      return await Promise.race([probe, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
