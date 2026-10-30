import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Test a ciegas: ver poligrafo-es/docs/superpowers/specs/2026-10-30-test-a-ciegas-design.md
const datos = JSON.parse(readFileSync('tests/fixtures/datos.json', 'utf-8'));
const test_ = datos.test as { id: number; tema: string; resumen: string; partido_nombre: string; cita: string;
  pagina: number; cruce_2023: unknown; condiciones: { etiqueta: string; url: string }[] }[];
const deTema = (t: string) => test_.filter((p) => p.tema === t);
const VIVIENDA = deTema('Vivienda').length;

async function empezar(page: Page, temas: string[]) {
  await page.goto('/test/');
  for (const t of temas) await page.locator('label', { hasText: new RegExp(`^${t} \\(`) }).locator('input.tema-opcion').check();
  await page.getByRole('button', { name: 'Empezar' }).click();
}

// Texto visible que escribimos nosotros: sin las citas literales del programa ni los resúmenes (son datos).
async function textoPropio(page: Page): Promise<string> {
  return page.locator('main').evaluate((m) => {
    const datos = [...m.querySelectorAll<HTMLElement>('.cita, .resumen')];
    datos.forEach((e) => (e.style.display = 'none'));
    const texto = (m as HTMLElement).innerText;
    datos.forEach((e) => (e.style.display = ''));
    return texto;
  });
}

async function votarTodas(page: Page, n: number) {
  for (let i = 0; i < n; i++) await page.getByRole('button', { name: i % 2 ? 'No' : 'Sí', exact: true }).click();
}

test('elegir un tema solo enseña tarjetas de ese tema y el número coincide', async ({ page }) => {
  await page.goto('/test/');
  await expect(page.locator('label', { hasText: /^Vivienda \(/ })).toHaveText(`Vivienda (${VIVIENDA})`);
  await empezar(page, ['Vivienda']);
  await expect(page.locator('.progreso')).toHaveText(`1 de ${VIVIENDA}`);
  for (let i = 0; i < VIVIENDA; i++) {
    await expect(page.locator('.tarjeta .tema')).toHaveText('Vivienda');
    await page.getByRole('button', { name: 'Sí', exact: true }).click();
  }
  await expect(page.locator('.destape .resultado')).toHaveCount(VIVIENDA);
});

test('ninguna tarjeta enseña partido ni cita antes de votarla', async ({ page }) => {
  await empezar(page, ['Vivienda', 'Fiscalidad']);
  const n = VIVIENDA + deTema('Fiscalidad').length;
  for (let i = 0; i < n; i++) {
    const texto = await page.locator('main').innerText();
    for (const p of test_) {
      expect(texto).not.toContain(p.partido_nombre);
      expect(texto).not.toContain(p.cita);
    }
    await page.getByRole('button', { name: 'No', exact: true }).click();
  }
});

test('las condiciones se despliegan antes de votar y enlazan a la norma', async ({ page }) => {
  await empezar(page, ['Vivienda']);
  const tarjeta = page.locator('.tarjeta');
  const condicion = tarjeta.locator('details.condicion').first();
  await expect(condicion).toBeVisible();
  await condicion.locator('summary').click();
  await expect(condicion.getByRole('link')).toHaveAttribute('href', /^https:\/\//);
});

test('votar todas lleva al destape con voto, partido, cita y página de cada una', async ({ page }) => {
  await empezar(page, ['Vivienda']);
  await votarTodas(page, VIVIENDA);
  const resultados = page.locator('.destape .resultado');
  await expect(resultados).toHaveCount(VIVIENDA);
  for (let i = 0; i < VIVIENDA; i++) {
    const r = resultados.nth(i);
    await expect(r.locator('.tu-voto')).toHaveText(/^Tu voto: (Sí|No)$/);
    const nombre = await r.locator('.partido').innerText();
    const p = deTema('Vivienda').find((x) => x.partido_nombre === nombre);
    expect(p).toBeTruthy();
    await expect(r.getByRole('link', { name: /^Programa, pág\. \d+$/ })).toHaveAttribute('href', /#page=\d+$/);
  }
});

test('ver de quién eran a mitad destapa solo las votadas', async ({ page }) => {
  await empezar(page, ['Vivienda']);
  await votarTodas(page, 2);
  await page.getByRole('button', { name: 'Ver de quién eran' }).click();
  await expect(page.locator('.destape .resultado')).toHaveCount(2);
});

test('ver de quién eran sin votar ninguna lo dice y deja volver', async ({ page }) => {
  await empezar(page, ['Vivienda']);
  await page.getByRole('button', { name: 'Ver de quién eran' }).click();
  await expect(page.locator('.destape')).toContainText('Aún no has votado ninguna propuesta.');
  await page.getByRole('button', { name: 'Volver a empezar' }).click();
  await expect(page.getByRole('button', { name: 'Empezar' })).toBeVisible();
});

test('el destape no tiene totales, porcentajes ni agrupación por partido', async ({ page }) => {
  await empezar(page, ['Vivienda', 'Fiscalidad']);
  await votarTodas(page, VIVIENDA + deTema('Fiscalidad').length);
  const texto = await textoPropio(page);
  expect(texto).not.toMatch(/\d+\s*%/);
  expect(texto).not.toMatch(/\d+\s+(de las|propuestas de|coincidencias|votos? (a|de))/i);
  // Sin agrupación: el único encabezado del destape es el suyo, nada por partido.
  await expect(page.locator('.destape').locator('h2, h3, h4')).toHaveText(['De quién eran']);
});

test('el cruce 2023 sale solo donde existe', async ({ page }) => {
  await empezar(page, ['Vivienda']);
  await votarTodas(page, VIVIENDA);
  const conCruce = deTema('Vivienda').filter((p) => p.cruce_2023).length;
  await expect(page.locator('.destape .cruce-2023')).toHaveCount(conCruce);
  await expect(page.locator('.destape .cruce-2023').first()).toContainText('Ya lo prometió en 2023');
});

test('sin temas marcados no se puede empezar; un tema sin propuestas está deshabilitado', async ({ page }) => {
  await page.goto('/test/');
  await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
  await expect(page.locator('label', { hasText: /^Pensiones \(0\)$/ }).locator('input')).toBeDisabled();
});

test('un resumen con < & y comillas se ve como texto', async ({ page }) => {
  await empezar(page, ['Vivienda']);
  for (let i = 0; i < VIVIENDA; i++) {
    if ((await page.locator('.tarjeta .resumen').innerText()).includes('<i>etiquetas</i>')) {
      await expect(page.locator('.tarjeta .resumen i')).toHaveCount(0);
      await expect(page.locator('.tarjeta .sin-concrecion')).toBeVisible();
      await expect(page.locator('.tarjeta .inviable')).toBeVisible();
      return;
    }
    await page.getByRole('button', { name: 'Sí', exact: true }).click();
  }
  throw new Error('no apareció la tarjeta sintética');
});

test('no guarda nada ni hace peticiones tras cargar', async ({ page }) => {
  await page.goto('/test/');
  await page.waitForLoadState('networkidle');
  const peticiones: string[] = [];
  // Las tipografías de Google las pide el navegador cuando hacen falta: no son datos del usuario.
  page.on('request', (r) => { if (!r.url().startsWith('https://fonts.gstatic.com/')) peticiones.push(r.url()); });
  await empezar(page, ['Vivienda']);
  peticiones.length = 0;                    // la navegación de empezar() recarga la página; contamos desde aquí
  await votarTodas(page, VIVIENDA);
  await page.getByRole('button', { name: 'Volver a empezar' }).click();
  expect(peticiones).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
});

test('volver a empezar y recargar dejan la página como nueva', async ({ page }) => {
  await empezar(page, ['Vivienda']);
  await votarTodas(page, 1);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
  await expect(page.locator('.tarjeta')).toBeHidden();
});

test('el texto no lleva rayas ni vosotros', async ({ page }) => {
  await empezar(page, ['Vivienda']);
  const entrada = await textoPropio(page);
  await votarTodas(page, VIVIENDA);
  const destape = await textoPropio(page);
  const texto = entrada + destape;
  expect(texto).not.toMatch(/[—–]/);
  expect(texto).not.toMatch(/\bvosotr[oa]s\b|\bos\b/i);
});

test('la portada enlaza al test', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Test a ciegas' }).first().click();
  await expect(page.locator('h1')).toHaveText('Test a ciegas');
});
