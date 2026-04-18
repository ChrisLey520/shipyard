import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { RedisService } from '../../../common/redis/redis.service';
import {
  DEFAULT_GITLAB_BASE_URL,
  GitProvider,
  isGitProviderString,
  stripTrailingSlashes,
} from '@shipyard/shared';
import {
  GITEA_OAUTH_PATHS,
  GITLAB_OAUTH_PATHS,
  GIT_OAUTH_FIXED,
  giteeApiV5UserUrl,
  withNormalizedGitBase,
} from '../git-oauth-urls';

interface OAuthStatePayload {
  orgId: string;
  userId: string;
  provider: GitProvider;
  codeVerifier?: string;
  gitlabHost?: string;
  giteaHost?: string;
}

@Injectable()
export class GitOAuthApplicationService {
  private readonly logger = new Logger(GitOAuthApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
  ) {}

  private stateKey(token: string): string {
    return `git-oauth-state:${token}`;
  }

  private appUrl(): string {
    return stripTrailingSlashes(process.env['APP_URL'] ?? 'http://localhost:5173');
  }

  private redirectBase(): string {
    const pub = process.env['SERVER_PUBLIC_URL']?.trim();
    if (pub) return stripTrailingSlashes(pub);
    return stripTrailingSlashes(
      process.env['API_PUBLIC_URL'] ?? `http://localhost:${process.env['PORT'] ?? '3000'}`,
    );
  }

  async buildAuthorizeUrl(orgId: string, userId: string, provider: string): Promise<string> {
    if (!isGitProviderString(provider)) {
      throw new BadRequestException('不支持的 OAuth 提供方');
    }
    const p = provider;

    const stateToken = randomBytes(24).toString('hex');
    const payload: OAuthStatePayload = { orgId, userId, provider: p };
    await this.redis.set(this.stateKey(stateToken), JSON.stringify(payload), 600);

    const redirectUri = `${this.redirectBase()}/api/git/oauth/${p}/callback`;

    if (p === GitProvider.GITHUB) {
      const clientId = process.env['GIT_OAUTH_GITHUB_CLIENT_ID']?.trim();
      if (!clientId) throw new ServiceUnavailableException('未配置 GIT_OAUTH_GITHUB_CLIENT_ID');
      const scope = encodeURIComponent('repo repo:status read:user');
      return `${GIT_OAUTH_FIXED.github.authorize}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(stateToken)}`;
    }

    if (p === GitProvider.GITLAB) {
      const clientId = process.env['GIT_OAUTH_GITLAB_CLIENT_ID']?.trim();
      if (!clientId) throw new ServiceUnavailableException('未配置 GIT_OAUTH_GITLAB_CLIENT_ID');
      const host = stripTrailingSlashes(
        process.env['GIT_OAUTH_GITLAB_HOST'] ?? DEFAULT_GITLAB_BASE_URL,
      );
      payload.gitlabHost = host;
      await this.redis.set(this.stateKey(stateToken), JSON.stringify(payload), 600);
      const scope = encodeURIComponent('api read_repository write_repository');
      return `${withNormalizedGitBase(host, GITLAB_OAUTH_PATHS.authorize)}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(stateToken)}&scope=${scope}`;
    }

    if (p === GitProvider.GITEE) {
      const clientId = process.env['GIT_OAUTH_GITEE_CLIENT_ID']?.trim();
      if (!clientId) throw new ServiceUnavailableException('未配置 GIT_OAUTH_GITEE_CLIENT_ID');
      const scope = encodeURIComponent('user_info projects hook');
      return `${GIT_OAUTH_FIXED.gitee.authorize}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(stateToken)}&scope=${scope}`;
    }

    const giteaHostRaw = process.env['GIT_OAUTH_GITEA_HOST']?.trim();
    const giteaHost = giteaHostRaw ? stripTrailingSlashes(giteaHostRaw) : '';
    const clientId = process.env['GIT_OAUTH_GITEA_CLIENT_ID']?.trim();
    if (!giteaHost || !clientId) {
      throw new ServiceUnavailableException('未配置 GIT_OAUTH_GITEA_HOST / GIT_OAUTH_GITEA_CLIENT_ID');
    }
    payload.giteaHost = giteaHost;
    await this.redis.set(this.stateKey(stateToken), JSON.stringify(payload), 600);
    const scope = encodeURIComponent('read_repository write_repository');
    return `${withNormalizedGitBase(giteaHost, GITEA_OAUTH_PATHS.authorize)}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(stateToken)}&scope=${scope}`;
  }

  async completeCallback(provider: string, code: string | undefined, state: string | undefined): Promise<string> {
    const base = `${this.appUrl()}`;
    const fail = (reason: string) => `${base}/?oauthError=${encodeURIComponent(reason)}`;

    if (!code || !state) return fail('missing_code_or_state');

    const raw = await this.redis.get(this.stateKey(state));
    await this.redis.del(this.stateKey(state));
    if (!raw) return fail('invalid_state');

    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(raw) as OAuthStatePayload;
    } catch {
      return fail('invalid_state');
    }

    if (payload.provider !== provider) return fail('provider_mismatch');

    const org = await this.prisma.organization.findUnique({ where: { id: payload.orgId } });
    if (!org) return fail('org_not_found');

    try {
      await this.exchangeAndPersistAccount(payload, code);
    } catch (e) {
      this.logger.warn(`OAuth callback failed: ${e}`);
      return fail('token_exchange_failed');
    }

    return `${base}/orgs/${org.slug}/git-accounts?oauth=success`;
  }

  private async exchangeAndPersistAccount(payload: OAuthStatePayload, code: string): Promise<void> {
    const redirectUri = `${this.redirectBase()}/api/git/oauth/${payload.provider}/callback`;

    if (payload.provider === GitProvider.GITHUB) {
      const clientId = process.env['GIT_OAUTH_GITHUB_CLIENT_ID']?.trim();
      const clientSecret = process.env['GIT_OAUTH_GITHUB_CLIENT_SECRET']?.trim();
      if (!clientId || !clientSecret) throw new Error('missing github oauth secret');

      const res = await fetch(GIT_OAUTH_FIXED.github.accessToken, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });
      const tok = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };
      if (!tok.access_token) throw new Error(tok.error ?? 'no access_token');

      const userRes = await fetch(GIT_OAUTH_FIXED.github.apiUser, {
        headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/vnd.github+json' },
      });
      const u = (await userRes.json()) as { login?: string; id?: number };
      const login = u.login ?? 'github-user';
      const providerAccountId = String(u.id ?? login);

      await this.upsertOAuthAccount({
        orgId: payload.orgId,
        provider: GitProvider.GITHUB,
        name: login,
        baseUrl: null,
        gitUsername: login,
        providerAccountId,
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token ?? null,
        expiresInSec: tok.expires_in,
      });
      return;
    }

    if (payload.provider === GitProvider.GITLAB) {
      const clientId = process.env['GIT_OAUTH_GITLAB_CLIENT_ID']?.trim();
      const clientSecret = process.env['GIT_OAUTH_GITLAB_CLIENT_SECRET']?.trim();
      if (!clientId || !clientSecret) throw new Error('missing gitlab oauth secret');
      const host = payload.gitlabHost ?? DEFAULT_GITLAB_BASE_URL;

      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });
      const res = await fetch(withNormalizedGitBase(host, GITLAB_OAUTH_PATHS.token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const tok = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };
      if (!tok.access_token) throw new Error(tok.error ?? 'no access_token');

      const userRes = await fetch(withNormalizedGitBase(host, GITLAB_OAUTH_PATHS.apiV4User), {
        headers: { 'PRIVATE-TOKEN': tok.access_token },
      });
      const u = (await userRes.json()) as { username?: string; id?: number };
      const login = u.username ?? 'gitlab-user';
      const providerAccountId = String(u.id ?? login);

      await this.upsertOAuthAccount({
        orgId: payload.orgId,
        provider: GitProvider.GITLAB,
        name: login,
        baseUrl: host,
        gitUsername: login,
        providerAccountId,
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token ?? null,
        expiresInSec: tok.expires_in,
      });
      return;
    }

    if (payload.provider === GitProvider.GITEE) {
      const clientId = process.env['GIT_OAUTH_GITEE_CLIENT_ID']?.trim();
      const clientSecret = process.env['GIT_OAUTH_GITEE_CLIENT_SECRET']?.trim();
      if (!clientId || !clientSecret) throw new Error('missing gitee oauth secret');

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      });
      const res = await fetch(GIT_OAUTH_FIXED.gitee.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      });
      const tok = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };
      if (!tok.access_token) throw new Error(tok.error ?? 'no access_token');

      const userRes = await fetch(giteeApiV5UserUrl(tok.access_token));
      const u = (await userRes.json()) as { login?: string; id?: number };
      const login = u.login ?? 'gitee-user';
      const providerAccountId = String(u.id ?? login);

      await this.upsertOAuthAccount({
        orgId: payload.orgId,
        provider: GitProvider.GITEE,
        name: login,
        baseUrl: null,
        gitUsername: login,
        providerAccountId,
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token ?? null,
        expiresInSec: tok.expires_in,
      });
      return;
    }

    if (payload.provider === GitProvider.GITEA) {
      const clientId = process.env['GIT_OAUTH_GITEA_CLIENT_ID']?.trim();
      const clientSecret = process.env['GIT_OAUTH_GITEA_CLIENT_SECRET']?.trim();
      const host = payload.giteaHost;
      if (!clientId || !clientSecret || !host) throw new Error('missing gitea oauth config');

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      });
      const res = await fetch(withNormalizedGitBase(host, GITEA_OAUTH_PATHS.accessToken), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      });
      const tok = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };
      if (!tok.access_token) throw new Error(tok.error ?? 'no access_token');

      const userRes = await fetch(withNormalizedGitBase(host, GITEA_OAUTH_PATHS.apiV1User), {
        headers: { Authorization: `token ${tok.access_token}` },
      });
      const u = (await userRes.json()) as { login?: string; id?: number };
      const login = u.login ?? 'gitea-user';
      const providerAccountId = String(u.id ?? login);

      await this.upsertOAuthAccount({
        orgId: payload.orgId,
        provider: GitProvider.GITEA,
        name: login,
        baseUrl: host,
        gitUsername: login,
        providerAccountId,
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token ?? null,
        expiresInSec: tok.expires_in,
      });
      return;
    }

    throw new Error('unsupported_oauth_provider');
  }

  private async upsertOAuthAccount(opts: {
    orgId: string;
    provider: string;
    name: string;
    baseUrl: string | null;
    gitUsername: string;
    providerAccountId: string;
    accessToken: string;
    refreshToken: string | null;
    expiresInSec?: number;
  }): Promise<void> {
    const encAccess = this.crypto.encrypt(opts.accessToken);
    const encRefresh = opts.refreshToken ? this.crypto.encrypt(opts.refreshToken) : null;
    const expiresAt =
      opts.expiresInSec != null && opts.expiresInSec > 0
        ? new Date(Date.now() + opts.expiresInSec * 1000)
        : null;

    const existing = await this.prisma.gitAccount.findFirst({
      where: {
        organizationId: opts.orgId,
        gitProvider: opts.provider,
        providerAccountId: opts.providerAccountId,
      },
    });

    if (existing) {
      await this.prisma.gitAccount.update({
        where: { id: existing.id },
        data: {
          authType: 'oauth',
          accessToken: encAccess,
          refreshToken: encRefresh,
          tokenExpiresAt: expiresAt,
          gitUsername: opts.gitUsername,
          baseUrl: opts.baseUrl ?? undefined,
        },
      });
      return;
    }

    let name = opts.name;
    for (let i = 0; i < 5; i++) {
      const taken = await this.prisma.gitAccount.findUnique({
        where: { organizationId_name: { organizationId: opts.orgId, name } },
      });
      if (!taken) break;
      name = `${opts.name}-oauth${i + 1}`;
    }

    await this.prisma.gitAccount.create({
      data: {
        organizationId: opts.orgId,
        name,
        gitProvider: opts.provider,
        baseUrl: opts.baseUrl,
        accessToken: encAccess,
        gitUsername: opts.gitUsername,
        authType: 'oauth',
        refreshToken: encRefresh,
        tokenExpiresAt: expiresAt,
        providerAccountId: opts.providerAccountId,
      },
    });
  }

  async ensureFreshGitAccountToken(accountId: string): Promise<void> {
    const acc = await this.prisma.gitAccount.findUnique({ where: { id: accountId } });
    if (!acc || acc.authType !== 'oauth') return;

    const soon = new Date(Date.now() + 120_000);
    if (!acc.tokenExpiresAt || acc.tokenExpiresAt > soon) return;
    if (!acc.refreshToken) return;

    const refreshPlain = this.crypto.decrypt(acc.refreshToken);

    if (acc.gitProvider === GitProvider.GITHUB) {
      const clientId = process.env['GIT_OAUTH_GITHUB_CLIENT_ID']?.trim();
      const clientSecret = process.env['GIT_OAUTH_GITHUB_CLIENT_SECRET']?.trim();
      if (!clientId || !clientSecret) return;

      const res = await fetch(GIT_OAUTH_FIXED.github.accessToken, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshPlain,
        }),
      });
      const tok = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };
      if (!tok.access_token) {
        this.logger.warn(`GitHub token refresh failed: ${tok.error}`);
        return;
      }
      await this.prisma.gitAccount.update({
        where: { id: acc.id },
        data: {
          accessToken: this.crypto.encrypt(tok.access_token),
          refreshToken: tok.refresh_token ? this.crypto.encrypt(tok.refresh_token) : acc.refreshToken,
          tokenExpiresAt:
            tok.expires_in != null && tok.expires_in > 0
              ? new Date(Date.now() + tok.expires_in * 1000)
              : acc.tokenExpiresAt,
        },
      });
      return;
    }

    if (acc.gitProvider === GitProvider.GITLAB) {
      const clientId = process.env['GIT_OAUTH_GITLAB_CLIENT_ID']?.trim();
      const clientSecret = process.env['GIT_OAUTH_GITLAB_CLIENT_SECRET']?.trim();
      const host = (acc.baseUrl ? stripTrailingSlashes(acc.baseUrl) : '') || DEFAULT_GITLAB_BASE_URL;
      if (!clientId || !clientSecret) return;

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshPlain,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const res = await fetch(withNormalizedGitBase(host, GITLAB_OAUTH_PATHS.token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const tok = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };
      if (!tok.access_token) {
        this.logger.warn(`GitLab token refresh failed: ${tok.error}`);
        return;
      }
      await this.prisma.gitAccount.update({
        where: { id: acc.id },
        data: {
          accessToken: this.crypto.encrypt(tok.access_token),
          refreshToken: tok.refresh_token ? this.crypto.encrypt(tok.refresh_token) : acc.refreshToken,
          tokenExpiresAt:
            tok.expires_in != null && tok.expires_in > 0
              ? new Date(Date.now() + tok.expires_in * 1000)
              : acc.tokenExpiresAt,
        },
      });
    }
  }
}
