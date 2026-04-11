/**
 * v0.5 Stretch：容器内构建执行抽象，便于单测与后续替换实现。
 * 当前生产路径仍由 {@link runInBuildContainer} 承担。
 */
export type ContainerBuildRunFn = (opts: {
  tmpDir: string;
  image: string;
  shellCommand: string;
  env: Record<string, string>;
  timeoutMs: number;
  onLine: (line: string) => void;
}) => Promise<void>;
