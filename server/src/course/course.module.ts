import { Module, type DynamicModule } from '@nestjs/common';

import { LOCAL_COURSE } from '@/content/course';

import { CourseController } from './course.controller';
import { COURSE_SOURCE, CourseService } from './course.service';

@Module({})
export class CourseModule {
  /**
   * `source` is for tests: any document, validated the same way. Global: the
   * published course is also what progress is checked against.
   */
  static forRoot(source: unknown = LOCAL_COURSE): DynamicModule {
    return {
      module: CourseModule,
      global: true,
      controllers: [CourseController],
      providers: [{ provide: COURSE_SOURCE, useValue: source }, CourseService],
      exports: [CourseService],
    };
  }
}
