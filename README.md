# Portafolio — María Alejandra Rozo Ayala

Sitio de 4 páginas: `index.html`, `proyectos.html`, `contacto.html`, `admin.html`.

## Tecnologías
HTML, CSS (flex y grid), Bootstrap 5.3, Bootstrap Icons, Google Fonts, JavaScript (DOM + AJAX con `fetch`), Retool (Database + Workflows) y Formspree.

## Cómo funciona
- `proyectos.html` pide los proyectos a un workflow de Retool (`js/api.js`) y los dibuja con DOM (`js/render.js`).
- `admin.html` pide una clave (la API key del workflow `admin`) y permite agregar y eliminar proyectos con los campos: proyecto, contexto, rol e imágenes.
- `contacto.html` envía el formulario con `fetch` a Formspree.

## Configuración
Las URLs y la clave pública de lectura van en `js/config.js`. La clave de administración **no** va en el código: se escribe en `admin.html` y vive solo mientras la pestaña esté abierta.

Retool exige `?workflowApiKey=` y `Content-Type: text/plain` desde el navegador: con una cabecera personalizada el navegador hace una consulta previa (CORS preflight) que Retool rechaza con 401.

## Pruebas
Abre `tests/tests.html` en el navegador, o:
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --virtual-time-budget=3000 --dump-dom file://$PWD/tests/tests.html | grep -o 'pruebas pasan'`

## Datos iniciales
`assets/data/projects.json` contiene los 4 proyectos originales; `scripts/seed.py` los sube a Retool (una sola vez).
