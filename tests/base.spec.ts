import { test, expect } from '@playwright/test';
import { execSync, spawnSync } from 'node:child_process';
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

// Los dos builds de este fichero corren en serie: en ficheros distintos, dos `astro build` a la vez comparten caché y se pisan.
test('sin meta.temas ni programa_2026 el build sigue funcionando', () => {
  const dir = mkdtempSync(join(tmpdir(), 'poligrafo-'));
  const datos = JSON.parse(readFileSync('tests/fixtures/datos.json', 'utf-8'));
  const de2026 = datos.promesas.filter((p: any) => p.anio === 2026);
  const viejo = structuredClone(datos);
  delete viejo.meta.temas;
  for (const p of viejo.partidos) { delete p.programa_2026; delete p.sin_programa_2026; delete p.url_sin_programa_2026; }
  writeFileSync(join(dir, 'datos.json'), JSON.stringify(viejo));
  execSync(`npx astro build --outDir "${join(dir, 'dist')}"`, { env: { ...process.env, DATOS_JSON: join(dir, 'datos.json') }, stdio: 'pipe' });
  // Con un datos.json anterior, un partido con propuestas de 2026 no puede salir como «sin programa» (revisión 2026-11-17).
  const ficha = readFileSync(join(dir, 'dist', 'partido', 'pp', 'index.html'), 'utf-8');
  expect(ficha).not.toContain('Sin programa de 2026 cargado');
  expect(ficha).toMatch(/href="\/temas\/[a-z0-9-]+\/#pp"/);
  const salf = de2026.some((p: any) => p.partido === 'SALF' && p.tema === 'Pensiones');
  expect(salf).toBe(false);
  const pensiones = readFileSync(join(dir, 'dist', 'temas', 'pensiones', 'index.html'), 'utf-8');
  expect(pensiones).toMatch(/Se Acabó La Fiesta:<\/strong>\s*Sin propuestas sobre este tema/);
});
