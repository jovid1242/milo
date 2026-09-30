import { TeamsUnavailableError } from '@/data/repositories/local/local-friends-repository';
import { ApiError } from '@/services/api/api-error';

/**
 * Why a team action did not happen, in the user's terms — every refusal the
 * server can give has its own words; nothing reaches the screen as a bare
 * "error 500".
 */
export type TeamProblem =
  | 'offline'
  | 'unavailable'
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'full'
  | 'alreadyMember'
  | 'inAnotherTeam'
  | 'notStarted'
  | 'tooManyTries'
  | 'notInTeam'
  | 'forbidden'
  | 'signedOut'
  | 'unknown';

export function teamProblemOf(error: unknown): TeamProblem {
  if (error instanceof TeamsUnavailableError) return 'unavailable';
  if (!(error instanceof ApiError)) return 'unknown';
  if (error.isConnectivity) return 'offline';
  switch (error.code) {
    case 'INVITE_INVALID':
      return 'invalid';
    case 'INVITE_EXPIRED':
      return 'expired';
    case 'INVITE_REVOKED':
      return 'revoked';
    case 'TEAM_FULL':
      return 'full';
    case 'ALREADY_MEMBER':
      return 'alreadyMember';
    case 'ALREADY_IN_TEAM':
      return 'inAnotherTeam';
    case 'CHALLENGE_NOT_STARTED':
      return 'notStarted';
    case 'RATE_LIMITED':
      return 'tooManyTries';
    case 'TEAM_NOT_FOUND':
    case 'NOT_FOUND':
      return 'notInTeam';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'UNAUTHORIZED':
    case 'REFRESH_TOKEN_INVALID':
    case 'REFRESH_TOKEN_REUSED':
      return 'signedOut';
    default:
      return 'unknown';
  }
}

export const TEAM_PROBLEMS: Record<TeamProblem, { title: string; message: string }> = {
  offline: {
    title: 'Internet connection required',
    message: 'Teams live on Milo’s server. Connect to the internet and try again.',
  },
  unavailable: {
    title: 'Teams need Milo online',
    message: 'This build runs without Milo’s online service, so teams are not available.',
  },
  invalid: {
    title: 'This invite doesn’t work',
    message: 'Check the code and try again, or ask your friend for a new invite.',
  },
  expired: {
    title: 'This invite has expired',
    message: 'Invites work for 7 days. Ask your friend for a new one.',
  },
  revoked: {
    title: 'This invite was turned off',
    message: 'Ask your friend for a new one.',
  },
  full: {
    title: 'This team is full',
    message: 'A Milo team has three people.',
  },
  alreadyMember: {
    title: 'You’re in this team already',
    message: 'Your team is on the Friends tab.',
  },
  inAnotherTeam: {
    title: 'You’re in a team already',
    message: 'To join another team, leave yours first.',
  },
  notStarted: {
    title: 'Start your challenge first',
    message: 'Teams are for a challenge that has started.',
  },
  tooManyTries: {
    title: 'Too many tries',
    message: 'Wait a minute, then try again.',
  },
  notInTeam: {
    title: 'Your team has changed',
    message: 'You’re not in this team anymore.',
  },
  forbidden: {
    title: 'Not yours to change',
    message: 'Only whoever made this invite, or the team’s owner, can turn it off.',
  },
  signedOut: {
    title: 'Sign in to continue',
    message: 'Your session has ended.',
  },
  unknown: {
    title: 'Something went wrong',
    message: 'Try again in a moment.',
  },
};
