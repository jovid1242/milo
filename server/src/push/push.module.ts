import { Module, type DynamicModule } from '@nestjs/common';

import { AuthTokensModule } from '../auth/auth-tokens.module';
import { APP_CONFIG, type AppConfig } from '../config/env';
import {
  ExpoHttpTransport,
  PUSH_TRANSPORT,
  refusingTransport,
  type PushTransport,
} from './expo-push.transport';
import { PushController } from './push.controller';
import { PushDevices } from './push-devices.service';
import { PushWorker } from './push-worker';
import { TeamNews } from './team-news';

/**
 * Team notifications: the devices that want them, the news queued with the
 * changes it is about (`TeamNews`, used by progress and teams inside their
 * transactions), and the worker that sends it through Expo. Global, like the
 * clock: the modules that report news need no import of their own.
 */
@Module({})
export class PushModule {
  static forRoot(transport?: PushTransport): DynamicModule {
    return {
      module: PushModule,
      global: true,
      imports: [AuthTokensModule],
      controllers: [PushController],
      providers: [
        PushDevices,
        TeamNews,
        PushWorker,
        {
          provide: PUSH_TRANSPORT,
          inject: [APP_CONFIG],
          useFactory: (config: AppConfig): PushTransport =>
            transport ??
            (config.env === 'test'
              ? refusingTransport
              : new ExpoHttpTransport(config.push.expoAccessToken)),
        },
      ],
      exports: [TeamNews, PushWorker],
    };
  }
}
