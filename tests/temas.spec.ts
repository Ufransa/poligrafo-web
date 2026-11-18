import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const datos = JSON.parse(readFileSync('tests/fixtures/datos.json', 'utf-8'));
const slug = (id: string) => id.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const de2026 = datos.promesas.filter((p: any) => p.anio === 2026);
const nombre = (id: string) => datos.partidos.find((p: any) => p.id === id).nombre;
const AVISO = 'Resumen automático de cada propuesta; la cita es literal y está comprobada contra el programa oficial. Partidos en orden alfabético.';

test('el índice enlaza los 17 temas', async ({ page }) => {
  await page.goto('/temas/');
  const enlaces = page.locator('main a[href^="/temas/"]');
  await expect(enlaces).toHaveCount(17);
  expect(await enlaces.allInnerTexts()).toEqual(datos.meta.temas.map((t: string) => expect.stringContaining(t)));
});

test('en cada tema los partidos van en orden alfabético y plegados', async ({ page }) => {
  await page.goto('/temas/vivienda/');
  const ids = [...new Set(de2026.filter((p: any) => p.tema === 'Vivienda').map((p: any) => p.partido))] as string[];
  const esperados = ids.map(nombre).sort((a, b) => a.localeCompare(b, 'es'));
  const resumenes = await page.locator('details.partido-tema > summary').allInnerTexts();
  expect(resumenes.map((r) => r.split(' · ')[0].trim())).toEqual(esperados);
  for (const d of await page.locator('details.partido-tema').all()) {
    expect(await d.evaluate((e: HTMLDetailsElement) => e.open)).toBe(false);
  }
});

test('cada propuesta lleva resumen, cita y página enlazada', async ({ page }) => {
  await page.goto('/temas/vivienda/');
  const propuestas = page.locator('.propuesta');
  expect(await propuestas.count()).toBeGreaterThan(0);
  for (const p of await propuestas.all()) {
    await expect(p.locator('.resumen')).not.toBeEmpty();
    await expect(p.locator('.cita')).not.toBeEmpty();
    await expect(p.locator('a', { hasText: /pág\. \d+/ })).toHaveAttribute('href', /#page=\d+$/);
  }
});

test('una cita con < y & se ve como texto', async ({ page }) => {
  await page.goto('/temas/vivienda/');
  const cita = page.locator('.cita', { hasText: 'Cita de prueba' });
  await expect(cita).toHaveCount(1);
  expect(await cita.textContent()).toContain('<i>etiquetas</i> & «comillas»');
  await expect(cita.locator('i')).toHaveCount(0);
});

test('los partidos sin programa salen con su motivo', async ({ page }) => {
  await page.goto('/temas/vivienda/');
  const sin = page.locator('ul.sin-propuestas');
  await expect(sin).toContainText('Aún no ha publicado su programa de 2026.');
  await expect(sin).toContainText('No hemos localizado un programa de Sumar para 2026.');
  await expect(sin.locator('a[href="https://pazcasaytrabajo.es/"]')).toHaveCount(1);
  await page.goto('/temas/pensiones/');
  await expect(page.locator('ul.sin-propuestas li', { hasText: nombre('SALF') })).toContainText('Sin propuestas sobre este tema');
});

test('ninguna propuesta de 2023 aparece en los temas', async ({ page }) => {
  const de2023 = new Set(datos.promesas.filter((p: any) => p.anio === 2023).map((p: any) => p.texto));
  await page.goto('/temas/vivienda/');
  const resumenes = await page.locator('.resumen').allTextContents();
  expect(resumenes.length).toBeGreaterThan(0);
  for (const r of resumenes) expect(de2023.has(r.trim())).toBe(false);
});

test('el aviso del resumen automático está en cada tema', async ({ page }) => {
  await page.goto('/temas/vivienda/');
  await expect(page.locator('main')).toContainText(AVISO);
});

test('las páginas de tema no cargan JavaScript', async ({ page }) => {
  const r = await page.goto('/temas/vivienda/');
  expect(r?.status()).toBe(200);
  await expect(page.locator('script')).toHaveCount(0);
});

test('el pie enlaza a las propuestas por tema', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[href="/temas/"]')).toHaveCount(1);
});

test('sin meta.temas ni programa_2026 el build sigue funcionando', () => {
  const dir = mkdtempSync(join(tmpdir(), 'poligrafo-'));
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
