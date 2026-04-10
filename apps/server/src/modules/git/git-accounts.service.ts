import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { GitService } from './git.service';

@Injectable()
export class GitAccountsService {
  private readonly logger = new Logger(GitAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly git: GitService,
  ) {}

  async list(orgId: string) {
    return this.prisma.gitAccount.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        gitProvider: true,
        baseUrl: true,
        gitUsername: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(
    orgId: string,
    data: { name: string; gitProvider: string; baseUrl?: string; accessToken: string; gitUsername?: string },
  ) {
    const existing = await this.prisma.gitAccount.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: data.name } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Git 账户名称已存在');

    const encryptedToken = this.crypto.encrypt(data.accessToken);
    return this.prisma.gitAccount.create({
      data: {
        organizationId: orgId,
        name: data.name,
        gitProvider: data.gitProvider,
        baseUrl: data.baseUrl ?? null,
        accessToken: encryptedToken,
        gitUsername: data.gitUsername ?? null,
      },
      select: {
        id: true,
        name: true,
        gitProvider: true,
        baseUrl: true,
        gitUsername: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getById(orgId: string, gitAccountId: string) {
    const account = await this.prisma.gitAccount.findFirst({
      where: { id: gitAccountId, organizationId: orgId },
    });
    if (!account) throw new NotFoundException('Git 账户不存在');
    return account;
  }

  async listRepos(orgId: string, gitAccountId: string) {
    const account = await this.getById(orgId, gitAccountId);
    const pat = this.crypto.decrypt(account.accessToken);

    switch (account.gitProvider) {
      case 'github':
        return this.git.listGithubReposByPat(pat);
      case 'gitlab':
        return this.git.listGitlabReposByPat(pat, account.baseUrl ?? undefined);
      case 'gitee':
        return this.git.listGiteeReposByPat(pat);
      case 'gitea':
        if (!account.baseUrl) throw new Error('Gitea Base URL 未配置');
        return this.git.listGiteaReposByPat(pat, account.baseUrl);
      default:
        this.logger.warn(`Unsupported provider: ${account.gitProvider}`);
        return [];
    }
  }

  async update(
    orgId: string,
    gitAccountId: string,
    data: {
      name?: string;
      baseUrl?: string | null;
      accessToken?: string;
      gitUsername?: string | null;
    },
  ) {
    const existing = await this.getById(orgId, gitAccountId);

    if (data.name && data.name !== existing.name) {
      const nameTaken = await this.prisma.gitAccount.findUnique({
        where: { organizationId_name: { organizationId: orgId, name: data.name } },
        select: { id: true },
      });
      if (nameTaken) throw new ConflictException('Git 账户名称已存在');
    }

    return this.prisma.gitAccount.update({
      where: { id: gitAccountId },
      data: {
        name: data.name ?? undefined,
        baseUrl: data.baseUrl === undefined ? undefined : data.baseUrl,
        gitUsername: data.gitUsername === undefined ? undefined : data.gitUsername,
        accessToken: data.accessToken ? this.crypto.encrypt(data.accessToken) : undefined,
      },
      select: {
        id: true,
        name: true,
        gitProvider: true,
        baseUrl: true,
        gitUsername: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(orgId: string, gitAccountId: string) {
    await this.getById(orgId, gitAccountId);
    await this.prisma.gitAccount.delete({ where: { id: gitAccountId } });
    return { success: true };
  }
}

