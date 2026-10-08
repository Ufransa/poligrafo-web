import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const datos = JSON.parse(readFileSync('tests/fixtures/datos.json', 'utf-8'));
const esperado = [...datos.partidos]
  .sort((a, b) => (b.escanos_23j - a.escanos_23j) || a.nombre.localeCompare(b.nombre, 'es'))
  .map((p) => p.nombre);

test('todos los partidos, por escaños y los que no tienen, al final por orden alfabético', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ficha-partido h2')).toHaveText(esperado);
});

test('la portada no compara partidos con cifras de cumple o incumple', async ({ page }) => {
  await page.goto('/');
  const texto = await page.locator('main').innerText();
  expect(texto).not.toMatch(/\d+\s*(cumple|incumple|veredicto)/i);
  await expect(page.locator('main')).toContainText('Aquí no te decimos a quién votar.');
});

test('cada partido enseña sus temas o por qué no tiene programa, y lleva a su ficha', async ({ page }) => {
  await page.goto('/');
  for (const p of datos.partidos) {
    const ficha = page.locator('.ficha-partido', { has: page.getByRole('heading', { name: p.nombre, exact: true }) });
    if (p.programa_2023) await expect(ficha).toContainText('Dedica más espacio a');
    else await expect(ficha).toContainText(p.sin_programa);
    await ficha.getByRole('link', { name: `Ver ficha de ${p.nombre}` }).click();
    await expect(page.locator('h1')).toHaveText(p.nombre);
    await page.goBack();
  }
});
