import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('ninguna página se deja indexar', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /');
});

test('el pie lleva a «Sobre este proyecto» y va firmado', async ({ page }) => {
  await page.goto('/');
  const pie = page.locator('footer');
  await expect(pie.getByRole('link', { name: 'Sobre este proyecto' })).toHaveAttribute('href', '/sobre/');
  await expect(pie).toContainText('Hecho por');
});

test('un datos.json de otra versión del contrato no se publica', () => {
  const dir = mkdtempSync(join(tmpdir(), 'poligrafo-'));
  const datos = JSON.parse(readFileSync('tests/fixtures/datos.json', 'utf-8'));
  datos.meta.version_contrato = '2.0.0';
  writeFileSync(join(dir, 'datos.json'), JSON.stringify(datos));
  const r = spawnSync('npx', ['astro', 'build', '--outDir', join(dir, 'dist')],
    { env: { ...process.env, DATOS_JSON: join(dir, 'datos.json') }, encoding: 'utf-8', shell: true });
  expect(r.status).not.toBe(0);
  expect(r.stdout + r.stderr).toContain('Versión del contrato');
});
