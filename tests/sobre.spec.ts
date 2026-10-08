import { test, expect } from '@playwright/test';

test('«Sobre este proyecto» enlaza todas las fuentes oficiales y el código', async ({ page }) => {
  await page.goto('/sobre/');
  for (const dominio of ['congreso.es', 'boe.es', 'juntaelectoralcentral.es', 'github.com/Ufransa/poligrafo-es', 'github.com/Ufransa/poligrafo-web']) {
    await expect(page.locator(`main a[href*="${dominio}"]`).first()).toBeVisible();
  }
});

test('explica la regla de los «incumple» y no esconde los errores medidos', async ({ page }) => {
  await page.goto('/sobre/');
  const main = page.locator('main');
  await expect(main).toContainText('revisado a mano');
  await expect(main).toContainText('64 %');
  await expect(main).toContainText('Juzga tú');
});
