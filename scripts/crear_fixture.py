"""Recorta el datos.json real a un fixture pequeño y estable para Playwright.

Uso: python scripts/crear_fixture.py <datos.json del motor> tests/fixtures/datos.json
Conserva todos los partidos, temas, finanzas, coherencia y gobierno; de cruces, todos los revisados a mano,
4 firmes más, 3 «juzga tú» y 1 con voto dividido por partido.
"""
import json
import sys

d = json.load(open(sys.argv[1], encoding="utf-8"))
sel = []
for p in d["partidos"]:
    cs = [c for c in d["cruces"] if c["partido"] == p["id"]]
    firmes = [c for c in cs if c["nivel"] == "veredicto"]
    sel += [c for c in firmes if c["revisado_a_mano"]] + [c for c in firmes if not c["revisado_a_mano"]][:4]
    sel += [c for c in cs if c["nivel"] == "juzga_tu"][:3] + [c for c in cs if c["dividido"]][:1]
sel = list({(c["votacion_id"], c["promesa_id"], c["partido"]): c for c in sel}.values())
gob = [g for gs in d["gobierno"].values() for g in gs]
vids = ({c["votacion_id"] for c in sel} | {g["votacion_id"] for g in gob}
        | {x[k] for pares in d["coherencia"].values() for x in pares for k in ("a_favor", "en_contra")})
pids = {c["promesa_id"] for c in sel} | {g["promesa_id"] for g in gob}
d["cruces"] = sel
d["votaciones"] = [v for v in d["votaciones"] if v["id"] in vids]
d["promesas"] = [p for p in d["promesas"] if p["id"] in pids]
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(sel), "cruces,", len(d["votaciones"]), "votaciones,", len(d["promesas"]), "promesas")
