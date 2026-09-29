import { Injectable } from '@nestjs/common';

import type { UpdateProfileRequest, UserDto } from '@/schemas';

import { unauthorized } from '../common/api-exception';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto } from './user-dto';

const isMissing = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    // A valid token for an account that no longer exists: sign in again.
    if (!user) throw unauthorized();
    return toUserDto(user);
  }

  /** Only the profile fields the schema allows; `undefined` leaves a field as it is. */
  async updateMe(userId: string, update: UpdateProfileRequest): Promise<UserDto> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { displayName: update.displayName, goal: update.goal },
      });
      return toUserDto(user);
    } catch (error) {
      if (isMissing(error)) throw unauthorized();
      throw error;
    }
  }
}
