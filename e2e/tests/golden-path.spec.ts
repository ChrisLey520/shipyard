import { expect, test } from '@playwright/test';

test.describe('金路径', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  const password = 'E2ETestPass8';
  let registeredEmail = '';

  test.beforeEach(async ({ page }) => {
    // 与 App initLocale 一致：固定 zh-CN，避免 CI/本机浏览器语言导致文案不一致
    await page.addInitScript(() => {
      localStorage.setItem('locale', 'zh-CN');
    });
  });

  test('注册后进入组织列表并创建组织', async ({ page }) => {
    registeredEmail = `e2e-${Date.now()}-w${test.info().parallelIndex}@shipyard-e2e.local`;

    await page.goto('/register');
    await page.getByPlaceholder('你的名字').fill('E2E 用户');
    await page.getByPlaceholder('your@email.com').fill(registeredEmail);
    await page.getByPlaceholder('至少 8 位').fill(password);
    await page.getByRole('button', { name: '注册' }).click();

    await expect(page).toHaveURL(/\/orgs\/?$/);
    await expect(page.getByText('我的组织', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '+ 创建组织' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('创建组织', { exact: true })).toBeVisible();

    const orgName = `E2E 组织 ${Date.now()}`;
    // Naive UI 表单项未必把 label 关联到 input，使用占位符定位（与 zh-CN 文案一致）
    await dialog.getByPlaceholder('请输入').fill(orgName);
    const slugInput = dialog.getByPlaceholder('只能包含小写字母、数字和连字符');
    await expect(slugInput).not.toHaveValue('');
    const slug = await slugInput.inputValue();
    expect(slug.length).toBeGreaterThan(0);

    await dialog.getByRole('button', { name: '创建', exact: true }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe(`/orgs/${slug}`);
  });

  test('使用已注册账号登录', async ({ page }) => {
    expect(registeredEmail).toMatch(/@shipyard-e2e\.local$/);

    await page.goto('/login');
    await page.getByPlaceholder('your@email.com').fill(registeredEmail);
    await page.getByPlaceholder('请输入密码').fill(password);
    await page.getByRole('button', { name: '登录' }).click();

    // 登录后可能进入组织列表 /orgs，或直接进入唯一组织仪表盘 /orgs/:slug
    await expect(page).toHaveURL(/\/orgs(\/[a-z0-9-]+)?$/);
    await expect(page.getByText('Shipyard').first()).toBeVisible();
  });
});
