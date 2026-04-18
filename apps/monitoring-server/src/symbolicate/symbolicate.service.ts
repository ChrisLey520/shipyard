import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SourceMapConsumer, type RawSourceMap } from 'source-map';
import { PrismaService } from '../prisma/prisma.service';

function sourcemapRoot(): string {
  return process.env['MONITORING_SOURCEMAP_ROOT']?.trim() || join(process.cwd(), 'data', 'sourcemaps');
}

function tryParseFrame(line: string): { path: string; line: number; column: number } | null {
  const open = line.lastIndexOf('(');
  const close = line.lastIndexOf(')');
  const chunk = open !== -1 && close > open ? line.slice(open + 1, close) : line.replace(/^\s*at\s+/, '').trim();
  const m = chunk.match(/^(.+):(\d+):(\d+)$/);
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) return null;
  const path = m[1];
  if (path.includes(' ')) return null;
  return { path, line: parseInt(m[2], 10), column: parseInt(m[3], 10) };
}

@Injectable()
export class SymbolicateService {
  constructor(private readonly prisma: PrismaService) {}

  async symbolicatedStackLines(projectId: string, release: string | null, stack: string): Promise<{
    lines: string[];
    notice: string | null;
  }> {
    if (!release || !stack.trim()) {
      return { lines: stack.split('\n'), notice: null };
    }
    const artifacts = await this.prisma.monitoringSourceMapArtifact.findMany({
      where: { projectId, release },
    });
    if (artifacts.length === 0) {
      return {
        lines: stack.split('\n'),
        notice: '未上传与该 release 匹配的 sourcemap，以下为原始堆栈',
      };
    }

    const root = sourcemapRoot();
    const mapContents: Array<{ json: string }> = [];
    for (const a of artifacts) {
      try {
        const full = join(root, a.relativePath);
        const json = await readFile(full, 'utf8');
        mapContents.push({ json });
      } catch {
        continue;
      }
    }
    if (mapContents.length === 0) {
      return { lines: stack.split('\n'), notice: 'sourcemap 文件读取失败，以下为原始堆栈' };
    }

    const rawLines = stack.split('\n');
    const outLines: string[] = [];

    for (const raw of rawLines) {
      const frame = tryParseFrame(raw);
      outLines.push(raw);
      if (!frame) continue;

      let mapped: string | null = null;
      for (const mc of mapContents) {
        try {
          const parsed = JSON.parse(mc.json) as RawSourceMap;
          await SourceMapConsumer.with(parsed, null, async (consumer) => {
            const pos = consumer.originalPositionFor({
              line: frame.line,
              column: Math.max(0, frame.column),
            });
            if (pos.source != null && pos.line != null) {
              const col = pos.column != null ? pos.column : 0;
              mapped = `    → ${pos.source}:${pos.line}:${col}`;
            }
          });
        } catch {
          continue;
        }
        if (mapped) break;
      }
      if (mapped) {
        outLines.push(mapped);
      }
    }

    return { lines: outLines, notice: null };
  }
}
