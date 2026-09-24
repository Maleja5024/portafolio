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
