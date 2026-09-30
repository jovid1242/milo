import { Global, Module, type DynamicModule } from '@nestjs/common';

/** What time it is — injected, so tests can move a challenge through its days. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };

/** The clock, injectable anywhere as `CLOCK`: the system clock unless a test sets one. */
@Global()
@Module({})
export class ClockModule {
  static forRoot(clock: Clock = systemClock): DynamicModule {
    return {
      module: ClockModule,
      providers: [{ provide: CLOCK, useValue: clock }],
      exports: [CLOCK],
    };
  }
}
