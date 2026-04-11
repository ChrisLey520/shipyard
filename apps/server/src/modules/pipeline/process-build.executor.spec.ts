import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessBuildExecutor, runProcessBuildCommand } from './process-build.executor';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

describe('ProcessBuildExecutor', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('子进程退出码 0 时 resolve', async () => {
    const { spawn } = await import('child_process');
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = Object.assign(new EventEmitter(), { stdout, stderr, kill: vi.fn() });
    vi.mocked(spawn).mockReturnValue(child as never);

    const p = runProcessBuildCommand({
      cmd: 'echo',
      args: ['hi'],
      cwd: '/tmp',
      env: {},
      timeoutMs: 5000,
      timeoutLabelSeconds: 5,
      onLine: vi.fn(),
    });
    child.emit('close', 0);
    await expect(p).resolves.toBeUndefined();
    expect(spawn).toHaveBeenCalledWith('echo', ['hi'], expect.any(Object));
  });

  it('非零退出码 reject', async () => {
    const { spawn } = await import('child_process');
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = Object.assign(new EventEmitter(), { stdout, stderr, kill: vi.fn() });
    vi.mocked(spawn).mockReturnValue(child as never);

    const p = new ProcessBuildExecutor().run({
      cmd: 'false',
      args: [],
      cwd: '/',
      env: {},
      timeoutMs: 5000,
      timeoutLabelSeconds: 5,
      onLine: vi.fn(),
    });
    child.emit('close', 1);
    await expect(p).rejects.toThrow(/退出码 1/);
  });
});
