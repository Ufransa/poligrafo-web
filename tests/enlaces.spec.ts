import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('@red todo enlace de un veredicto firme responde', async ({ request }) => {
  test.setTimeout(30 * 60_000);
  const d = JSON.parse(readFileSync('data/datos.json', 'utf-8'));
  const V = new Map(d.votaciones.map((v: any) => [v.id, v]));
  const P = new Map(d.promesas.map((p: any) => [p.id, p]));
  const urls = new Set<string>();
  for (const c of d.cruces.filter((x: any) => x.nivel === 'veredicto')) {
    const v: any = V.get(c.votacion_id), p: any = P.get(c.promesa_id);
    for (const u of [p.url_programa_pagina, v.url_sesion, v.url_bocg, v.url_boe]) if (u) urls.add(u.split('#')[0]);
  }
  // Como un navegador: algunos servidores (Newtral) rechazan a los robots y no a las personas.
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' };
  const rotos: string[] = [];
  for (const u of urls) {
    const r = await request.get(u, { headers, maxRedirects: 5, failOnStatusCode: false, timeout: 60_000 }).catch(() => null);
    if (!r || r.status() >= 400) rotos.push(`${r?.status() ?? 'sin respuesta'} ${u}`);
  }
  expect(rotos, rotos.join('\n')).toEqual([]);
});
