"""Recorta el datos.json real a un fixture pequeño y estable para Playwright.

Uso: python scripts/crear_fixture.py <datos.json del motor> tests/fixtures/datos.json
Conserva todos los partidos, temas, finanzas, coherencia y gobierno; de cruces, todos los revisados a mano,
4 firmes más, 3 «juzga tú» y 1 con voto dividido por partido. Del test a ciegas, 2 propuestas por partido y tema
más una sintética con los casos límite (texto con <, & y comillas; sin concreción; inviable; con cruce de 2023).
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
test, vistos = [], {}
for t in d.get("test", []):
    clave = (t["partido"], t["tema"])
    if vistos.get(clave, 0) < 2:
        test.append(t)
        vistos[clave] = vistos.get(clave, 0) + 1
if test:
    v = d["votaciones"][0]
    test.append({**test[0], "id": -1, "tema": "Vivienda", "concreta": False, "inviable": True,
                 "resumen": "Propuesta de prueba con <i>etiquetas</i>, «comillas» & símbolos.",
                 "condiciones": [{"clave": "exclusiva_autonomica", "etiqueta": "No es competencia del Estado",
                                  "explicacion": "Explicación de prueba.", "norma": "Art. 148 de la Constitución",
                                  "url": "https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229#a148", "inviable": True}],
                 "cruce_2023": {"veredicto": "cumple", "votacion_id": v["id"], "expediente": v["expediente"],
                                "fecha": v["fecha"], "url_sesion": v["url_sesion"]}})
d["test"] = test
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(test), "propuestas del test,", len(sel), "cruces,", len(d["votaciones"]), "votaciones,", len(d["promesas"]), "promesas")
