# poligrafo-web

Web estática de PolígrafoES para las generales del 29N: lo que cada partido prometió en 2023 frente a lo que
votó en la XV legislatura. Solo lee `data/datos.json`, que genera el motor
([poligrafo-es](https://github.com/Ufransa/poligrafo-es)) cada noche.

- `npm run build`: genera `dist/` (falla si `datos.json` no es del contrato 1.x).
- `npm test`: pruebas de comportamiento con Playwright sobre `tests/fixtures/datos.json`.
- `npm run enlaces`: comprueba contra internet que responden los enlaces de los veredictos firmes.
- `python scripts/crear_fixture.py <datos.json> tests/fixtures/datos.json`: regenera el fixture.
