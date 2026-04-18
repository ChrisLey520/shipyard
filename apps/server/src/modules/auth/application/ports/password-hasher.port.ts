/** 密码哈希端口（应用层依赖抽象，bcrypt 实现在基础设施） */
export interface PasswordHasher {
  hash(password: string, rounds?: number): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
