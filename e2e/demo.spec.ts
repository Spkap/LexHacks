import { test, expect } from '@playwright/test';

test.setTimeout(90_000);

test('golden CCPA benchmark: attack, verify, repair, re-attack, and share', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Open the CCPA demo' }).click();
  await page.waitForURL(/\/a\/ccpa-2018-fork-[a-f0-9]+\?demo=1$/, { timeout: 30_000 });

  await expect(page.getByText(/sha [0-9a-f]{8}/)).toBeVisible();
  await page.getByRole('button', { name: /ATTACK/ }).click();

  // This is the recorded live-jury fixture. It confirms C1, C3, and C6.
  await expect(page.getByText('3 LOOPHOLES')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /^C1 ·/ }).click();
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText(/Hash verified ✓/)).toBeVisible();
  await expect(page.getByText(/quotes verified ✓/)).toBeVisible();

  await page.getByRole('button', { name: 'Patch this loophole' }).click();
  await page.getByRole('button', { name: 'Draft a repair' }).click();
  await expect(page.getByRole('button', { name: 'Approve patch' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Try the lazy fix' }).click();
  await expect(page.getByText('G1: ✕ banned by lazy fix')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Approve patch' }).click();

  await expect(page.getByText('3/3 legitimate uses kept')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('3 loopholes → 0 still open.')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: 'Share results' }).click();
  await page.waitForURL(/\/r\/ccpa-2018-fork-[a-f0-9]+$/, { timeout: 30_000 });
  await expect(page.getByRole('table')).toBeVisible();
});
