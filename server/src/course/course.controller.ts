import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CourseManifestSchema, CourseSchema, type CourseManifest } from '@/schemas';

import { ApiErrors, ApiJsonResponse } from '../common/openapi';
import { CourseService } from './course.service';

const UNAVAILABLE: [number, string] = [503, 'COURSE_UNAVAILABLE — the course failed validation'];

/**
 * The course, in two steps so a launch never downloads it again for nothing:
 * a small manifest (version and content hash) to check every time, and the
 * document itself, fetched only when the manifest says it changed.
 */
@ApiTags('course')
@Controller()
export class CourseController {
  constructor(private readonly course: CourseService) {}

  @Get('course/current')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({
    summary: 'The current course: identity, version and content hash',
    description:
      'Small by design. Download `documentPath` only when `version` or `contentHash` differs from the cached copy.',
  })
  @ApiJsonResponse(200, 'The manifest.', CourseManifestSchema)
  @ApiErrors(UNAVAILABLE)
  current(): CourseManifest {
    return this.course.manifest();
  }

  @Get('courses/:courseId/versions/:version')
  @ApiOperation({
    summary: 'One version of the course document',
    description:
      'The whole course, validated. Served with a strong ETag (its SHA-256) and gzip when accepted.',
  })
  @ApiHeader({ name: 'If-None-Match', required: false, description: 'The ETag of a cached copy' })
  @ApiJsonResponse(200, 'The course document.', CourseSchema)
  @ApiJsonResponse(304, 'The cached copy is current.')
  @ApiErrors([404, 'No such course or version'], UNAVAILABLE)
  document(
    @Param('courseId') courseId: string,
    @Param('version') version: string,
    @Req() request: Request,
    @Res() response: Response,
  ): void {
    const published = this.course.document(courseId, version);
    response.setHeader('ETag', published.etag);
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Vary', 'Accept-Encoding');
    if (request.fresh) {
      response.status(304).end();
      return;
    }
    response.type('application/json');
    if (request.acceptsEncodings('gzip', 'identity') === 'gzip') {
      response.setHeader('Content-Encoding', 'gzip');
      response.send(published.gzip);
      return;
    }
    response.send(published.json);
  }
}
