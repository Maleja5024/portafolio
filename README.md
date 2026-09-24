# Portafolio — María Alejandra Rozo Ayala

Sitio web de portafolio UX/UI de 4 páginas, con proyectos que se cargan desde una base de datos en internet y un panel de administración para agregar y eliminar proyectos.

Esta guía explica **qué hace cada pieza y por qué**, para poder estudiarla.

---

## 1. Qué contiene el proyecto

```
Portafolio/
├── index.html        Inicio: presentación, habilidades, educación y experiencia
├── proyectos.html    Lista de proyectos (se dibuja con JavaScript desde Retool)
├── contacto.html     Enlaces de contacto (Instagram, correo, LinkedIn)
├── admin.html        Panel privado: agregar y eliminar proyectos
│
├── css/              Estilos, un archivo por sección
│   ├── tokens.css              Colores, tipografías y espacios (variables)
│   ├── bootstrap-overrides.css Adapta Bootstrap a tus colores y fuentes
│   └── base, hero, about, skills, education, experience, projects, contact, utilities
│
├── js/               El "cerebro" del sitio
│   ├── config.js     Direcciones de Retool y clave pública
│   ├── utils.js      Funciones pequeñas de apoyo y validaciones
│   ├── api.js        Habla con Retool (AJAX)
│   ├── render.js     Construye las tarjetas en pantalla (DOM)
│   ├── proyectos.js  Controla la página de proyectos
│   └── admin.js      Controla el panel de administración
│
└── assets/images/    Imágenes de perfil y de los proyectos
```

**Tecnologías:** HTML, CSS (flex y grid), Bootstrap 5.3, Bootstrap Icons, Google Fonts, JavaScript (DOM y AJAX con `fetch`) y Retool (base de datos y API).

---

## 2. Las ideas clave (léelas primero)

### DOM
El **DOM** es la página web vista como un árbol de objetos que JavaScript puede cambiar mientras alguien la usa. Cuando JavaScript crea una tarjeta de proyecto y la pega en la página sin que tú escribas ese HTML a mano, está manipulando el DOM.

Herramientas que se usan aquí:
- `document.getElementById('x')` busca un elemento.
- `document.createElement('div')` crea un elemento nuevo.
- `elemento.append(otro)` lo pega dentro de otro.
- `elemento.textContent = 'hola'` cambia su texto.
- `elemento.addEventListener('click', función)` reacciona a un clic.

### AJAX
**AJAX** es pedir o enviar datos a otro servidor **sin recargar la página**. En este proyecto se hace con `fetch()`. Ejemplo: al abrir `proyectos.html`, la página pide la lista de proyectos a Retool y luego la dibuja; la página nunca se recarga.

### API
Una **API** es como un mesero: la página le pide "dame los proyectos" y la API los trae de la base de datos. Aquí la API son dos *workflows* de Retool.

### JSON
El formato en el que viajan los datos. Se ve así:
```json
{ "id": 2, "proyecto": "EanMob", "rol": "línea 1\nlínea 2" }
```

### async / await
`fetch` tarda un poco (hay que esperar internet). `await` significa "espera aquí la respuesta antes de seguir", y solo se puede usar dentro de una función marcada `async`.

### try / catch
Si algo falla (sin internet, clave mala), el código salta al bloque `catch` y muestra un mensaje en vez de romperse.

---

## 3. Cómo viaja la información

```
  VISITANTE                       TU SITIO                        RETOOL
  abre proyectos.html  ─────►  proyectos.js
                                   │  pide la lista
                                   ▼
                                api.js  ── fetch (AJAX) ──►  workflow "listar"
                                   ▲                              │ lee la tabla
                                   │  devuelve los datos ◄────────┘ "proyectos"
                                   ▼
                                render.js   crea las tarjetas (DOM)
                                   ▼
                          ¡se ven los proyectos!


  TÚ (admin)                      TU SITIO                        RETOOL
  escribes tu clave ───────►   admin.js ─► api.js ── fetch ──►  workflow "admin"
  llenas el formulario                                          crea o borra
  presionas Guardar                                             en la tabla
```

Los proyectos **no están escritos en el HTML**: viven en una tabla de Retool. Por eso puedes agregar o borrar proyectos sin editar código.

---

## 4. Explicación archivo por archivo

### `js/config.js`
Guarda las direcciones de Retool y la clave de **solo lectura** (es pública a propósito: solo permite ver la lista, que ya es pública).

```js
window.APP_CONFIG = {
  LIST_URL:  '...',  // dirección del workflow "listar"
  LIST_KEY:  '...',  // clave pública de lectura
  ADMIN_URL: '...'   // dirección del workflow "admin"
};
```
La clave de **administración** NO está aquí. Se escribe en `admin.html` cada vez que entras, y así nadie puede leerla en el código.

### `js/utils.js`
Funciones pequeñas y "puras" (siempre dan el mismo resultado con la misma entrada):

| Función | Qué hace |
|---|---|
| `splitLines(texto)` | Convierte un texto con varias líneas en una lista, quitando líneas vacías |
| `ordinal(n)` | 1 → "primer", 2 → "segundo"… (para "primer proyecto") |
| `screensClass(n)` | Elige la clase CSS de la grilla según cuántas imágenes hay |
| `imageAlt(nombre, i)` | Crea el texto alternativo de cada imagen (accesibilidad) |
| `isValidImageRef(texto)` | Acepta solo `https://…`, `http://…` o rutas `assets/…`. Rechaza `javascript:` y `data:` por seguridad |
| `validateProject(datos)` | Revisa que el formulario esté completo y devuelve los errores |

### `js/api.js` — el AJAX
Contiene `createApi(config)`, que devuelve 4 funciones:

| Función | Para qué |
|---|---|
| `listProjects()` | Pide la lista de proyectos (pública) |
| `verifyKey(clave)` | Comprueba si la clave de admin es correcta |
| `createProject(clave, datos)` | Agrega un proyecto |
| `deleteProject(clave, id)` | Elimina un proyecto |

Todas usan una función interna `call()` que hace el `fetch`:

```js
const res = await fetch(url + '?workflowApiKey=' + clave, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify(datos)
});
```

**Por qué la clave va en la dirección y el contenido es `text/plain`:** si se enviara una cabecera personalizada, el navegador haría antes una consulta de permiso (llamada *preflight* de CORS) y Retool la rechaza con error 401. Con este formato, el navegador manda la petición directo y funciona.

Si la respuesta no es correcta, crea un error con el número (`err.status`, por ejemplo 401) para que `admin.js` sepa qué mensaje mostrar.

### `js/render.js` — el DOM
- `el(etiqueta, atributos, hijos)` es un atajo para crear elementos: `el('p', {class:'x'}, ['Hola'])` crea `<p class="x">Hola</p>`.
- `renderProjectBlock(proyecto, posición)` construye **un bloque completo de proyecto**: número, nombre, contexto, rol como lista e imágenes. Usa las mismas clases CSS que ya tenías, así que se ve idéntico al diseño original.

Detalles importantes:
- **Seguridad:** el texto se inserta con `textContent`, no con `innerHTML`. Si alguien escribe `<script>` en un proyecto, se muestra como texto y no se ejecuta.
- Si una imagen no carga, se quita (`error` → `img.remove()`) para no mostrar un icono roto.
- Si la imagen es horizontal, se le añade la clase `project-img-landscape` al cargar.

### `js/proyectos.js`
Controla la página de proyectos, con tres estados:
1. **Cargando:** muestra un spinner mientras espera.
2. **Éxito:** dibuja las tarjetas (o dice "Aún no hay proyectos" si la lista está vacía).
3. **Error:** muestra un aviso rojo con un botón **Reintentar**.

### `js/admin.js`
Controla el panel privado.
- **Login:** pide la clave, la comprueba con `verifyKey` y, si es correcta, la guarda en `sessionStorage` (memoria de la pestaña; se borra al cerrarla). Si es mala dice "Clave incorrecta".
- **Agregar:** valida el formulario con `validateProject`, marca en rojo los campos con error, y si todo está bien llama a `createProject`. El botón se deshabilita mientras guarda para evitar duplicados por doble clic.
- **Eliminar:** cada proyecto tiene un botón de papelera; al pulsarlo se abre un **modal** de confirmación (componente de Bootstrap) y solo se borra si confirmas.
- Después de agregar o eliminar, la lista se recarga sola.
- Si la clave deja de ser válida, te devuelve al login.

---

## 5. Retool: la base de datos y los workflows

Retool aloja la tabla y las dos "API". Todo se llama con `POST`, y Retool exige una **API key** por workflow.

### Tabla `proyectos`
| Columna | Tipo | Contenido |
|---|---|---|
| `id` | número automático | Identificador único |
| `proyecto` | texto | Nombre y descripción corta |
| `contexto` | texto | De qué trata el proyecto |
| `rol` | texto | Tu rol; **un punto por línea** |
| `imagenes` | texto | Direcciones de imágenes; **una por línea** |

`rol` e `imagenes` son texto con un elemento por línea. El sitio los convierte en lista con `splitLines`.

### Workflow `listar` (público)
```
startTrigger  →  consulta  →  response
```
- `consulta` (Retool Database, SQL): `SELECT id, proyecto, contexto, rol, imagenes FROM proyectos ORDER BY id;`
- `response`: Return body = `consulta.data`
  (en ese campo **no** se ponen dobles llaves `{{ }}`: ya espera código).

### Workflow `admin` (protegido)
```
startTrigger  →  validar  →  resultado  →  response
```
- `validar` (código JavaScript): revisa que la acción sea `verificar`, `crear` o `eliminar`, y que lleguen los campos necesarios. Es una segunda validación, en el servidor, por si alguien se salta el formulario.
- `resultado` (Retool Database, SQL): según la acción, inserta o borra. Es un solo SQL con dos bloques `WITH`; el que no corresponde no hace nada:
  ```sql
  WITH ins AS (
    INSERT INTO proyectos (proyecto, contexto, rol, imagenes)
    SELECT {{ validar.data.proyecto }}::text, {{ validar.data.contexto }}::text,
           {{ validar.data.rol }}::text, {{ validar.data.imagenes }}::text
    WHERE {{ validar.data.accion }}::text = 'crear'
    RETURNING id
  ), del AS (
    DELETE FROM proyectos
    WHERE id = {{ validar.data.id }}::int AND {{ validar.data.accion }}::text = 'eliminar'
    RETURNING id
  )
  SELECT (SELECT id FROM ins) AS id;
  ```
  Los `{{ }}` dentro del SQL se envían como parámetros, no como texto pegado, así que no hay riesgo de inyección SQL.
- `response`: Return body = `{ ok: true, id: resultado.data[0].id }`

### Seguridad, en simple
- Sin clave, o con clave equivocada, Retool responde **401** y no ejecuta nada.
- La clave de `listar` es de solo lectura y está a la vista en `config.js`. No es un problema.
- La clave de `admin` es tu contraseña. **Nunca** va en el código ni en GitHub. Si se filtra, se regenera en Retool (Triggers → Webhook → `···`) y no hay que cambiar nada en el código.
- La clave viaja en la dirección de la petición, así que puede quedar en los registros de Retool. Es aceptable para un portafolio personal, pero no la reutilices en otros servicios.

---

## 6. Las páginas HTML

Las cuatro comparten el mismo `<head>` (fuentes, Bootstrap, iconos, tus CSS) y el mismo menú.

- **Menú:** es una `navbar` de Bootstrap. En pantallas menores a 768 px se colapsa en un botón hamburguesa (`data-bs-toggle="collapse"`), que funciona gracias a `bootstrap.bundle.min.js`.
- **Iconos:** Bootstrap Icons, con etiquetas como `<i class="bi bi-house"></i>`.
- **Enlace Admin:** está en el pie de página, no en el menú, para no exponerlo a los visitantes. La página lleva `noindex` para que los buscadores no la indexen.
- **Orden de los scripts:** al final de `<body>`, cada uno depende del anterior: `utils.js` → `config.js` → `api.js` → `render.js` → el de la página. Si cambias el orden, falla.

### Cómo se combinan tu CSS y Bootstrap
Bootstrap se carga **primero** y tus CSS **después**, así los tuyos ganan cuando hay conflicto. `bootstrap-overrides.css` conecta Bootstrap con tus variables (`--accent`, `--ink`, `--bg`, tipografías) para que sus botones, formularios y menú se vean con tu identidad. Se creó una clase propia `.btn-brand` para el botón rosado.

### Flex y grid
- **Flexbox** (una dimensión, fila o columna): menú, botones de contacto, pills de habilidades.
- **Grid** (dos dimensiones): cada bloque de proyecto (columna de etiqueta + contenido), y las galerías de pantallas.
- **Responsive:** las `@media` de cada CSS ajustan el diseño en pantallas pequeñas, más el sistema de Bootstrap.

---

## 7. Cómo usar el panel de admin

1. Abre `admin.html` (en internet, `…/admin.html`; en tu computador, doble clic al archivo, mejor con Chrome).
2. Escribe la clave de administración y pulsa **Entrar**.
3. Llena el formulario:
   - **Proyecto:** nombre — descripción corta.
   - **Contexto:** de qué trata.
   - **Mi rol:** un punto por línea.
   - **Imágenes:** una dirección por línea. Puede ser `https://…` (enlace directo que termine en `.png`/`.jpg`/`.webp`) o una ruta del proyecto como `assets/images/proyectos/p5/1.png`.
4. Pulsa **Guardar proyecto**. Aparece en la lista y en `proyectos.html`.
5. Para borrar, pulsa la papelera del proyecto y confirma.

**Sobre las imágenes:**
- Un enlace de "compartir" (de Google, por ejemplo) **no sirve**: es una página, no la imagen. Debe ser un enlace directo.
- Si usas una ruta `assets/…`, la imagen tiene que existir en esa carpeta **y estar subida a GitHub**, o en internet saldrá rota.
- El panel **no sube archivos**, solo guarda direcciones. No se pueden editar proyectos, solo agregar y eliminar.

---

## 8. Requisitos del curso y dónde se cumplen

| Requisito | Dónde |
|---|---|
| Bootstrap | Menú, formularios, modal, botones y alertas en todas las páginas |
| API (Retool) | Workflows `listar` y `admin`; se consumen en `js/api.js` |
| Display flex y grid | `css/*.css` (menú, contacto, proyectos, habilidades…) |
| Responsive | `@media` en cada CSS y la navbar colapsable de Bootstrap |
| Fuentes e iconos externos | Google Fonts (Space Grotesk, DM Sans, Dancing Script) y Bootstrap Icons |
| JavaScript DOM | `js/render.js`, `js/proyectos.js`, `js/admin.js` |
| JavaScript AJAX | `js/api.js` (`fetch` a Retool) |
| Mínimo 4 HTML | `index`, `proyectos`, `contacto`, `admin` |
| Wireframe/mockup | Se entrega aparte (Figma) |

---

## 9. Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Proyectos: "No pude cargar los proyectos" | Sin internet, o la URL/clave de `config.js` está mal | Revisa `js/config.js` y que el workflow `listar` esté publicado |
| Admin: "Clave incorrecta" | Clave mal copiada o regenerada | Copia la clave actual desde Retool |
| Admin: "No pude conectar con el servidor" | Sin internet o workflow sin publicar | En Retool pulsa **Publish release** |
| Un proyecto sale sin imagen | El enlace no es una imagen directa, o la ruta no existe | Usa un enlace que termine en `.png`/`.jpg` o revisa la ruta |
| Cambié algo en Retool y no se nota | Falta publicar | **Publish release** (Run solo prueba, no publica) |
| El menú no se despliega en móvil | Falta el script de Bootstrap | Debe estar `bootstrap.bundle.min.js` antes de `</body>` |

---

## 10. Glosario rápido

- **DOM:** el árbol de la página que JavaScript puede modificar.
- **AJAX:** pedir datos sin recargar la página.
- **API:** el "mesero" que lleva y trae datos.
- **fetch:** la función de JavaScript que hace la petición.
- **JSON:** formato de texto para intercambiar datos.
- **CORS:** regla del navegador que decide si una página puede pedir datos a otro sitio.
- **Preflight:** consulta de permiso previa que el navegador hace en ciertos casos.
- **Workflow:** flujo de pasos automáticos en Retool.
- **sessionStorage:** memoria de la pestaña; se borra al cerrarla.
- **Modal:** ventana emergente (aquí, la de confirmar eliminar).
- **Responsive:** que el diseño se adapte al tamaño de pantalla.
