# Portafolio: AJAX, DOM, Bootstrap y API en Retool — Diseño

Fecha: 2026-09-24. Estado: aprobado en conversación, pendiente de revisión del documento.

## Objetivo
Convertir el portafolio estático en un sitio de 4 páginas con contenido dinámico, cumpliendo los requisitos del curso (Bootstrap, API con Retool, flex y grid, responsive, fuentes e iconos externos, JavaScript DOM y AJAX, mínimo 4 HTML) y siendo útil en producción: la autora puede agregar y eliminar proyectos desde una página de admin.

## Estado de partida
Ya existe: flex, grid, Google Fonts (Space Grotesk, DM Sans, Dancing Script) y media queries en casi todos los CSS. Falta: Bootstrap, iconos, todo el JavaScript, la API, la división en 4 páginas y el formulario de contacto. El wireframe/mockup lo hace la autora en Figma y queda fuera de este trabajo.

## Páginas y archivos
- `index.html`: hero, sobre mí, habilidades, educación y experiencia.
- `proyectos.html`: tarjetas dibujadas desde la API.
- `contacto.html`: formulario con AJAX.
- `admin.html`: formulario para agregar y lista con eliminar.
- `js/api.js` (todas las llamadas `fetch`, URL base y clave en un solo lugar), `js/proyectos.js`, `js/contacto.js`, `js/admin.js`.
- Bootstrap y Bootstrap Icons por CDN. Los CSS actuales se mantienen; `css/bootstrap-overrides.css` conserva colores y tipografías de `tokens.css`.
- El menú (Bootstrap navbar) se repite en las 4 páginas; no se carga por fetch.

## Datos
Cada proyecto: `id`, `proyecto` (nombre), `contexto`, `rol`, `imagenes` (lista de URLs o rutas). Los 4 proyectos actuales se migran a estos campos con sus imágenes locales por ruta. Categoría y tags se descartan salvo que se pida lo contrario.

## API (Retool Database + Workflows)
- `GET` listar proyectos (público).
- `POST` crear proyecto (requiere clave en encabezado).
- `DELETE` eliminar proyecto por id (requiere clave en encabezado).
La clave se valida del lado del servidor en el workflow. `admin.html` la pide una vez y la guarda en `sessionStorage`.

## Comportamiento
- Proyectos: spinner al cargar, mensaje de error si falla, mensaje de vacío si no hay datos. Tarjetas creadas con `createElement`, grilla de Bootstrap y CSS flex/grid propio.
- Admin: campos obligatorios validados, varias URLs de imagen, modal de confirmación antes de eliminar, lista actualizada sin recargar.
- Contacto: validación de Bootstrap y envío con `fetch` a Formspree; estados enviando, enviado y error.

## Riesgos
- Retool puede bloquear las peticiones desde la página (CORS). Se verifica al construir; si ocurre, se requiere una solución intermedia pequeña que cambia el diseño.
- La clave protege el servidor pero no es un sistema de usuarios.
- Las imágenes son URLs o rutas, no archivos subidos.

## Pruebas
Revisión manual en el navegador: las 4 páginas, agregar y eliminar contra la API real, contacto con envío real, y responsive en 375, 768 y 1280 px.

## Fuera de alcance
Editar proyectos existentes, subir archivos de imagen, wireframe/mockup, sistema de usuarios.
