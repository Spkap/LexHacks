import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

async function assertNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

async function forkGolden(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run the historical benchmark' }).click();
  await page.waitForURL(/\/p\/(.+)\/source/, { timeout: 30_000 });
  const match = page.url().match(/\/p\/([^/]+)\//);
  if (!match) throw new Error('could not extract project slug from URL');
  return match[1];
}

test.describe('accessibility: 0 serious/critical axe violations per screen', () => {
  test('Gallery', async ({ page }) => {
    await page.goto('/');
    await assertNoSeriousViolations(page);
  });

  test('Source Pack', async ({ page }) => {
    const slug = await forkGolden(page);
    await page.goto(`/p/${slug}/source`);
    await assertNoSeriousViolations(page);
  });

  test('Purpose Contract', async ({ page }) => {
    const slug = await forkGolden(page);
    await page.goto(`/p/${slug}/purpose`);
    await assertNoSeriousViolations(page);
  });

  test('Clause Compiler', async ({ page }) => {
    const slug = await forkGolden(page);
    await page.goto(`/p/${slug}/compile`);
    await assertNoSeriousViolations(page);
  });

  test('Attack Arena', async ({ page }) => {
    const slug = await forkGolden(page);
    await page.goto(`/p/${slug}/attack`);
    await assertNoSeriousViolations(page);
  });

  test('Report', async ({ page }) => {
    const slug = await forkGolden(page);
    await page.goto(`/p/${slug}/report`);
    await assertNoSeriousViolations(page);
  });

  test('Public replay', async ({ page }) => {
    await page.goto('/r/ccpa-2018-benchmark');
    await assertNoSeriousViolations(page);
  });
});

test('keyboard-only: Gallery through Source Pack reachable without a mouse', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const benchmarkButton = page.getByRole('button', { name: 'Run the historical benchmark' });
  await expect(benchmarkButton).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/p\/.+\/source/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('reduced motion: chip entrance animation is disabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const slug = await forkGolden(page);
  await page.goto(`/p/${slug}/attack`);
  await page.getByRole('button', { name: 'Attack' }).click();
  await page.waitForSelector('.chip-travel-in', { timeout: 15_000 });
  const durationMs = await page.evaluate(() => {
    const el = document.querySelector('.chip-travel-in');
    if (!el) return null;
    const raw = getComputedStyle(el).animationDuration;
    return raw.endsWith('ms') ? Number.parseFloat(raw) : Number.parseFloat(raw) * 1000;
  });
  expect(durationMs).not.toBeNull();
  expect(durationMs as number).toBeLessThanOrEqual(0.01);
});
