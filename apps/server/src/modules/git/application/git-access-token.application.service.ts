import { Injectable } from '@nestjs/common';
import type { GitAccount, GitConnection } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { GitOAuthService } from '../git-oauth.service';

@Injectable()
export class GitAccessTokenApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly oauth: GitOAuthService,
  ) {}

  /** 供构建、Webhook 注册、Commit Status 等使用 */
  async getAccessTokenForProject(projectId: string): Promise<string> {
    const conn = await this.prisma.gitConnection.findUniqueOrThrow({
      where: { projectId },
      include: { gitAccount: true },
    });
    return this.resolveFromConnection(conn);
  }

  async resolveFromConnection(
    conn: GitConnection & { gitAccount?: GitAccount | null },
  ): Promise<string> {
    const account =
      conn.gitAccount ??
      (conn.gitAccountId
        ? await this.prisma.gitAccount.findUnique({ where: { id: conn.gitAccountId } })
        : null);

    if (account?.authType === 'oauth') {
      await this.oauth.ensureFreshGitAccountToken(account.id);
      const fresh = await this.prisma.gitAccount.findUniqueOrThrow({ where: { id: account.id } });
      return this.crypto.decrypt(fresh.accessToken);
    }

    return this.crypto.decrypt(conn.accessToken);
  }
}
