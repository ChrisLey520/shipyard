import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * 从当前文件所在目录向上查找仓库根目录的 .env / .env.local。
 * 避免仅依赖「../../../」在部分运行方式下指向错误目录。
 * override: true 避免 shell 中已存在空字符串时 dotenv 无法写入有效值。
 */
export function loadRootEnvFiles(): void {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const envFile = resolve(dir, '.env');
    const envLocal = resolve(dir, '.env.local');
    let loaded = false;
    if (existsSync(envFile)) {
      loadDotenv({ path: envFile, override: true });
      loaded = true;
    }
    if (existsSync(envLocal)) {
      loadDotenv({ path: envLocal, override: true });
      loaded = true;
    }
    if (loaded) return;

    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
}
