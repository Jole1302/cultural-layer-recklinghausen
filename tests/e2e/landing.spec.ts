import { test, expect } from './fixtures';

test('/ renders site title and tagline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Cultural Layer Recklinghausen');
  await expect(page.locator('main')).toContainText('bald verfügbar');
});

test('/ has zero WCAG 2.1 AA violations', async ({ page, makeAxeBuilder }) => {
  await page.goto('/');
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
});

test.skip('/ shows the GDPR cookie banner in German', async ({ page }) => {
  // vanilla-cookieconsent v3 only auto-shows the consent modal when at least
  // one category is non-readOnly. Phase 0 ships with only `necessary`
  // (readOnly), so the banner stays dormant until Phase 1+ adds an
  // opt-in analytics category. The banner CODE is wired and shipped — the
  // visual gate is deferred to the phase that introduces the first
  // user-toggleable category. Re-enable this test then.
  await page.goto('/');
  const banner = page.getByText('Wir respektieren deine Privatsphäre');
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Verstanden' })).toBeVisible();
});

test('/ has lang=de on html element (DEC-006)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});
