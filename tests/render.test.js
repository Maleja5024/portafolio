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
