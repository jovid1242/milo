import {
  InvitePreviewResponseSchema,
  MyTeamResponseSchema,
  TeamInviteResponseSchema,
  type InviteCode,
  type InvitePreview,
  type MyTeamResponse,
  type TeamInvite,
} from '@/schemas';
import type { ApiClient } from '@/services/api/api-client';

/** Teams on the Milo API. Every call is signed in; the code travels in the body. */
export interface TeamApi {
  myTeam(): Promise<MyTeamResponse>;
  create(): Promise<MyTeamResponse>;
  invite(teamId: string): Promise<TeamInvite>;
  revokeInvite(inviteId: string): Promise<void>;
  preview(code: InviteCode): Promise<InvitePreview>;
  join(code: InviteCode): Promise<MyTeamResponse>;
  leave(teamId: string): Promise<void>;
}

export class HttpTeamApi implements TeamApi {
  constructor(private readonly client: ApiClient) {}

  myTeam(): Promise<MyTeamResponse> {
    return this.client.request({ path: '/teams/me', schema: MyTeamResponseSchema, auth: true });
  }

  create(): Promise<MyTeamResponse> {
    return this.client.request({
      method: 'POST',
      path: '/teams',
      schema: MyTeamResponseSchema,
      auth: true,
    });
  }

  async invite(teamId: string): Promise<TeamInvite> {
    const response = await this.client.request({
      method: 'POST',
      path: `/teams/${encodeURIComponent(teamId)}/invites`,
      schema: TeamInviteResponseSchema,
      auth: true,
    });
    return response.invite;
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this.client.request({
      method: 'DELETE',
      path: `/team-invites/${encodeURIComponent(inviteId)}`,
      auth: true,
    });
  }

  async preview(code: InviteCode): Promise<InvitePreview> {
    const response = await this.client.request({
      method: 'POST',
      path: '/team-invites/preview',
      body: { code },
      schema: InvitePreviewResponseSchema,
      auth: true,
    });
    return response.preview;
  }

  join(code: InviteCode): Promise<MyTeamResponse> {
    return this.client.request({
      method: 'POST',
      path: '/team-invites/join',
      body: { code },
      schema: MyTeamResponseSchema,
      auth: true,
    });
  }

  async leave(teamId: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      path: `/teams/${encodeURIComponent(teamId)}/leave`,
      auth: true,
    });
  }
}
