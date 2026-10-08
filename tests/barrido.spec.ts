import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const datos = JSON.parse(readFileSync('tests/fixtures/datos.json', 'utf-8'));
const slug = (id: string) => id.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rutas = ['/', '/sobre/', ...datos.partidos.map((p: any) => `/partido/${slug(p.id)}/`)];

test('en un móvil de 390 px ninguna página desborda en horizontal, ni con «Juzga tú» abierto', async ({ page }) => {
  for (const r of rutas) {
    const resp = await page.goto(r);
    expect(resp?.status(), r).toBe(200);
    await page.locator('details').evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho, r).toBeLessThanOrEqual(390);
  }
});

test('ningún texto nuestro lleva rayas (las citas y los títulos oficiales se copian tal cual)', async ({ page }) => {
  for (const r of rutas) {
    await page.goto(r);
    const texto = await page.evaluate(() => {
      const b = document.body.cloneNode(true) as HTMLElement;
      b.querySelectorAll('.cita, .votacion').forEach((e) => e.remove());
      return b.textContent ?? '';
    });
    expect(texto, r).not.toMatch(/[\u2014\u2013]/);
  }
});
