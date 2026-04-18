import { describe, expect, it } from 'vitest';
import { CreateOrgDto, LoginDto } from './dto';
import { URL_SLUG_MAX_LENGTH } from './slug-rules';

describe('LoginDto', () => {
  it('合法输入通过 safeParse', () => {
    expect(LoginDto.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });

  it('非法 email 时 safeParse 失败', () => {
    const r = LoginDto.safeParse({ email: 'not-an-email', password: 'secret12' });
    expect(r.success).toBe(false);
  });

  it('空 password 时 safeParse 失败', () => {
    const r = LoginDto.safeParse({ email: 'a@b.co', password: '' });
    expect(r.success).toBe(false);
  });
});

describe('CreateOrgDto', () => {
  it('合法输入通过 safeParse', () => {
    expect(CreateOrgDto.safeParse({ name: 'Acme', slug: 'acme' }).success).toBe(true);
  });

  it('slug 含大写字母时 safeParse 失败', () => {
    expect(CreateOrgDto.safeParse({ name: 'Acme', slug: 'Acme' }).success).toBe(false);
  });

  it('slug 超过最大长度时 safeParse 失败', () => {
    const slug = 'a'.repeat(URL_SLUG_MAX_LENGTH + 1);
    expect(CreateOrgDto.safeParse({ name: 'Acme', slug }).success).toBe(false);
  });
});
