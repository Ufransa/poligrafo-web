import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VERSION_MAYOR = 1;

export type Juez = { postura: 'a_favor' | 'en_contra'; fuerza: 'directa' | 'indirecta' | null } | null;
export interface Partido {
  id: string; nombre: string; escanos_23j: number; gobierno: [string, string | null][];
  programa_2023: string | null; sin_programa?: string; nota_gobierno?: string;
}
export interface Votacion {
  id: string; fecha: string; tipo: string; subtipo: string; expediente: string; que_se_vota: string;
  resultado: string; url_sesion: string | null; url_bocg: string | null; url_boe: string | null;
}
export interface Promesa {
  id: number; partido: string; anio: number; texto: string; cita: string; pagina: number; tema: string;
  url_programa_pagina: string;
}
export interface Cruce {
  votacion_id: string; promesa_id: number; partido: string; voto: string; dividido: boolean;
  nivel: 'veredicto' | 'juzga_tu'; veredicto: 'cumple' | 'incumple'; revisado_a_mano: boolean;
  jueces: Record<string, Juez>;
}
export interface Finanzas {
  gasto_justificado_eur: number; endeudamiento_eur: number; propuesta_reduccion_subvencion: boolean;
  pagina: number; transparencia: string; url_informe: string;
}
export interface Datos {
  meta: { version_contrato: string; generado: string; periodo: { desde: string; hasta: string };
          recuentos: { votaciones: number; promesas: number; veredictos: number } };
  partidos: Partido[]; votaciones: Votacion[]; promesas: Promesa[]; cruces: Cruce[];
  temas: Record<string, Record<string, Record<string, number>>>;
  coherencia: Record<string, { clave_iniciativa: string; a_favor: string; en_contra: string }[]>;
  gobierno: Record<string, { votacion_id: string; promesa_id: number; url_boe: string | null }[]>;
  finanzas: Record<string, Finanzas>;
}

function cargar(): Datos {
  const ruta = resolve(process.env.DATOS_JSON ?? 'data/datos.json');
  let d: Datos;
  try {
    d = JSON.parse(readFileSync(ruta, 'utf-8'));
  } catch (e) {
    throw new Error(`No se puede leer datos.json en ${ruta}: ${e}`);
  }
  const mayor = Number(String(d.meta?.version_contrato ?? '').split('.')[0]);
  if (mayor !== VERSION_MAYOR) {
    throw new Error(`Versión del contrato ${d.meta?.version_contrato} no soportada (se espera ${VERSION_MAYOR}.x)`);
  }
  return d;
}

export const datos = cargar();
export const votacion = new Map(datos.votaciones.map((v) => [v.id, v]));
export const promesa = new Map(datos.promesas.map((p) => [p.id, p]));

export function slug(id: string): string {
  return id.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Por escaños de 2023; empates y partidos sin escaño, en orden alfabético. */
export function partidosOrdenados() {
  return [...datos.partidos].sort((a, b) => (b.escanos_23j - a.escanos_23j) || a.nombre.localeCompare(b.nombre, 'es'));
}

export function temasDe(id: string, anio = '2023'): [string, number][] {
  return Object.entries(datos.temas[id]?.[anio] ?? {}).sort((a, b) => b[1] - a[1]);
}

export function crucesDe(id: string) {
  const c = datos.cruces.filter((x) => x.partido === id && votacion.has(x.votacion_id) && promesa.has(x.promesa_id));
  return { firmes: c.filter((x) => x.nivel === 'veredicto'), juzgaTu: c.filter((x) => x.nivel === 'juzga_tu') };
}

/** Agrupa por tema, en el orden del espacio que el programa del partido dedica a cada tema. */
export function porTema(id: string, lista: Cruce[]): [string, Cruce[]][] {
  const orden = temasDe(id).map(([t]) => t);
  const grupos = new Map<string, Cruce[]>();
  for (const c of lista) {
    const t = promesa.get(c.promesa_id)!.tema;
    grupos.set(t, [...(grupos.get(t) ?? []), c]);
  }
  const rango = (t: string) => (orden.indexOf(t) === -1 ? orden.length : orden.indexOf(t));
  return [...grupos.entries()].sort((a, b) => rango(a[0]) - rango(b[0]));
}

const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
export const fecha = (iso: string) => FECHA.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));
const EUROS = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const euros = (n: number) => EUROS.format(n);
