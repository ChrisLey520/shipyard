/**
 * 容器内构建执行抽象，便于单测与后续替换实现。
 * 生产路径由 {@link DockerBuildExecutor} / {@link runInBuildContainer} 承担。
 */
export type ContainerBuildRunOpts = {
  tmpDir: string;
  image: string;
  shellCommand: string;
  env: Record<string, string>;
  timeoutMs: number;
  onLine: (line: string) => void;
};

export type ContainerBuildRunFn = (opts: ContainerBuildRunOpts) => Promise<void>;

/** 宿主进程内 spawn 构建命令（与 Docker 路径对偶）。 */
export type ProcessBuildRunOpts = {
  cmd: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeoutMs: number;
  /** 超时错误文案中的秒数，如「构建超时（300s）」 */
  timeoutLabelSeconds: number;
  onLine: (line: string) => void;
};
