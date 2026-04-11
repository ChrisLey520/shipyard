import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../application/ports/password-hasher.port';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  hash(password: string, rounds = 12): Promise<string> {
    return new Promise((resolve, reject) => {
      bcrypt.hash(password, rounds, (err, hash) => {
        if (err) return reject(err);
        if (!hash) return reject(new Error('密码哈希生成失败'));
        resolve(hash);
      });
    });
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, passwordHash, (err, same) => {
        if (err) return reject(err);
        resolve(Boolean(same));
      });
    });
  }
}
