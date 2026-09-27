import { test, expect } from '@playwright/test';

/**
 * Mirrors the 3-minute demo video path end to end. The plan's stated timeout budget
 * is 90s; real Groq latency across 8 attack candidates plus a live repair-proposal
 * call has measured well past that in practice (observed ~140s for the attack run
 * alone during Phase 4 verification), so this spec's overall timeout is set higher
 * to stay reliable against real infra rather than flake against an optimistic budget.
 */
test.setTimeout(240_000);

test('golden CCPA benchmark: fork, attack, certify, repair, re-attack, public replay', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Run the historical benchmark' }).click();
  await page.waitForURL(/\/p\/.+\/source/, { timeout: 30_000 });

  await expect(page.getByText(/^[0-9a-f]{12}/)).toBeVisible();

  await page.getByRole('link', { name: 'Purpose' }).click();
  await page.waitForURL(/\/purpose$/);
  await page.getByRole('button', { name: 'Approve contract' }).click();

  await page.getByRole('link', { name: 'Compile' }).click();
  await page.waitForURL(/\/compile$/);
  await expect(page.getByText(/6\/6 rules and definitions reviewed/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('link', { name: 'Attack' }).click();
  await page.waitForURL(/\/attack$/);
  await page.getByRole('button', { name: 'Attack' }).click();

  await expect(page.getByText('2 certified')).toBeVisible({ timeout: 200_000 });

  await page.getByRole('link', { name: 'View finding' }).first().click();
  await page.waitForURL(/\/findings\//);
  await expect(page.getByText('Law satisfied')).toBeVisible();
  await expect(page.getByText('Purpose violated')).toBeVisible();

  await page.getByRole('button', { name: 'Verify again' }).click();
  await expect(page.getByText(/verified/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('link', { name: 'Repair this' }).click();
  await page.waitForURL(/\/repair\//);
  await page.getByRole('button', { name: 'Draft repairs (AI)' }).click();
  await expect(page.getByRole('button', { name: 'Approve and re-attack' }).first()).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Approve and re-attack' }).first().click();

  await expect(page.getByText('UNSAT').first()).toBeVisible({ timeout: 60_000 });
  const unsatCount = await page.getByText('UNSAT').count();
  expect(unsatCount).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('3/3').first()).toBeVisible();

  await page.goto('/r/ccpa-2018-benchmark');
  await expect(page.getByRole('table')).toBeVisible();
});
