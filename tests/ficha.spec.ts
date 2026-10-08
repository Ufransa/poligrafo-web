import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const datos = JSON.parse(readFileSync('tests/fixtures/datos.json', 'utf-8'));
const slug = (id: string) => id.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const conFirmes = [...new Set(datos.cruces.filter((c: any) => c.nivel === 'veredicto').map((c: any) => c.partido))] as string[];

test('cada veredicto firme lleva cita, página del programa y enlace a la votación', async ({ page }) => {
  expect(conFirmes.length).toBeGreaterThan(0);
  for (const id of conFirmes) {
    await page.goto(`/partido/${slug(id)}/`);
    const firmes = page.locator('#cruces .cruce');
    expect(await firmes.count()).toBeGreaterThan(0);
    for (const c of await firmes.all()) {
      await expect(c.locator('.cita')).not.toBeEmpty();
      await expect(c.locator('.enlaces a', { hasText: 'Programa, pág.' })).toHaveAttribute('href', /#page=\d+$/);
      await expect(c.locator('.enlaces a', { hasText: 'Votación en el Congreso' })).toHaveAttribute('href', /^https:\/\/www\.congreso\.es\//);
    }
  }
});

test('ningún enlace es nulo y nunca se ve la palabra null', async ({ page }) => {
  for (const p of datos.partidos) {
    await page.goto(`/partido/${slug(p.id)}/`);
    for (const a of await page.locator('main a').all()) {
      expect(await a.getAttribute('href')).toMatch(/^(https:\/\/|\/|#)/);
    }
    expect(await page.locator('main').innerText()).not.toMatch(/\b(null|undefined|NaN)\b/);
  }
});

test('«Juzga tú» empieza plegado', async ({ page }) => {
  const id = datos.cruces.find((c: any) => c.nivel === 'juzga_tu').partido;
  await page.goto(`/partido/${slug(id)}/`);
  const det = page.locator('details#juzga-tu');
  await expect(det).toHaveCount(1);
  expect(await det.evaluate((d: HTMLDetailsElement) => d.open)).toBe(false);
});

test('un incumple firme dice que se revisó a mano', async ({ page }) => {
  const c = datos.cruces.find((x: any) => x.nivel === 'veredicto' && x.veredicto === 'incumple');
  await page.goto(`/partido/${slug(c.partido)}/`);
  await expect(page.locator('#cruces .cruce.incumple .revisado').first()).toContainText('Revisado a mano');
});

test('los cruces firmes salen agrupados por tema, en el orden del espacio del programa', async ({ page }) => {
  for (const id of conFirmes) {
    await page.goto(`/partido/${slug(id)}/`);
    const orden = Object.entries(datos.temas[id]['2023'] as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const vistos = await page.locator('#cruces h3').allInnerTexts();
    const rango = (t: string) => (orden.indexOf(t) === -1 ? orden.length : orden.indexOf(t));
    expect(vistos.length).toBeGreaterThan(0);
    expect(vistos.map(rango)).toEqual([...vistos.map(rango)].sort((a, b) => a - b));
  }
});

test('un partido sin programa explica por qué y no deja secciones vacías', async ({ page }) => {
  for (const p of datos.partidos.filter((x: any) => !x.programa_2023)) {
    await page.goto(`/partido/${slug(p.id)}/`);
    await expect(page.locator('main')).toContainText(p.sin_programa);
    for (const h of await page.locator('main h2').all()) {
      const seccion = h.locator('xpath=..');
      expect((await seccion.innerText()).trim().length).toBeGreaterThan((await h.innerText()).trim().length + 10);
    }
  }
});

test('«Lo que hicieron gobernando» solo aparece en quien tiene datos de gobierno', async ({ page }) => {
  for (const p of datos.partidos) {
    await page.goto(`/partido/${slug(p.id)}/`);
    await expect(page.locator('#gobierno')).toHaveCount((datos.gobierno[p.id] ?? []).length > 0 ? 1 : 0);
  }
});

test('un voto dividido se dice', async ({ page }) => {
  const c = datos.cruces.find((x: any) => x.dividido);
  test.skip(!c, 'el fixture no trae votos divididos');
  await page.goto(`/partido/${slug(c.partido)}/`);
  await expect(page.locator('main')).toContainText('votó dividido');
});
