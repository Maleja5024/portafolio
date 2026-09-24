# Portafolio AJAX + DOM + Bootstrap + Retool — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el portafolio estático en un sitio de 4 páginas HTML con proyectos dinámicos desde una API de Retool, panel admin para agregar/eliminar proyectos y formulario de contacto con AJAX.

**Architecture:** Sitio estático (HTML + CSS propio + Bootstrap 5 por CDN) sin build. JavaScript plano en `js/`: `utils.js` (funciones puras), `api.js` (cliente `fetch` hacia Retool Workflows), `render.js` (construcción de DOM), y un script por página. Retool Database guarda los proyectos; dos Retool Workflows los exponen (uno público de lectura, uno protegido para administrar). Las pruebas son una página HTML (`tests/tests.html`) que se corre en Chrome headless, porque no hay Node instalado.

**Tech Stack:** HTML5, CSS3 (flex/grid), Bootstrap 5.3 + Bootstrap Icons 1.11 (CDN), Google Fonts, JavaScript ES2020, Retool (Database + Workflows), Formspree (contacto).

**Spec:** `docs/superpowers/specs/2026-09-24-portafolio-ajax-dom-design.md`

## Global Constraints

- Mínimo 4 páginas HTML: `index.html`, `proyectos.html`, `contacto.html`, `admin.html`.
- Cada proyecto tiene exactamente estos campos: `id`, `proyecto`, `contexto`, `rol`, `imagenes`.
- `rol` e `imagenes` viajan como **texto con un elemento por línea**; el cliente los convierte en listas.
- Los datos que vienen de la API se insertan con `textContent`/`createElement`, nunca con `innerHTML`.
- Imágenes válidas: URL `http(s)://...` o ruta `assets/...`. Cualquier otra cosa (`javascript:`, `data:`) se rechaza.
- Colores y tipografías salen de `css/tokens.css` (variables `--accent`, `--ink`, `--bg`, `--font-*`); no se escriben valores nuevos a mano salvo el hover del botón de marca.
- Texto de interfaz en español.
- Responsive verificado en 375, 768 y 1280 px.
- Fuera de alcance: editar proyectos existentes, subir archivos, sistema de usuarios, wireframe/mockup.

## Cambios respecto al spec (aprobar al revisar este plan)

Al verificar la documentación de Retool: los webhooks de Workflows siempre se llaman con `POST .../startTrigger` y se autentican con la cabecera `X-Workflow-Api-Key` (una clave generada por Retool por workflow). Por eso:
1. No hay verbos `GET/POST/DELETE`; hay **dos workflows** con `POST`: `listar` (su clave va en `js/config.js`, es de solo lectura y por tanto pública) y `admin` (acciones `verificar`, `crear`, `eliminar`).
2. La "clave de admin" es la **clave del workflow `admin`**: Retool la valida. No hay otro secreto propio, y esa clave nunca se escribe en el código; la escribe la autora en `admin.html` y se guarda en `sessionStorage`.

## Review Focus

Entradas que el spec no menciona pero que un usuario real va a producir (cada una tiene su prueba en la tarea indicada):
1. Contexto o nombre con HTML (`<script>`, `<b>`) → se ve como texto, no se ejecuta (Task 4).
2. Imagen con `javascript:alert(1)` o `data:` → validación la rechaza (Task 1).
3. Lista vacía de proyectos → mensaje "Aún no hay proyectos" (Task 4).
4. Clave de admin incorrecta → mensaje claro y no se guarda la clave (Task 6).
5. URL de imagen rota o proyecto con 1, 2 o 3 imágenes → la página no se rompe (Task 4).
6. Doble clic en "Guardar" / "Enviar" → un solo envío (Tasks 6 y 7).
7. Líneas en blanco extra en `rol`/`imagenes` → se ignoran (Task 1).

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `js/utils.js` | Funciones puras: `splitLines`, `ordinal`, `screensClass`, `imageAlt`, `isValidImageRef`, `validateProject` |
| `js/config.js` | URLs y claves públicas (`window.APP_CONFIG`) |
| `js/api.js` | `createApi(config, fetchFn)` → `listProjects`, `verifyKey`, `createProject`, `deleteProject` |
| `js/render.js` | `el()` y `renderProjectBlock(project, index)` |
| `js/proyectos.js` | Carga y pinta proyectos en `proyectos.html` |
| `js/admin.js` | Login por clave, formulario, lista, eliminar con modal |
| `js/contacto.js` | Validación y envío a Formspree |
| `css/bootstrap-overrides.css` | Puente Bootstrap ↔ tokens del portafolio |
| `tests/tests.html` + `tests/*.js` | Harness y pruebas |
| `scripts/seed.py` | Sube los 4 proyectos iniciales a Retool |
| `assets/data/projects.json` | Datos de los 4 proyectos actuales en el modelo nuevo |

---

### Task 0: Retool (base de datos, workflows, CORS) y config

**Files:**
- Create: `js/config.js`
- Create: `.gitignore` (ya existe; añadir línea)

**Interfaces:**
- Produces: `window.APP_CONFIG = { LIST_URL, LIST_KEY, ADMIN_URL, FORMSPREE_URL }`.

Esta tarea es manual en el navegador (la hace la autora, guiada) y termina con dos `curl` que pasan.

- [ ] **Step 1: Crear la tabla en Retool Database**

En Retool → Retool Database → New table → `proyectos`. Ejecutar en su editor SQL:

```sql
CREATE TABLE proyectos (
  id serial PRIMARY KEY,
  proyecto text NOT NULL,
  contexto text NOT NULL,
  rol text NOT NULL,
  imagenes text NOT NULL,
  creado timestamptz DEFAULT now()
);
```

- [ ] **Step 2: Workflow `listar` (público)**

Retool → Workflows → Create → nombre `listar`. Trigger: Webhook. Bloques:
1. `consulta` (Resource query, Retool Database): `SELECT id, proyecto, contexto, rol, imagenes FROM proyectos ORDER BY id;`
2. `respuesta` (Response): status `200`, body `{{ consulta.data }}`.

Deploy. En el trigger: activar autenticación por cabecera y **generar la API key**. Copiar la URL (`https://api.retool.com/v1/workflows/<id>/startTrigger`) y la key (`retool_wk_...`).

- [ ] **Step 3: Workflow `admin` (protegido)**

Nombre `admin`, trigger Webhook con API key. Bloques:
1. `validar` (Code / JavaScript):
```js
const b = startTrigger.data || {};
if (!['verificar', 'crear', 'eliminar'].includes(b.accion)) throw new Error('accion invalida');
if (b.accion === 'crear') {
  for (const k of ['proyecto', 'contexto', 'rol', 'imagenes']) {
    if (typeof b[k] !== 'string' || !b[k].trim()) throw new Error('falta ' + k);
  }
}
if (b.accion === 'eliminar' && !Number.isInteger(b.id)) throw new Error('id invalido');
return b;
```
2. Bloque Branch por `validar.data.accion`:
   - `verificar` → Response `200`, body `{ "ok": true }`.
   - `crear` → Resource query `insertar`: `INSERT INTO proyectos (proyecto, contexto, rol, imagenes) VALUES ({{ validar.data.proyecto }}, {{ validar.data.contexto }}, {{ validar.data.rol }}, {{ validar.data.imagenes }}) RETURNING id;` → Response `200`, body `{ "ok": true, "id": {{ insertar.data[0].id }} }`.
   - `eliminar` → Resource query `borrar`: `DELETE FROM proyectos WHERE id = {{ validar.data.id }};` → Response `200`, body `{ "ok": true }`.

(Los `{{ }}` dentro de una query SQL de Retool se envían como parámetros, no como texto pegado: no hay inyección SQL. Verifica los nombres de bloque en el editor.) Deploy y generar su API key.

- [ ] **Step 4: Verificar con curl que ambos workflows responden**

Sustituir `<...>` por los valores reales:

```bash
curl -s -X POST "<LIST_URL>" -H "X-Workflow-Api-Key: <LIST_KEY>" -H "Content-Type: application/json" -d '{}'
```
Expected: `[]` (o un JSON con la lista). Anotar la forma exacta: si viene envuelto (por ejemplo `{"data":[...]}`) es normal, `api.js` lo desenvuelve.

```bash
curl -s -X POST "<ADMIN_URL>" -H "X-Workflow-Api-Key: <ADMIN_KEY>" -H "Content-Type: application/json" -d '{"accion":"verificar"}'
```
Expected: `{"ok":true}` (posiblemente envuelto). Con una clave equivocada debe devolver 401/403.

- [ ] **Step 5: Verificar CORS (riesgo principal del spec)**

```bash
curl -s -i -X OPTIONS "<LIST_URL>" -H "Origin: https://maleja5024.github.io" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,x-workflow-api-key" | head -15
```
Expected: cabecera `access-control-allow-origin` con `*` o el origen, y `access-control-allow-headers` que incluya `x-workflow-api-key`. **Si falta**, parar: el navegador bloqueará las llamadas y hay que decidir con la autora una solución intermedia (por ejemplo un proxy serverless mínimo) antes de seguir. Anotar el resultado en el mensaje del commit.

- [ ] **Step 6: Crear `js/config.js` con los valores reales**

```js
window.APP_CONFIG = {
  LIST_URL: 'https://api.retool.com/v1/workflows/<ID-LISTAR>/startTrigger',
  LIST_KEY: 'retool_wk_<clave-listar>',
  ADMIN_URL: 'https://api.retool.com/v1/workflows/<ID-ADMIN>/startTrigger',
  FORMSPREE_URL: 'https://formspree.io/f/<id-formspree>'
};
```
(`FORMSPREE_URL` se completa en la Task 7; hasta entonces puede quedar con el texto `<id-formspree>`.) La clave de `admin` **no** va aquí.

- [ ] **Step 7: Commit**

```bash
git config user.name "María Alejandra Rozo Ayala"
git config user.email "ayalamaleja77@gmail.com"
printf '.baton/\n' >> .gitignore
git add js/config.js .gitignore
git commit -m "chore: configuración de Retool (CORS verificado)"
```

---

### Task 1: Utilidades puras y harness de pruebas

**Files:**
- Create: `js/utils.js`
- Create: `tests/tests.html`, `tests/harness.js`, `tests/utils.test.js`

**Interfaces:**
- Produces (todo en `window.Utils`):
  - `splitLines(text: any): string[]` — recorta y descarta líneas vacías.
  - `ordinal(n: number): string` — `1→'primer'`, `2→'segundo'`, … `10→'décimo'`, `11→'11.º'`.
  - `screensClass(count: number): string` — `2→'project-screens-2'`, otro→`'project-screens-4'`.
  - `imageAlt(nombre: string, i: number): string` — `"<nombre> — pantalla <i+1>"`.
  - `isValidImageRef(s: string): boolean`.
  - `validateProject({proyecto, contexto, rol, imagenes}): {[campo]: string}` — objeto vacío si es válido.
  - En `tests/harness.js`: `test(name, fn)`, `eq(actual, expected, msg)`.

- [ ] **Step 1: Crear el harness y la página de pruebas**

`tests/harness.js`:
```js
const _tests = [];
function test(name, fn) { _tests.push({ name, fn }); }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + e + ', recibido ' + a);
}
async function _run() {
  const ul = document.getElementById('out');
  let pass = 0;
  for (const t of _tests) {
    const li = document.createElement('li');
    try { await t.fn(); li.textContent = '✓ ' + t.name; li.className = 'ok'; pass++; }
    catch (e) { li.textContent = '✗ ' + t.name + ' — ' + e.message; li.className = 'fail'; }
    ul.appendChild(li);
  }
  document.getElementById('resumen').textContent = pass + '/' + _tests.length + ' pruebas pasan';
  document.title = pass === _tests.length ? 'TODAS OK' : 'HAY FALLOS';
}
window.addEventListener('load', _run);
```

`tests/tests.html`:
```html
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Pruebas</title>
<style>body{font-family:sans-serif;padding:16px}.ok{color:#1a7f37}.fail{color:#c00;font-weight:700}</style></head>
<body><h1 id="resumen">corriendo…</h1><ul id="out"></ul>
<script src="harness.js"></script>
<script src="../js/utils.js"></script>
<script src="../js/api.js"></script>
<script src="../js/render.js"></script>
<script src="utils.test.js"></script>
<script src="api.test.js"></script>
<script src="render.test.js"></script>
</body></html>
```
(Los archivos que aún no existen darán 404 en consola; no afecta.)

- [ ] **Step 2: Escribir las pruebas que fallan**

`tests/utils.test.js`:
```js
test('splitLines recorta y quita líneas vacías', () => {
  eq(Utils.splitLines('  a \n\n b\r\n   \nc'), ['a', 'b', 'c']);
});
test('splitLines tolera null/undefined', () => {
  eq(Utils.splitLines(null), []);
  eq(Utils.splitLines(undefined), []);
});
test('ordinal', () => {
  eq(Utils.ordinal(1), 'primer');
  eq(Utils.ordinal(4), 'cuarto');
  eq(Utils.ordinal(11), '11.º');
});
test('screensClass', () => {
  eq(Utils.screensClass(2), 'project-screens-2');
  eq(Utils.screensClass(1), 'project-screens-4');
  eq(Utils.screensClass(3), 'project-screens-4');
});
test('imageAlt', () => {
  eq(Utils.imageAlt('EanMob', 0), 'EanMob — pantalla 1');
});
test('isValidImageRef acepta https, http y assets/', () => {
  eq(Utils.isValidImageRef('https://x.com/a.png'), true);
  eq(Utils.isValidImageRef('http://x.com/a.png'), true);
  eq(Utils.isValidImageRef('assets/images/proyectos/p1/1.png'), true);
});
test('isValidImageRef rechaza javascript:, data: y rutas raras', () => {
  eq(Utils.isValidImageRef('javascript:alert(1)'), false);
  eq(Utils.isValidImageRef('data:image/png;base64,AAAA'), false);
  eq(Utils.isValidImageRef('//evil.com/a.png'), false);
  eq(Utils.isValidImageRef('foto.png'), false);
});
test('validateProject válido devuelve {}', () => {
  eq(Utils.validateProject({ proyecto: 'A', contexto: 'B', rol: 'C', imagenes: 'https://x.com/1.png' }), {});
});
test('validateProject marca cada campo vacío', () => {
  const e = Utils.validateProject({ proyecto: ' ', contexto: '', rol: '\n\n', imagenes: '' });
  eq(Object.keys(e).sort(), ['contexto', 'imagenes', 'proyecto', 'rol']);
});
test('validateProject rechaza imagen peligrosa aunque haya otra válida', () => {
  const e = Utils.validateProject({ proyecto: 'A', contexto: 'B', rol: 'C', imagenes: 'https://x.com/1.png\njavascript:alert(1)' });
  eq(Object.keys(e), ['imagenes']);
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Run (desde la raíz del portafolio):
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --virtual-time-budget=3000 --dump-dom "file://$PWD/tests/tests.html" | grep -o '<title>[^<]*</title>\|[0-9]*/[0-9]* pruebas pasan'
```
Expected: `<title>HAY FALLOS</title>` (o el resumen sin pasar) — `Utils` no está definido.

- [ ] **Step 4: Implementar `js/utils.js`**

```js
(function (root) {
  const ORDINALS = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];

  function splitLines(text) {
    return String(text == null ? '' : text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }
  function ordinal(n) { return ORDINALS[n - 1] || n + '.º'; }
  function screensClass(count) { return count === 2 ? 'project-screens-2' : 'project-screens-4'; }
  function imageAlt(nombre, i) { return nombre + ' — pantalla ' + (i + 1); }
  function isValidImageRef(s) { return /^https?:\/\/\S+$/i.test(s) || /^assets\/\S+$/.test(s); }

  function validateProject(p) {
    const errors = {};
    if (!String(p.proyecto || '').trim()) errors.proyecto = 'Escribe el nombre del proyecto.';
    if (!String(p.contexto || '').trim()) errors.contexto = 'Escribe el contexto del proyecto.';
    if (splitLines(p.rol).length === 0) errors.rol = 'Escribe al menos un punto de tu rol.';
    const imgs = splitLines(p.imagenes);
    if (imgs.length === 0) errors.imagenes = 'Agrega al menos una imagen.';
    else if (!imgs.every(isValidImageRef)) errors.imagenes = 'Cada línea debe ser una URL http(s) o una ruta que empiece por assets/.';
    return errors;
  }

  root.Utils = { splitLines, ordinal, screensClass, imageAlt, isValidImageRef, validateProject };
})(window);
```

- [ ] **Step 5: Correr y verificar que pasan**

Mismo comando del Step 3. Expected: `<title>TODAS OK</title>` y `10/10 pruebas pasan`.

- [ ] **Step 6: Commit**

```bash
git add js/utils.js tests/
git commit -m "feat: utilidades puras y harness de pruebas"
```

---

### Task 2: Cliente de API (AJAX)

**Files:**
- Create: `js/api.js`, `tests/api.test.js`

**Interfaces:**
- Consumes: `Utils.splitLines`.
- Produces: `window.createApi(config, fetchFn?)` → objeto con
  - `listProjects(): Promise<Project[]>` donde `Project = {id:number, proyecto:string, contexto:string, rol:string, imagenes:string[]}`.
  - `verifyKey(key: string): Promise<true>`.
  - `createProject(key: string, p: {proyecto, contexto, rol, imagenes: string}): Promise<number>` (id creado).
  - `deleteProject(key: string, id: number): Promise<true>`.
  - Todas lanzan `Error` con `.status` (número HTTP) si la respuesta no es `ok`; `listProjects` lanza `Error('Respuesta inesperada')` si no llega un arreglo.

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/api.test.js`:
```js
const CFG = { LIST_URL: 'https://r/list', LIST_KEY: 'kL', ADMIN_URL: 'https://r/admin' };
function fakeFetch(status, body) {
  const calls = [];
  const fn = async (url, opts) => { calls.push({ url, opts }); return { ok: status >= 200 && status < 300, status, json: async () => body }; };
  fn.calls = calls;
  return fn;
}

test('listProjects manda POST con la clave pública y normaliza imagenes', async () => {
  const f = fakeFetch(200, [{ id: 1, proyecto: 'A', contexto: 'B', rol: 'x\ny', imagenes: 'u1\n\nu2' }]);
  const list = await createApi(CFG, f).listProjects();
  eq(f.calls[0].url, 'https://r/list');
  eq(f.calls[0].opts.method, 'POST');
  eq(f.calls[0].opts.headers['X-Workflow-Api-Key'], 'kL');
  eq(list, [{ id: 1, proyecto: 'A', contexto: 'B', rol: 'x\ny', imagenes: ['u1', 'u2'] }]);
});
test('listProjects desenvuelve {data: [...]}', async () => {
  const list = await createApi(CFG, fakeFetch(200, { data: [{ id: 2, proyecto: 'P', contexto: 'C', rol: 'R', imagenes: 'u' }] })).listProjects();
  eq(list.length, 1);
});
test('listProjects lanza si no llega un arreglo', async () => {
  let msg = '';
  try { await createApi(CFG, fakeFetch(200, { algo: 1 })).listProjects(); } catch (e) { msg = e.message; }
  eq(msg, 'Respuesta inesperada');
});
test('createProject envía accion crear con la clave de admin y devuelve el id', async () => {
  const f = fakeFetch(200, { ok: true, id: 7 });
  const id = await createApi(CFG, f).createProject('kA', { proyecto: 'A', contexto: 'B', rol: 'C', imagenes: 'u' });
  eq(id, 7);
  eq(f.calls[0].url, 'https://r/admin');
  eq(f.calls[0].opts.headers['X-Workflow-Api-Key'], 'kA');
  eq(JSON.parse(f.calls[0].opts.body), { accion: 'crear', proyecto: 'A', contexto: 'B', rol: 'C', imagenes: 'u' });
});
test('deleteProject envía accion eliminar con id numérico', async () => {
  const f = fakeFetch(200, { ok: true });
  await createApi(CFG, f).deleteProject('kA', 5);
  eq(JSON.parse(f.calls[0].opts.body), { accion: 'eliminar', id: 5 });
});
test('clave incorrecta: el error trae status 401', async () => {
  let status = 0;
  try { await createApi(CFG, fakeFetch(401, {})).verifyKey('mala'); } catch (e) { status = e.status; }
  eq(status, 401);
});
test('verifyKey devuelve true con clave buena', async () => {
  eq(await createApi(CFG, fakeFetch(200, { ok: true })).verifyKey('buena'), true);
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Mismo comando headless de la Task 1, Step 3. Expected: `HAY FALLOS` (`createApi is not defined`).

- [ ] **Step 3: Implementar `js/api.js`**

```js
(function (root) {
  function unwrap(data) {
    return data && !Array.isArray(data) && data.data !== undefined ? data.data : data;
  }

  function createApi(config, fetchFn) {
    const doFetch = fetchFn || function () { return fetch.apply(null, arguments); };

    async function call(url, key, body) {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workflow-Api-Key': key },
        body: JSON.stringify(body || {})
      });
      if (!res.ok) {
        const err = new Error('Error ' + res.status);
        err.status = res.status;
        throw err;
      }
      return unwrap(await res.json());
    }

    return {
      async listProjects() {
        const data = await call(config.LIST_URL, config.LIST_KEY, {});
        if (!Array.isArray(data)) throw new Error('Respuesta inesperada');
        return data.map(p => ({
          id: p.id,
          proyecto: p.proyecto,
          contexto: p.contexto,
          rol: p.rol,
          imagenes: root.Utils.splitLines(p.imagenes)
        }));
      },
      async verifyKey(key) {
        await call(config.ADMIN_URL, key, { accion: 'verificar' });
        return true;
      },
      async createProject(key, p) {
        const data = await call(config.ADMIN_URL, key, {
          accion: 'crear', proyecto: p.proyecto, contexto: p.contexto, rol: p.rol, imagenes: p.imagenes
        });
        return data.id;
      },
      async deleteProject(key, id) {
        await call(config.ADMIN_URL, key, { accion: 'eliminar', id: id });
        return true;
      }
    };
  }

  root.createApi = createApi;
})(window);
```

- [ ] **Step 4: Correr y verificar que pasan**

Mismo comando. Expected: `TODAS OK` y `17/17 pruebas pasan`.

- [ ] **Step 5: Commit**

```bash
git add js/api.js tests/api.test.js
git commit -m "feat: cliente AJAX de la API de Retool"
```

---

### Task 3: Bootstrap, iconos y división en páginas

**Files:**
- Create: `css/bootstrap-overrides.css`, `proyectos.html`, `contacto.html`
- Modify: `index.html`
- Delete: `css/nav.css`

**Interfaces:**
- Produces: las 3 páginas comparten `<head>` (Bootstrap + Icons + CSS propios) y el mismo navbar. Los IDs `lista-proyectos` y `estado-proyectos` en `proyectos.html` los usa la Task 4; `formulario-contacto`, `estado-contacto` en `contacto.html` los usa la Task 7.

- [ ] **Step 1: Crear `css/bootstrap-overrides.css`**

```css
/* Puente entre Bootstrap y los tokens del portafolio */
:root {
  --bs-body-font-family: var(--font-body);
  --bs-body-bg: var(--bg);
  --bs-body-color: var(--ink);
  --bs-border-color: var(--gray-lt);
}

.site-nav {
  background: var(--bg);
  border-bottom: 1px solid var(--gray-lt);
  padding: 12px 0;
}
.site-nav .navbar-brand {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.02em;
  margin: 0;
  white-space: normal;
}
.site-nav .nav-link {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  opacity: 0.6;
  transition: opacity 0.2s;
}
.site-nav .nav-link:hover,
.site-nav .nav-link.active { opacity: 1; }

.page-top { padding-top: 96px; }

.btn-brand {
  --bs-btn-bg: var(--accent);
  --bs-btn-border-color: var(--accent);
  --bs-btn-color: var(--white);
  --bs-btn-hover-bg: #a86363;
  --bs-btn-hover-border-color: #a86363;
  --bs-btn-hover-color: var(--white);
  --bs-btn-active-bg: #a86363;
  --bs-btn-active-border-color: #a86363;
  --bs-btn-active-color: var(--white);
  --bs-btn-disabled-bg: var(--accent);
  --bs-btn-disabled-border-color: var(--accent);
  font-family: var(--font-display);
  font-weight: 600;
  border-radius: var(--radius-pill);
}

.form-control,
.form-control:focus {
  border-radius: var(--radius);
  background: var(--white);
}
.form-control:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 0.2rem var(--accent-lt);
}
.form-label { font-family: var(--font-display); font-weight: 600; font-size: 14px; }
```

- [ ] **Step 2: Crear `proyectos.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proyectos — María Alejandra Rozo Ayala</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet" />
  <link rel="stylesheet" href="css/tokens.css" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/utilities.css" />
  <link rel="stylesheet" href="css/projects.css" />
  <link rel="stylesheet" href="css/bootstrap-overrides.css" />
</head>
<body>
  <nav class="navbar navbar-expand-md fixed-top site-nav">
    <div class="container-fluid px-3 px-md-5">
      <a class="navbar-brand" href="index.html">Diseño de Experiencias Digitales con Significado</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu" aria-controls="menu" aria-expanded="false" aria-label="Abrir menú">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse justify-content-end" id="menu">
        <ul class="navbar-nav gap-md-3">
          <li class="nav-item"><a class="nav-link" href="index.html"><i class="bi bi-house"></i> Inicio</a></li>
          <li class="nav-item"><a class="nav-link active" href="proyectos.html" aria-current="page"><i class="bi bi-collection"></i> Proyectos</a></li>
          <li class="nav-item"><a class="nav-link" href="contacto.html"><i class="bi bi-envelope"></i> Contacto</a></li>
        </ul>
      </div>
    </div>
  </nav>

  <main class="page-top">
    <section class="section proyectos" id="proyectos">
      <div class="section-inner">
        <p class="section-eyebrow">portafolio de proyectos</p>
        <h2 class="section-title-xl">proyectos</h2>
        <p class="section-intro">Estos proyectos muestran mi enfoque para resolver retos de usabilidad a través de investigación, diseño de interfaces y recorridos de usuario estructurados. Son proyectos independientes, de iniciativa propia, creados para practicar y refinar mis habilidades de prototipado.</p>
      </div>
      <div id="estado-proyectos" class="section-inner" role="status" aria-live="polite"></div>
      <div id="lista-proyectos"></div>
    </section>
  </main>

  <footer class="footer">
    <span class="nav-tagline">Diseño de Experiencias Digitales con Significado</span>
    <span>2026 María Alejandra Rozo Ayala · <a href="admin.html"><i class="bi bi-lock"></i> Admin</a></span>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/config.js"></script>
  <script src="js/api.js"></script>
  <script src="js/render.js"></script>
  <script src="js/proyectos.js"></script>
</body>
</html>
```

- [ ] **Step 3: Crear `contacto.html`** (con el mismo `<head>` y navbar; `contact.css` en vez de `projects.css`; "Contacto" activo)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contacto — María Alejandra Rozo Ayala</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet" />
  <link rel="stylesheet" href="css/tokens.css" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/utilities.css" />
  <link rel="stylesheet" href="css/contact.css" />
  <link rel="stylesheet" href="css/bootstrap-overrides.css" />
</head>
<body>
  <nav class="navbar navbar-expand-md fixed-top site-nav">
    <div class="container-fluid px-3 px-md-5">
      <a class="navbar-brand" href="index.html">Diseño de Experiencias Digitales con Significado</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu" aria-controls="menu" aria-expanded="false" aria-label="Abrir menú">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse justify-content-end" id="menu">
        <ul class="navbar-nav gap-md-3">
          <li class="nav-item"><a class="nav-link" href="index.html"><i class="bi bi-house"></i> Inicio</a></li>
          <li class="nav-item"><a class="nav-link" href="proyectos.html"><i class="bi bi-collection"></i> Proyectos</a></li>
          <li class="nav-item"><a class="nav-link active" href="contacto.html" aria-current="page"><i class="bi bi-envelope"></i> Contacto</a></li>
        </ul>
      </div>
    </div>
  </nav>

  <main class="page-top">
    <section class="section contacto" id="contacto">
      <div class="section-inner contacto-inner">
        <h2 class="contacto-title">gracias</h2>
        <p class="contacto-sub">Si crees que podemos crear algo único juntos, no dudes en contactarme. ¡Estoy lista para empezar!</p>

        <form id="formulario-contacto" class="w-100 text-start mb-5" style="max-width: 560px" novalidate>
          <div class="row g-3">
            <div class="col-md-6">
              <label for="nombre" class="form-label">Nombre</label>
              <input type="text" class="form-control" id="nombre" name="nombre" required minlength="2" autocomplete="name" />
              <div class="invalid-feedback">Escribe tu nombre.</div>
            </div>
            <div class="col-md-6">
              <label for="correo" class="form-label">Correo</label>
              <input type="email" class="form-control" id="correo" name="email" required autocomplete="email" />
              <div class="invalid-feedback">Escribe un correo válido.</div>
            </div>
            <div class="col-12">
              <label for="mensaje" class="form-label">Mensaje</label>
              <textarea class="form-control" id="mensaje" name="mensaje" rows="5" required minlength="10"></textarea>
              <div class="invalid-feedback">Cuéntame un poco más (mínimo 10 caracteres).</div>
            </div>
            <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="display:none" aria-hidden="true" />
            <div class="col-12">
              <button type="submit" class="btn btn-brand px-4" id="btn-enviar"><i class="bi bi-send"></i> Enviar mensaje</button>
            </div>
          </div>
          <div id="estado-contacto" class="mt-3" role="status" aria-live="polite"></div>
        </form>

        <div class="contact-links">
          <a href="https://instagram.com/malejaa_ar" class="contact-link" target="_blank" rel="noopener noreferrer"><i class="bi bi-instagram"></i> @malejaa_ar</a>
          <a href="mailto:ayalamaleja77@gmail.com" class="contact-link"><i class="bi bi-envelope"></i> ayalamaleja77@gmail.com</a>
          <a href="https://www.linkedin.com/in/maría-alejandra-rozo-ayala/" class="contact-link" target="_blank" rel="noopener noreferrer"><i class="bi bi-linkedin"></i> Maria Alejandra Rozo Ayala</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <span class="nav-tagline">Diseño de Experiencias Digitales con Significado</span>
    <span>2026 María Alejandra Rozo Ayala · <a href="admin.html"><i class="bi bi-lock"></i> Admin</a></span>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="js/config.js"></script>
  <script src="js/contacto.js"></script>
</body>
</html>
```

- [ ] **Step 4: Recortar `index.html` (secciones movidas) y cambiar su cabecera y navbar**

Ejecutar desde la raíz (las secciones de proyectos, marquee final y contacto salen de `index.html`; los números de línea vienen del archivo actual y se verifican antes):

```bash
sed -n '441p;449p;597p;624,631p' index.html    # 441: divisor, 449: section proyectos, 597: section contacto, 624+: footer y cierre
grep -n "<!-- Divisor ondulado -->" index.html | tail -1
```
Expected: la última línea de `grep` es `441:...`. Luego:

```bash
{ sed -n '1,439p' index.html; printf '\n'; sed -n '624,631p' index.html; } > /tmp/index.nuevo && mv /tmp/index.nuevo index.html
tail -12 index.html
```
Expected: termina en `<footer ...>…</footer>`, `</body>`, `</html>`; ya no contiene `id="proyectos"` ni `id="contacto"` (`grep -c 'id="proyectos"\|id="contacto"' index.html` → `0`).

Luego editar manualmente `index.html`:
1. En `<head>`: quitar `<link rel="stylesheet" href="css/nav.css" />`, `projects.css` y `contact.css`; añadir antes de `tokens.css` los dos `<link>` de Bootstrap y Bootstrap Icons (copiar de `proyectos.html`) y, después de `experience.css`, `<link rel="stylesheet" href="css/bootstrap-overrides.css" />`.
2. Reemplazar el bloque `<nav class="nav">…</nav>` por el navbar de `proyectos.html` con **Inicio** activo (`class="nav-link active" aria-current="page"` en Inicio y sin `active` en Proyectos).
3. En el footer añadir `· <a href="admin.html"><i class="bi bi-lock"></i> Admin</a>` como en las otras páginas.
4. Antes de `</body>` añadir `<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>`.
5. En el `hero`, verificar (paso siguiente) que no quede tapado por el navbar.

- [ ] **Step 5: Eliminar `css/nav.css`**

```bash
git rm css/nav.css
grep -rn "nav.css" *.html    # Expected: sin resultados
```

- [ ] **Step 6: Verificación visual manual**

```bash
open index.html proyectos.html contacto.html
```
Comprobar en cada página: el navbar fijo se ve con tus colores, no tapa el primer contenido, el menú se colapsa a botón hamburguesa por debajo de 768 px y los enlaces funcionan entre las 3 páginas. En `contacto.html` el formulario se ve y aún no envía (Task 7). `proyectos.html` muestra solo el título (Task 4 dibuja las tarjetas).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Bootstrap, iconos y división en páginas index/proyectos/contacto"
```

---

### Task 4: Proyectos dinámicos (DOM)

**Files:**
- Create: `js/render.js`, `js/proyectos.js`, `tests/render.test.js`

**Interfaces:**
- Consumes: `Utils.*`, `createApi`, `window.APP_CONFIG`.
- Produces: `window.el(tag, attrs?, children?)` → `HTMLElement` (atributos por `setAttribute`, hijos string → nodo de texto); `window.renderProjectBlock(project, index): HTMLElement` con el mismo marcado que usaba `index.html` (`.project-block`, `.project-label`, `.project-content`, `.project-meta`, `.project-col`, `.project-screens`, `.project-img`).

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/render.test.js`:
```js
const P = (over) => Object.assign({ id: 3, proyecto: 'EanMob', contexto: 'Ctx', rol: 'a\nb', imagenes: ['assets/x/1.png', 'assets/x/2.png'] }, over || {});

test('renderProjectBlock: número, ordinal, título, contexto y rol en lista', () => {
  const b = renderProjectBlock(P(), 0);
  eq(b.querySelector('.project-num').textContent, '01');
  eq(b.querySelector('.project-name').textContent, 'primerproyecto');
  eq(b.querySelector('.project-subtitle').textContent, 'EanMob');
  eq(b.querySelectorAll('.project-col')[0].querySelector('p').textContent, 'Ctx');
  eq(Array.from(b.querySelectorAll('.project-col')[1].querySelectorAll('li')).map(li => li.textContent), ['a', 'b']);
  eq(b.dataset.project, '3');
});
test('renderProjectBlock: el segundo proyecto lleva clase alt', () => {
  eq(renderProjectBlock(P(), 1).classList.contains('alt'), true);
  eq(renderProjectBlock(P(), 0).classList.contains('alt'), false);
});
test('renderProjectBlock: HTML en los textos se muestra como texto y no se ejecuta', () => {
  const b = renderProjectBlock(P({ proyecto: '<img src=x onerror=alert(1)>', contexto: '<script>alert(1)</script>', rol: '<b>hola</b>' }), 0);
  eq(b.querySelectorAll('script').length, 0);
  eq(b.querySelectorAll('.project-subtitle img').length, 0);
  eq(b.querySelector('.project-subtitle').textContent, '<img src=x onerror=alert(1)>');
  eq(b.querySelector('li').textContent, '<b>hola</b>');
});
test('renderProjectBlock: clase de grilla según cantidad de imágenes', () => {
  eq(renderProjectBlock(P({ imagenes: ['assets/a.png', 'assets/b.png'] }), 0).querySelector('.project-screens').classList.contains('project-screens-2'), true);
  eq(renderProjectBlock(P({ imagenes: ['assets/a.png'] }), 0).querySelector('.project-screens').classList.contains('project-screens-4'), true);
  eq(renderProjectBlock(P({ imagenes: ['assets/a.png', 'assets/b.png', 'assets/c.png'] }), 0).querySelectorAll('img').length, 3);
});
test('renderProjectBlock: imágenes con alt descriptivo', () => {
  const imgs = renderProjectBlock(P(), 0).querySelectorAll('img.project-img');
  eq(imgs[0].getAttribute('alt'), 'EanMob — pantalla 1');
  eq(imgs[1].getAttribute('alt'), 'EanMob — pantalla 2');
});
test('renderProjectBlock: si una imagen falla al cargar se quita sin romper el bloque', () => {
  const b = renderProjectBlock(P(), 0);
  const first = b.querySelector('img.project-img');
  first.dispatchEvent(new Event('error'));
  eq(b.querySelectorAll('img.project-img').length, 1);
});
test('renderProjectBlock: sin imágenes no crea la grilla', () => {
  eq(renderProjectBlock(P({ imagenes: [] }), 0).querySelector('.project-screens'), null);
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Mismo comando headless de la Task 1, Step 3. Expected: `HAY FALLOS` (`renderProjectBlock is not defined`).

- [ ] **Step 3: Implementar `js/render.js`**

```js
(function (root) {
  const U = root.Utils;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(k => node.setAttribute(k, attrs[k]));
    (children || []).forEach(c => node.append(c));
    return node;
  }

  function renderProjectBlock(p, index) {
    const block = el('div', {
      class: 'project-block' + (index % 2 === 1 ? ' alt' : ''),
      'data-project': String(p.id)
    });

    block.append(el('div', { class: 'project-label' }, [
      el('span', { class: 'project-num' }, [String(index + 1).padStart(2, '0')]),
      el('h3', { class: 'project-name' }, [U.ordinal(index + 1), el('br'), 'proyecto']),
      el('p', { class: 'project-subtitle' }, [p.proyecto])
    ]));

    const meta = el('div', { class: 'project-meta' }, [
      el('div', { class: 'project-col' }, [el('h4', {}, ['Contexto']), el('p', {}, [p.contexto])]),
      el('div', { class: 'project-col' }, [
        el('h4', {}, ['Mi rol']),
        el('ul', {}, U.splitLines(p.rol).map(line => el('li', {}, [line])))
      ])
    ]);

    const content = el('div', { class: 'project-content' }, [meta]);

    if (p.imagenes.length > 0) {
      const screens = el('div', { class: 'project-screens ' + U.screensClass(p.imagenes.length) });
      p.imagenes.forEach((src, i) => {
        const img = el('img', { src: src, alt: U.imageAlt(p.proyecto, i), class: 'project-img', loading: 'lazy' });
        img.addEventListener('load', () => {
          if (img.naturalWidth > img.naturalHeight) img.classList.add('project-img-landscape');
        });
        img.addEventListener('error', () => img.remove());
        screens.append(img);
      });
      content.append(screens);
    }

    block.append(content);
    return block;
  }

  root.el = el;
  root.renderProjectBlock = renderProjectBlock;
})(window);
```

- [ ] **Step 4: Correr y verificar que pasan**

Mismo comando. Expected: `TODAS OK` y `24/24 pruebas pasan`.

- [ ] **Step 5: Implementar `js/proyectos.js`**

```js
document.addEventListener('DOMContentLoaded', async function () {
  const api = createApi(APP_CONFIG);
  const lista = document.getElementById('lista-proyectos');
  const estado = document.getElementById('estado-proyectos');

  function mostrarEstado(html, clase) {
    estado.replaceChildren();
    if (!html) return;
    const box = el('div', { class: clase, role: clase.includes('danger') ? 'alert' : 'status' });
    html.forEach(c => box.append(c));
    estado.append(box);
  }

  async function cargar() {
    lista.replaceChildren();
    mostrarEstado([
      el('span', { class: 'spinner-border spinner-border-sm me-2', 'aria-hidden': 'true' }),
      'Cargando proyectos…'
    ], 'text-secondary');
    try {
      const proyectos = await api.listProjects();
      if (proyectos.length === 0) {
        mostrarEstado(['Aún no hay proyectos publicados.'], 'alert alert-secondary');
        return;
      }
      mostrarEstado(null);
      proyectos.forEach((p, i) => lista.append(renderProjectBlock(p, i)));
    } catch (e) {
      const retry = el('button', { type: 'button', class: 'btn btn-sm btn-outline-dark ms-3' }, ['Reintentar']);
      retry.addEventListener('click', cargar);
      mostrarEstado(['No pude cargar los proyectos. Revisa tu conexión e inténtalo de nuevo.', retry], 'alert alert-danger d-flex align-items-center');
    }
  }

  cargar();
});
```

- [ ] **Step 6: Verificar contra la API real (después de la Task 5) y los estados**

Ahora, sin datos: `open proyectos.html` → debe mostrar "Aún no hay proyectos publicados." Para ver el error, cambiar temporalmente `LIST_URL` a una URL inválida, recargar (aparece el alert con "Reintentar") y restaurar el valor.

- [ ] **Step 7: Commit**

```bash
git add js/render.js js/proyectos.js tests/render.test.js
git commit -m "feat: proyectos dinámicos con AJAX y DOM"
```

---

### Task 5: Migrar los 4 proyectos actuales a Retool

**Files:**
- Modify: `assets/data/projects.json` (reemplazar contenido)
- Create: `scripts/seed.py`

**Interfaces:**
- Consumes: workflow `admin` con acción `crear` (Task 0).
- Produces: 4 filas en la tabla `proyectos`, cuyas imágenes son rutas `assets/images/proyectos/pN/M.png` (relativas a las páginas de la raíz).

- [ ] **Step 1: Reemplazar `assets/data/projects.json`**

```json
[
  {
    "proyecto": "EanMob — Plataforma de Movilidad Compartida Sostenible",
    "contexto": "EanMob es una plataforma móvil diseñada para conectar estudiantes de la Universidad EAN que comparten rutas de desplazamiento. El objetivo es reducir el tráfico, disminuir emisiones de carbono y crear comunidad universitaria a través de la movilidad sostenible.",
    "rol": "Flujo de búsqueda y publicación de viajes\nPantalla de inicio de sesión y creación de cuenta\nDiseño del formulario con validación de errores\nJerarquía visual clara y elementos de confianza",
    "imagenes": "assets/images/proyectos/p1/1.png\nassets/images/proyectos/p1/2.png\nassets/images/proyectos/p1/3.png\nassets/images/proyectos/p1/4.png"
  },
  {
    "proyecto": "Dotech — Radicador Documental Inteligente",
    "contexto": "Dotech (Edotech) es una plataforma de gestión documental para entidades públicas colombianas. Permite radicar, asignar y hacer seguimiento de documentos con control de vencimientos, trazabilidad completa y auditoría integrada.",
    "rol": "Rediseño del flujo de radicación y seguimiento\nPantalla de inicio de sesión institucional\nPanel de control con estados (En Gestión, Asignado, En Revisión)\nDashboard con métricas y tabla de radicados",
    "imagenes": "assets/images/proyectos/p2/1.png\nassets/images/proyectos/p2/2.png"
  },
  {
    "proyecto": "Fundación Ramírez Moreno — Rediseño Web",
    "contexto": "Rediseño completo del sitio web de la Fundación Ramírez Moreno, una organización social que apoya instituciones colombianas a través de proyectos, donaciones y fortalecimiento institucional. El trabajo incluyó diagnóstico UX, arquitectura de información y sistema de diseño.",
    "rol": "Sistema de diseño con paleta de color y tipografía\nFlujos de usuario para organizaciones postulantes\nRediseño de páginas: inicio, líneas de apoyo e inscripciones\nMejoras de accesibilidad y arquitectura de información",
    "imagenes": "assets/images/proyectos/p3/2.png\nassets/images/proyectos/p3/3.png\nassets/images/proyectos/p3/4.png\nassets/images/proyectos/p3/5.png"
  },
  {
    "proyecto": "GrowLink × Avellanedas Go — Sistema de Diseño y Sitio Web",
    "contexto": "GrowLink es una plataforma de reseñas para negocios locales. Avellanedas Go es una panadería artesanal en La Calera, Cundinamarca. El proyecto implicó construir un sistema de diseño completo para GrowLink y diseñar el sitio web de Avellanedas Go como caso de uso real.",
    "rol": "Definición de tokens de color, tipografía y componentes\nDiseño de componentes: formularios, navegación, tarjetas\nSitio web de Avellanedas Go: inicio y página de menú\nIntegración de identidad de marca artesanal al sistema digital",
    "imagenes": "assets/images/proyectos/p4/1.png\nassets/images/proyectos/p4/2.png\nassets/images/proyectos/p4/3.png\nassets/images/proyectos/p4/4.png"
  }
]
```

- [ ] **Step 2: Crear `scripts/seed.py`**

```python
#!/usr/bin/env python3
"""Sube los proyectos de assets/data/projects.json a Retool (workflow admin).
Uso: RETOOL_ADMIN_URL=... RETOOL_ADMIN_KEY=... python3 scripts/seed.py
"""
import json, os, sys, urllib.request, urllib.error

url = os.environ.get("RETOOL_ADMIN_URL")
key = os.environ.get("RETOOL_ADMIN_KEY")
if not url or not key:
    sys.exit("Faltan RETOOL_ADMIN_URL y RETOOL_ADMIN_KEY")

with open("assets/data/projects.json", encoding="utf-8") as f:
    projects = json.load(f)

for p in projects:
    body = json.dumps({"accion": "crear", **p}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json", "X-Workflow-Api-Key": key})
    try:
        with urllib.request.urlopen(req) as res:
            print("OK", p["proyecto"][:40], res.read().decode()[:80])
    except urllib.error.HTTPError as e:
        sys.exit("Error %s en %s: %s" % (e.code, p["proyecto"][:40], e.read().decode()[:200]))
```

- [ ] **Step 3: Ejecutarlo una sola vez**

```bash
RETOOL_ADMIN_URL="<ADMIN_URL>" RETOOL_ADMIN_KEY="<ADMIN_KEY>" python3 scripts/seed.py
```
Expected: 4 líneas `OK ...` con un id cada una. **No volver a correrlo** (duplicaría filas). Si falla a mitad, borrar las filas creadas en Retool antes de reintentar.

- [ ] **Step 4: Verificar en el navegador**

`open proyectos.html`. Expected: 4 bloques idénticos en estructura a los que había en `index.html` (número, ordinal, subtítulo, contexto, rol en lista, imágenes). Comparar contra el commit inicial: `git show 10bedee:index.html | sed -n '449,582p'`.

- [ ] **Step 5: Commit** (la clave nunca se escribe en archivos)

```bash
git add assets/data/projects.json scripts/seed.py
git commit -m "feat: migrar los 4 proyectos actuales al modelo de Retool"
```

---

### Task 6: Panel de administración

**Files:**
- Create: `admin.html`, `js/admin.js`

**Interfaces:**
- Consumes: `createApi`, `Utils.validateProject`, `renderProject` no (usa su propia lista), `el`, `bootstrap.Modal`, `sessionStorage['adminKey']`.
- Produces: página `admin.html` con IDs `panel-login`, `form-login`, `input-clave`, `estado-login`, `panel-admin`, `btn-salir`, `form-proyecto`, `estado-admin`, `lista-admin`, `modal-eliminar`, `modal-nombre`, `btn-confirmar-eliminar`.

- [ ] **Step 1: Crear `admin.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>Admin — María Alejandra Rozo Ayala</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet" />
  <link rel="stylesheet" href="css/tokens.css" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/utilities.css" />
  <link rel="stylesheet" href="css/bootstrap-overrides.css" />
</head>
<body>
  <nav class="navbar navbar-expand-md fixed-top site-nav">
    <div class="container-fluid px-3 px-md-5">
      <a class="navbar-brand" href="index.html">Diseño de Experiencias Digitales con Significado</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu" aria-controls="menu" aria-expanded="false" aria-label="Abrir menú">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse justify-content-end" id="menu">
        <ul class="navbar-nav gap-md-3">
          <li class="nav-item"><a class="nav-link" href="index.html"><i class="bi bi-house"></i> Inicio</a></li>
          <li class="nav-item"><a class="nav-link" href="proyectos.html"><i class="bi bi-collection"></i> Proyectos</a></li>
          <li class="nav-item"><a class="nav-link" href="contacto.html"><i class="bi bi-envelope"></i> Contacto</a></li>
        </ul>
      </div>
    </div>
  </nav>

  <main class="page-top pb-5">
    <div class="container" style="max-width: 860px">
      <h1 class="section-title-xl">admin</h1>

      <section id="panel-login" class="card p-4 mb-4">
        <form id="form-login" novalidate>
          <label for="input-clave" class="form-label">Clave de administración</label>
          <div class="input-group">
            <input type="password" class="form-control" id="input-clave" autocomplete="off" required />
            <button class="btn btn-brand" type="submit" id="btn-entrar"><i class="bi bi-box-arrow-in-right"></i> Entrar</button>
          </div>
          <div id="estado-login" class="mt-3" role="status" aria-live="polite"></div>
        </form>
      </section>

      <div id="panel-admin" hidden>
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2 class="h4 m-0">Agregar proyecto</h2>
          <button type="button" class="btn btn-outline-dark btn-sm" id="btn-salir"><i class="bi bi-box-arrow-right"></i> Salir</button>
        </div>

        <form id="form-proyecto" class="card p-4 mb-4" novalidate>
          <div class="mb-3">
            <label for="f-proyecto" class="form-label">Proyecto</label>
            <input type="text" class="form-control" id="f-proyecto" placeholder="Nombre — descripción corta" />
            <div class="invalid-feedback" id="err-proyecto"></div>
          </div>
          <div class="mb-3">
            <label for="f-contexto" class="form-label">Contexto</label>
            <textarea class="form-control" id="f-contexto" rows="4"></textarea>
            <div class="invalid-feedback" id="err-contexto"></div>
          </div>
          <div class="mb-3">
            <label for="f-rol" class="form-label">Mi rol <span class="text-secondary fw-normal">(un punto por línea)</span></label>
            <textarea class="form-control" id="f-rol" rows="4"></textarea>
            <div class="invalid-feedback" id="err-rol"></div>
          </div>
          <div class="mb-3">
            <label for="f-imagenes" class="form-label">Imágenes <span class="text-secondary fw-normal">(una URL o ruta assets/… por línea)</span></label>
            <textarea class="form-control" id="f-imagenes" rows="4" placeholder="https://res.cloudinary.com/…/pantalla1.png"></textarea>
            <div class="invalid-feedback" id="err-imagenes"></div>
          </div>
          <div><button type="submit" class="btn btn-brand" id="btn-guardar"><i class="bi bi-plus-lg"></i> Guardar proyecto</button></div>
          <div id="estado-admin" class="mt-3" role="status" aria-live="polite"></div>
        </form>

        <h2 class="h4 mb-3">Proyectos publicados</h2>
        <ul class="list-group" id="lista-admin"></ul>
      </div>
    </div>
  </main>

  <div class="modal fade" id="modal-eliminar" tabindex="-1" aria-labelledby="modal-titulo" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header"><h2 class="modal-title h5" id="modal-titulo">Eliminar proyecto</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
        <div class="modal-body">¿Seguro que quieres eliminar <strong id="modal-nombre"></strong>? Esta acción no se puede deshacer.</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-dark" data-bs-dismiss="modal">Cancelar</button>
          <button type="button" class="btn btn-danger" id="btn-confirmar-eliminar"><i class="bi bi-trash"></i> Eliminar</button>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/config.js"></script>
  <script src="js/api.js"></script>
  <script src="js/render.js"></script>
  <script src="js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: Implementar `js/admin.js`**

```js
document.addEventListener('DOMContentLoaded', function () {
  const api = createApi(APP_CONFIG);
  const $ = (id) => document.getElementById(id);
  const KEY_STORE = 'adminKey';
  const modal = new bootstrap.Modal($('modal-eliminar'));
  const CAMPOS = ['proyecto', 'contexto', 'rol', 'imagenes'];
  let adminKey = null;
  let idPorEliminar = null;

  function leerClave() { try { return sessionStorage.getItem(KEY_STORE); } catch (e) { return null; } }
  function guardarClave(k) { try { sessionStorage.setItem(KEY_STORE, k); } catch (e) { /* sin storage: la clave vive solo en memoria */ } }
  function borrarClave() { try { sessionStorage.removeItem(KEY_STORE); } catch (e) { /* nada */ } }

  function aviso(contenedor, tipo, texto) {
    contenedor.replaceChildren(el('div', { class: 'alert alert-' + tipo + ' mb-0', role: tipo === 'danger' ? 'alert' : 'status' }, [texto]));
  }
  function ocupado(btn, on, textoOn) {
    btn.disabled = on;
    if (on) { btn.dataset.txt = btn.innerHTML; btn.textContent = textoOn; } else if (btn.dataset.txt) { btn.innerHTML = btn.dataset.txt; }
  }

  function mostrarPanel(logueado) {
    $('panel-login').hidden = logueado;
    $('panel-admin').hidden = !logueado;
    if (logueado) cargarLista();
  }

  async function entrar(clave) {
    try {
      await api.verifyKey(clave);
      adminKey = clave;
      guardarClave(clave);
      $('estado-login').replaceChildren();
      mostrarPanel(true);
      return true;
    } catch (e) {
      const msg = (e.status === 401 || e.status === 403) ? 'Clave incorrecta.' : 'No pude conectar con el servidor. Inténtalo de nuevo.';
      aviso($('estado-login'), 'danger', msg);
      return false;
    }
  }

  $('form-login').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const clave = $('input-clave').value.trim();
    if (!clave) { aviso($('estado-login'), 'danger', 'Escribe la clave.'); return; }
    const btn = $('btn-entrar');
    ocupado(btn, true, 'Entrando…');
    const ok = await entrar(clave);
    ocupado(btn, false);
    if (ok) $('input-clave').value = '';
  });

  $('btn-salir').addEventListener('click', function () {
    adminKey = null;
    borrarClave();
    mostrarPanel(false);
  });

  async function cargarLista() {
    const ul = $('lista-admin');
    ul.replaceChildren(el('li', { class: 'list-group-item text-secondary' }, ['Cargando…']));
    try {
      const proyectos = await api.listProjects();
      if (proyectos.length === 0) {
        ul.replaceChildren(el('li', { class: 'list-group-item text-secondary' }, ['Aún no hay proyectos.']));
        return;
      }
      ul.replaceChildren(...proyectos.map(function (p) {
        const btn = el('button', { type: 'button', class: 'btn btn-outline-danger btn-sm', 'aria-label': 'Eliminar ' + p.proyecto }, []);
        btn.innerHTML = '<i class="bi bi-trash"></i>';
        btn.addEventListener('click', function () {
          idPorEliminar = p.id;
          $('modal-nombre').textContent = p.proyecto;
          modal.show();
        });
        return el('li', { class: 'list-group-item d-flex justify-content-between align-items-center gap-3' }, [
          el('span', {}, [p.proyecto]), btn
        ]);
      }));
    } catch (e) {
      ul.replaceChildren(el('li', { class: 'list-group-item text-danger' }, ['No pude cargar la lista.']));
    }
  }

  $('btn-confirmar-eliminar').addEventListener('click', async function () {
    const btn = $('btn-confirmar-eliminar');
    ocupado(btn, true, 'Eliminando…');
    try {
      await api.deleteProject(adminKey, idPorEliminar);
      modal.hide();
      aviso($('estado-admin'), 'success', 'Proyecto eliminado.');
      await cargarLista();
    } catch (e) {
      modal.hide();
      manejarErrorAdmin(e, 'No pude eliminar el proyecto.');
    } finally {
      ocupado(btn, false);
      idPorEliminar = null;
    }
  });

  function manejarErrorAdmin(e, texto) {
    if (e.status === 401 || e.status === 403) {
      adminKey = null;
      borrarClave();
      mostrarPanel(false);
      aviso($('estado-login'), 'danger', 'La clave dejó de ser válida. Vuelve a entrar.');
    } else {
      aviso($('estado-admin'), 'danger', texto);
    }
  }

  function limpiarErrores() {
    CAMPOS.forEach(function (c) { $('f-' + c).classList.remove('is-invalid'); $('err-' + c).textContent = ''; });
  }

  $('form-proyecto').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    limpiarErrores();
    const datos = {};
    CAMPOS.forEach(function (c) { datos[c] = $('f-' + c).value; });
    const errores = Utils.validateProject(datos);
    const campos = Object.keys(errores);
    if (campos.length > 0) {
      campos.forEach(function (c) { $('f-' + c).classList.add('is-invalid'); $('err-' + c).textContent = errores[c]; });
      $('f-' + campos[0]).focus();
      return;
    }
    const btn = $('btn-guardar');
    ocupado(btn, true, 'Guardando…');
    try {
      await api.createProject(adminKey, {
        proyecto: datos.proyecto.trim(),
        contexto: datos.contexto.trim(),
        rol: Utils.splitLines(datos.rol).join('\n'),
        imagenes: Utils.splitLines(datos.imagenes).join('\n')
      });
      $('form-proyecto').reset();
      aviso($('estado-admin'), 'success', 'Proyecto guardado.');
      await cargarLista();
    } catch (e) {
      manejarErrorAdmin(e, 'No pude guardar el proyecto. Inténtalo de nuevo.');
    } finally {
      ocupado(btn, false);
    }
  });

  const guardada = leerClave();
  if (guardada) { entrar(guardada).then(function (ok) { if (!ok) borrarClave(); }); }
});
```

- [ ] **Step 3: Verificación manual en el navegador (`open admin.html`)**

Comprobar, en este orden:
1. Clave equivocada → "Clave incorrecta.", no aparece el panel y `sessionStorage` no guarda nada (DevTools → Application).
2. Clave correcta → aparece el panel y la lista con los 4 proyectos.
3. Enviar el formulario vacío → 4 mensajes de error, el foco va al primer campo y no sale ninguna petición (DevTools → Network).
4. Imagen `javascript:alert(1)` → error en "Imágenes", sin petición.
5. Guardar un proyecto de prueba con 1 imagen `assets/images/proyectos/p1/1.png` → "Proyecto guardado." y aparece en la lista; en `proyectos.html` aparece como quinto bloque.
6. Doble clic rápido en "Guardar" → un solo proyecto nuevo (el botón se deshabilita).
7. Eliminar el proyecto de prueba → modal, confirmar → desaparece de la lista y de `proyectos.html`.
8. Recargar `admin.html` en la misma pestaña → entra directo con la clave guardada; "Salir" → vuelve al login y no queda clave guardada.

- [ ] **Step 4: Commit**

```bash
git add admin.html js/admin.js
git commit -m "feat: panel admin para agregar y eliminar proyectos"
```

---

### Task 7: Formulario de contacto con AJAX

**Files:**
- Create: `js/contacto.js`
- Modify: `js/config.js` (`FORMSPREE_URL` real)

**Interfaces:**
- Consumes: `APP_CONFIG.FORMSPREE_URL`, IDs de `contacto.html` (`formulario-contacto`, `estado-contacto`, `btn-enviar`).

- [ ] **Step 1: Crear el formulario en Formspree**

En formspree.io: crear cuenta gratuita → New form → correo destino `ayalamaleja77@gmail.com` → copiar el endpoint `https://formspree.io/f/<id>` y ponerlo en `FORMSPREE_URL` de `js/config.js`.

- [ ] **Step 2: Implementar `js/contacto.js`**

```js
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('formulario-contacto');
  const estado = document.getElementById('estado-contacto');
  const btn = document.getElementById('btn-enviar');
  let enviando = false;

  function aviso(tipo, texto) {
    const div = document.createElement('div');
    div.className = 'alert alert-' + tipo + ' mb-0';
    div.setAttribute('role', tipo === 'danger' ? 'alert' : 'status');
    div.textContent = texto;
    estado.replaceChildren(div);
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (enviando) return;
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    enviando = true;
    btn.disabled = true;
    const textoOriginal = btn.innerHTML;
    btn.textContent = 'Enviando…';
    try {
      const res = await fetch(APP_CONFIG.FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (!res.ok) throw new Error('Error ' + res.status);
      form.reset();
      form.classList.remove('was-validated');
      aviso('success', '¡Gracias! Recibí tu mensaje y te responderé pronto.');
    } catch (e) {
      aviso('danger', 'No pude enviar el mensaje. Inténtalo de nuevo o escríbeme a ayalamaleja77@gmail.com.');
    } finally {
      enviando = false;
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  });
});
```

- [ ] **Step 3: Verificación manual (`open contacto.html`)**

1. Enviar vacío → los tres campos muestran su mensaje y no hay petición en Network.
2. Correo inválido (`abc`) → error en correo.
3. Enviar un mensaje real → "¡Gracias!…", el formulario se limpia y llega el correo a la bandeja (Formspree pide confirmar el correo la primera vez).
4. Doble clic en "Enviar" → una sola petición.
5. Con `FORMSPREE_URL` apuntando a una URL inválida → mensaje de error rojo y el botón vuelve a estar habilitado.

- [ ] **Step 4: Commit**

```bash
git add js/contacto.js js/config.js
git commit -m "feat: formulario de contacto con AJAX (Formspree)"
```

---

### Task 8: Responsive, iconos, README y publicación

**Files:**
- Modify: `css/*.css` (solo lo que falle en la revisión), `README.md`

- [ ] **Step 1: Revisión responsive de las 4 páginas**

En Chrome → DevTools → modo dispositivo, a 375, 768 y 1280 px, para `index.html`, `proyectos.html`, `contacto.html`, `admin.html`. Criterios: sin scroll horizontal; navbar colapsa bajo 768 px y el menú abre y cierra; las imágenes de proyecto no se salen; el formulario de contacto y de admin usan todo el ancho; los botones de contacto se apilan en móvil (ya lo hace `contact.css`). Corregir con media queries en el CSS de la sección afectada.

- [ ] **Step 2: Revisar que `index.html` conserve su aspecto**

Comparar `index.html` con el original (`git stash`-free): `git show 10bedee:index.html > /tmp/original.html && open /tmp/original.html` junto a la versión nueva; el hero, sobre mí, habilidades, educación y experiencia deben verse igual (salvo el navbar). Si Bootstrap cambió algún margen o tipografía, corregirlo en `css/bootstrap-overrides.css`.

- [ ] **Step 3: Correr todas las pruebas una vez más**

Comando headless de la Task 1, Step 3. Expected: `TODAS OK`, `24/24 pruebas pasan`.

- [ ] **Step 4: Escribir el `README.md`**

```markdown
# Portafolio — María Alejandra Rozo Ayala

Sitio de 4 páginas: `index.html`, `proyectos.html`, `contacto.html`, `admin.html`.

## Tecnologías
HTML, CSS (flex y grid), Bootstrap 5.3, Bootstrap Icons, Google Fonts, JavaScript (DOM + AJAX con `fetch`), Retool (Database + Workflows) y Formspree.

## Cómo funciona
- `proyectos.html` pide los proyectos a un workflow de Retool (`js/api.js`) y los dibuja con DOM (`js/render.js`).
- `admin.html` pide una clave (la del workflow `admin`) y permite agregar y eliminar proyectos con los campos: proyecto, contexto, rol e imágenes.
- `contacto.html` envía el formulario con `fetch` a Formspree.

## Configuración
Copia tus URLs y claves públicas en `js/config.js`. La clave de administración **no** va en el código: se escribe en `admin.html`.

## Pruebas
Abre `tests/tests.html` en el navegador, o:
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --virtual-time-budget=3000 --dump-dom file://$PWD/tests/tests.html | grep -o 'pruebas pasan'`
```

- [ ] **Step 5: Commit y push**

```bash
git add -A
git commit -m "docs: README y ajustes responsive"
git push origin main
```
Expected: push exitoso a `https://github.com/Maleja5024/portafolio`. (Publicar con GitHub Pages es opcional y se decide aparte.)

---

## Self-review

- **Cobertura del spec:** páginas (T3), archivos JS (T1–T2, T4, T6–T7), datos (T5), API Retool (T0, T2), proyectos con spinner/error/vacío (T4), admin con validación/modal/lista sin recargar (T6), contacto (T7), riesgos CORS (T0 step 5) y clave (T6), pruebas manuales responsive (T8). Requisitos del curso: Bootstrap (T3), Retool (T0), flex/grid (CSS existente + `render.js` reusa las clases), responsive (T8), fuentes/iconos (T3), DOM/AJAX (T2, T4, T6, T7), 4 HTML (T3, T6).
- **Placeholders:** solo los valores que la autora obtiene en Retool/Formspree (`<ID-...>`, `<clave-...>`), que Task 0 y 7 explican cómo conseguir.
- **Consistencia de nombres:** `createApi`, `listProjects`, `verifyKey`, `createProject`, `deleteProject`, `renderProjectBlock`, `el`, `Utils.*`, IDs de HTML usados en JS coinciden entre tareas.
- **Review Focus:** ítems 1, 5 → pruebas de T4; 2, 7 → T1; 3 → T4 step 6; 4, 6 → T6 step 3 y T7 step 3.
