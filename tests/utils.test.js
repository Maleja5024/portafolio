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
