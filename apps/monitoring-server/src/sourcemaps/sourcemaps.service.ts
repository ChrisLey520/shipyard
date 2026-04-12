import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

function sourcemapRoot(): string {
  return process.env['MONITORING_SOURCEMAP_ROOT']?.trim() || join(process.cwd(), 'data', 'sourcemaps');
}

function sanitizeRelease(release: string): string {
  const s = release.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
  if (!s) throw new BadRequestException('Invalid release');
  return s;
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/^.*[/\\]/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.endsWith('.map') ? base : `${base}.map`;
}

@Injectable()
export class SourcemapsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(params: {
    authorization: string | undefined;
    release: string;
    buffer: Buffer;
    originalName: string;
  }): Promise<{ ok: boolean; path: string }> {
    const token = extractBearer(params.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const project = await this.prisma.monitoringProject.findFirst({
      where: { ingestToken: token },
    });
    if (!project) {
      throw new UnauthorizedException('Invalid token');
    }

    const maxBytes = Math.min(
      10 * 1024 * 1024,
      parseInt(process.env['MONITORING_SOURCEMAP_MAX_BYTES'] ?? `${5 * 1024 * 1024}`, 10) || 5 * 1024 * 1024,
    );
    if (params.buffer.length > maxBytes) {
      throw new BadRequestException(`File too large (max ${maxBytes} bytes)`);
    }

    const release = sanitizeRelease(params.release);
    const fileName = sanitizeFileName(params.originalName || 'bundle.map');
    const root = sourcemapRoot();
    const dir = join(root, project.id, release);
    await mkdir(dir, { recursive: true });
    const relativePath = join(project.id, release, fileName);
    const fullPath = join(root, relativePath);
    await writeFile(fullPath, params.buffer);

    await this.prisma.monitoringSourceMapArtifact.upsert({
      where: {
        projectId_release_fileName: {
          projectId: project.id,
          release,
          fileName,
        },
      },
      create: {
        projectId: project.id,
        release,
        fileName,
        relativePath,
      },
      update: { relativePath },
    });

    return { ok: true, path: relativePath };
  }
}
