import { GoalSchema, type UserDto } from '@/schemas';

import type { User } from '../generated/prisma/client';

/** The account as the API shows it — never the password hash. */
export function toUserDto(
  user: Pick<User, 'id' | 'email' | 'displayName' | 'goal' | 'createdAt'>,
): UserDto {
  const goal = GoalSchema.safeParse(user.goal);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    goal: goal.success ? goal.data : null,
    createdAt: user.createdAt.toISOString(),
  };
}
